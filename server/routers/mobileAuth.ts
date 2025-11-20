import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getUserByEmail, getUserById } from '../mongodb';
import { ENV } from '../_core/env';

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

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || '',
        role: user.role,
        monthlyBilling: user.monthlyBilling || false,
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
