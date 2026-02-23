/**
 * API Key Authentication Middleware
 * 
 * @module synapse-backend/api-gateway/middleware/apiKey
 * @description Validates API keys and authenticates requests
 * 
 * Features:
 * - API key validation against database/cache
 * - Rate limit tracking per key
 * - Tier-based access control
 * - Request attribution
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, AuthenticatedUser } from '../types';
import { AuthenticationError, AuthorizationError, RateLimitError } from './errorHandler';
import { logger } from '../index';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY_HEADER = 'x-api-key';
const AUTHORIZATION_HEADER = 'authorization';

// Rate limits by tier (requests per minute)
const TIER_LIMITS: Record<string, number> = {
  free: 60,
  basic: 300,
  pro: 1000,
  enterprise: 5000,
};

// Cache for API key lookups (in production, use Redis)
const keyCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// API KEY VERIFICATION
// ============================================================================

/**
 * Extract API key from request headers
 * 
 * Checks for:
 * 1. X-API-Key header
 * 2. Authorization: Bearer <key> header
 * 
 * @param req - Express request
 * @returns API key or undefined
 */
function extractApiKey(req: AuthenticatedRequest): string | undefined {
  // Check X-API-Key header
  const apiKey = req.headers[API_KEY_HEADER] || req.headers[API_KEY_HEADER.toLowerCase()];
  if (typeof apiKey === 'string') {
    return apiKey;
  }

  // Check Authorization header
  const authHeader = req.headers[AUTHORIZATION_HEADER] || req.headers[AUTHORIZATION_HEADER.toLowerCase()];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7);
  }

  return undefined;
}

/**
 * Validate API key format
 * 
 * @param apiKey - API key to validate
 * @returns True if valid format
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  // Expected format: syn_<32_char_hex>
  return /^syn_[a-f0-9]{32}$/i.test(apiKey);
}

/**
 * Look up API key in database/cache
 * 
 * TODO: Replace with actual database lookup
 * 
 * @param apiKey - API key to look up
 * @returns User data or null if invalid
 */
async function lookupApiKey(apiKey: string): Promise<AuthenticatedUser | null> {
  // Check cache first
  const cached = keyCache.get(apiKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  // TODO: Replace with actual database query
  // For now, simulate lookup with test keys
  const mockUsers: Record<string, AuthenticatedUser> = {
    'syn_test123456789012345678901234567890': {
      address: '0x1234567890123456789012345678901234567890',
      apiKeyId: 'test-key-1',
      authenticatedAt: new Date(),
      tier: 'pro',
      quotaRemaining: 1000,
    },
  };

  const user = mockUsers[apiKey] || null;

  // Cache valid keys
  if (user) {
    keyCache.set(apiKey, {
      user,
      expiresAt: Date.now() + CACHE_TTL,
    });
  }

  return user;
}

/**
 * Check if user has exceeded rate limit
 * 
 * TODO: Replace with actual rate limiter (Redis)
 * 
 * @param user - Authenticated user
 * @returns True if rate limit exceeded
 */
async function isRateLimitExceeded(user: AuthenticatedUser): Promise<boolean> {
  // TODO: Implement actual rate limiting with Redis
  // For now, just check quota remaining
  return user.quotaRemaining <= 0;
}

/**
 * Record API request for rate limiting
 * 
 * @param user - Authenticated user
 */
async function recordRequest(user: AuthenticatedUser): Promise<void> {
  // TODO: Implement with Redis
  user.quotaRemaining--;
}

/**
 * Get rate limit headers for response
 * 
 * @param user - Authenticated user
 * @returns Rate limit header values
 */
function getRateLimitHeaders(user: AuthenticatedUser): Record<string, string> {
  const limit = TIER_LIMITS[user.tier] || TIER_LIMITS.free;
  
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, user.quotaRemaining)),
    'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60), // Reset in 1 min
    'X-RateLimit-Tier': user.tier,
  };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * API Key verification middleware
 * 
 * Validates API key and attaches user to request
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 * @throws {AuthenticationError} If API key missing or invalid
 * @throws {AuthorizationError} If tier access denied
 * @throws {RateLimitError} If rate limit exceeded
 */
export async function verifyApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new AuthenticationError('API key required. Provide via X-API-Key header or Authorization: Bearer <key>');
    }

    // Validate format
    if (!isValidApiKeyFormat(apiKey)) {
      logger.warn('Invalid API key format', {
        requestId: req.requestId,
        ip: req.ip,
      });
      throw new AuthenticationError('Invalid API key format');
    }

    // Look up key
    const user = await lookupApiKey(apiKey);

    if (!user) {
      logger.warn('Invalid API key', {
        requestId: req.requestId,
        ip: req.ip,
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
      });
      throw new AuthenticationError('Invalid API key');
    }

    // Check rate limit
    if (await isRateLimitExceeded(user)) {
      logger.warn('Rate limit exceeded', {
        requestId: req.requestId,
        user: user.address,
        tier: user.tier,
      });
      throw new RateLimitError();
    }

    // Record request
    await recordRequest(user);

    // Attach user to request
    req.user = user;

    // Add rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(user);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    logger.debug('API key verified', {
      requestId: req.requestId,
      user: user.address,
      tier: user.tier,
    });

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional API key middleware
 * 
 * Attaches user if key provided, but doesn't require it
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 */
export async function optionalApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (apiKey && isValidApiKeyFormat(apiKey)) {
      const user = await lookupApiKey(apiKey);
      if (user) {
        req.user = user;
        await recordRequest(user);
        
        const rateLimitHeaders = getRateLimitHeaders(user);
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
    }

    next();
  } catch (error) {
    // Don't fail request for optional auth errors
    next();
  }
}

/**
 * Tier-based access control middleware factory
 * 
 * @param allowedTiers - List of allowed tiers
 * @returns Middleware function
 * 
 * @example
 * ```typescript
 * router.get('/admin', requireTier(['pro', 'enterprise']), adminHandler);
 * ```
 */
export function requireTier(allowedTiers: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError());
      return;
    }

    if (!allowedTiers.includes(req.user.tier)) {
      logger.warn('Tier access denied', {
        requestId: req.requestId,
        user: req.user.address,
        tier: req.user.tier,
        required: allowedTiers,
      });
      next(new AuthorizationError(`This endpoint requires tier: ${allowedTiers.join(' or ')}`));
      return;
    }

    next();
  };
}

export default verifyApiKey;
