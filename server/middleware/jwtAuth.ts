import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from '../db';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * JWT authentication middleware for mobile app REST endpoints.
 * Verifies the Bearer token in the Authorization header and attaches
 * the decoded user info to req.user.
 */
export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No authorization token provided',
      });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key') as {
      userId: string;
      email: string;
      role: string;
    };

    // Get user from database to ensure they still exist and are active
    const user = await getUserById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found or account deactivated',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }
    console.error('[jwtAuth] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
}
