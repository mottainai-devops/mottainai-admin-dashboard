import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getUserByEmail, getUserById } from '../mongodb';
import { ENV } from '../_core/env';
import { resolveMobileAssignedLots } from '../services/mobileAssignedLots';

const router = Router();

/**
 * Mobile App Authentication Router
 * Provides REST API endpoints for mobile app login/authentication
 * Uses MongoDB users collection for authentication
 */

// Login endpoint for mobile app
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Decode base64 password (mobile app sends base64-encoded password)
    let decodedPassword = password;
    try {
      decodedPassword = Buffer.from(password, 'base64').toString('utf-8');
    } catch (e) {
      // If decoding fails, use password as-is
      console.log('[MobileAuth] Password not base64 encoded, using as-is');
    }

    // Find user by email
    const user = await getUserByEmail(email);

    if (!user) {
      console.log(`[MobileAuth] Login failed: User not found for email ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(decodedPassword, user.password);

    if (!isPasswordValid) {
      console.log(`[MobileAuth] Login failed: Invalid password for ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '30d' } // Token valid for 30 days
    );

    console.log(`[MobileAuth] Login successful for ${email} (${user.role})`);

    // One shared resolver keeps /login and /me consistent. All-lots roles are
    // restricted to active Mottainai-parented franchisees, never Independents.
    const { assignedLots, defaultLotCode: resolvedDefaultLotCode } = await resolveMobileAssignedLots(user);

    // Return user data and token
    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || '',
        role: user.role,
        monthlyBilling: user.monthlyBilling || false,
        // Company and lot attribution fields
        // cherry_picker users have null companyId — they operate across all lots
        companyId: user.companyId || null,
        companyName: user.companyName || null,
        defaultLotCode: resolvedDefaultLotCode,
        assignedLots, // Part A fix v4.5.4 — resolves 'No lots assigned to your account'
      },
    });
  } catch (error) {
    console.error('[MobileAuth] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get current user info (requires authentication)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(authHeader, process.env.JWT_SECRET || 'fallback-secret-key') as {
      userId: string;
      email: string;
      role: string;
    };

    // Get user from database
    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Use the same resolver as /login so a refresh cannot erase an all-lots cache.
    const { assignedLots: meAssignedLots, defaultLotCode: meDefaultLotCode } = await resolveMobileAssignedLots(user);

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || '',
        role: user.role,
        monthlyBilling: user.monthlyBilling || false,
        companyId: user.companyId || null,
        companyName: user.companyName || null,
        defaultLotCode: meDefaultLotCode,
        assignedLots: meAssignedLots, // Part A fix v4.5.4
      },
    });
  } catch (error) {
    console.error('[MobileAuth] Get me error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mobile-auth' });
});

export default router;
