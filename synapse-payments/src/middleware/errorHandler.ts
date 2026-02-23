/**
 * Error Handler Middleware
 * 
 * @module synapse-payments/middleware/errorHandler
 * @description Global error handling for the payment service
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, ApiResponse, ApiError } from '../types';
import { logger } from '../index';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super('AUTHORIZATION_ERROR', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
  }
}

export class KycRequiredError extends AppError {
  constructor(message: string = 'KYC verification required') {
    super('KYC_REQUIRED', message, 403, { kycRequired: true });
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(balance: number, required: number) {
    super(
      'INSUFFICIENT_CREDITS',
      `Insufficient credits. Balance: ${balance}, Required: ${required}`,
      402,
      { balance, required }
    );
  }
}

export function errorHandler(
  err: Error,
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): void {
  // Determine error type
  let error: ApiError;
  let statusCode = 500;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    error = {
      code: err.code,
      message: err.message,
      details: err.details,
    };
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    error = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: { errors: (err as any).errors },
    };
  } else if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      statusCode = 409;
      error = {
        code: 'DUPLICATE_ERROR',
        message: 'Resource already exists',
      };
    } else if (prismaError.code === 'P2025') {
      statusCode = 404;
      error = {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      };
    } else {
      statusCode = 500;
      error = {
        code: 'DATABASE_ERROR',
        message: 'Database error occurred',
      };
    }
  } else {
    // Unknown error
    error = {
      code: 'INTERNAL_ERROR',
      message: NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
    };
  }

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      requestId: req.requestId,
      path: req.path,
    });
  } else {
    logger.warn('Client error', {
      code: error.code,
      message: error.message,
      requestId: req.requestId,
      path: req.path,
    });
  }

  // Send response
  const response: ApiResponse = {
    success: false,
    error,
    meta: {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - req.startTime,
      version: process.env.npm_package_version || '1.0.0',
    },
  };

  res.status(statusCode).json(response);
}

// Environment check for error messages
const NODE_ENV = process.env.NODE_ENV || 'development';