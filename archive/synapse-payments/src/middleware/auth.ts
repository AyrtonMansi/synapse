/**
 * Authentication Middleware
 * 
 * @module synapse-payments/middleware/auth
 * @description Validates JWT tokens and authenticates requests
 */

import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest, User } from '../types';
import { AuthenticationError } from './errorHandler';
import { logger } from '../index';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  email: string;
  tier: string;
  iat: number;
  exp: number;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Bearer token required');
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!dbUser) {
      throw new AuthenticationError('User not found');
    }

    // Attach user to request
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      walletAddress: dbUser.walletAddress || undefined,
      stripeCustomerId: dbUser.stripeCustomerId || undefined,
      kycStatus: dbUser.kycStatus as any,
      kycVerifiedAt: dbUser.kycVerifiedAt || undefined,
      tier: dbUser.tier as any,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      metadata: (dbUser.metadata as Record<string, any>) || {},
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token provided, but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (dbUser) {
      req.user = {
        id: dbUser.id,
        email: dbUser.email,
        walletAddress: dbUser.walletAddress || undefined,
        stripeCustomerId: dbUser.stripeCustomerId || undefined,
        kycStatus: dbUser.kycStatus as any,
        kycVerifiedAt: dbUser.kycVerifiedAt || undefined,
        tier: dbUser.tier as any,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        metadata: (dbUser.metadata as Record<string, any>) || {},
      };
    }

    next();
  } catch {
    // Ignore auth errors for optional auth
    next();
  }
}

/**
 * Admin authentication middleware
 */
export function adminAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AuthenticationError());
    return;
  }

  // Check if user is admin
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  if (!adminEmails.includes(req.user.email)) {
    logger.warn('Admin access denied', {
      userId: req.user.id,
      email: req.user.email,
    });
    next(new AuthenticationError('Admin access required'));
    return;
  }

  next();
}

/**
 * Generate JWT token for user
 */
export function generateToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tier: user.tier,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}