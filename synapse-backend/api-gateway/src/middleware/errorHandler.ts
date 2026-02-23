/**
 * Error Handler Middleware
 * 
 * @module synapse-backend/api-gateway/middleware/errorHandler
 * @description Centralized error handling for API Gateway
 * 
 * Features:
 * - Structured error responses
 * - Error logging with request context
 * - Environment-specific error detail exposure
 * - Custom error code mapping
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, ApiResponse, ApiError } from '../types';
import { logger } from '../index';

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base API error class
 */
export class ApiGatewayError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiGatewayError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends ApiGatewayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends ApiGatewayError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED', true);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends ApiGatewayError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN', true);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends ApiGatewayError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` '${id}'` : ''} not found`,
      404,
      'NOT_FOUND',
      true,
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends ApiGatewayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', true, details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends ApiGatewayError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      'Rate limit exceeded. Please try again later.',
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { retryAfter }
    );
    this.retryAfter = retryAfter;
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

/**
 * Global error handler middleware
 * 
 * @param err - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function errorHandler(
  err: Error,
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): void {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isDevelopment = NODE_ENV === 'development';

  // Default error values
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  // Handle known error types
  if (err instanceof ApiGatewayError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError' || err.name === 'ZodError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  // Log error with context
  const logData = {
    error: {
      name: err.name,
      message: err.message,
      code: errorCode,
      stack: isDevelopment ? err.stack : undefined,
    },
    request: {
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      user: req.user?.address,
    },
    statusCode,
  };

  if (statusCode >= 500) {
    logger.error('Server error', logData);
  } else {
    logger.warn('Client error', logData);
  }

  // Build error response
  const errorResponse: ApiError = {
    code: errorCode,
    message,
  };

  // Include details in development or for validation errors
  if ((isDevelopment || statusCode < 500) && details) {
    errorResponse.details = details;
  }

  // Include stack trace in development only
  if (isDevelopment && err.stack) {
    errorResponse.details = {
      ...errorResponse.details,
      stack: err.stack.split('\n'),
    };
  }

  // Send response
  const response: ApiResponse = {
    success: false,
    error: errorResponse,
    meta: {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - req.startTime,
      version: process.env.npm_package_version || '1.0.0',
    },
  };

  // Set retry-after header for rate limit errors
  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', String(err.retryAfter));
  }

  res.status(statusCode).json(response);
}

// ============================================================================
// ASYNC HANDLER WRAPPER
// ============================================================================

/**
 * Wrapper for async route handlers
 * Automatically catches errors and passes to error handler
 * 
 * @param fn - Async route handler
 * @returns Wrapped handler
 * 
 * @example
 * ```typescript
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsers();
 *   res.json(users);
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
