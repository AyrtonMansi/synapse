/**
 * Enhanced Error Handler
 * Centralized error handling with security considerations
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'error-handler' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/errors.log' })
  ]
});

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR', true);
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
  }
}

/**
 * Sanitize error messages for client response
 * Removes sensitive information
 */
function sanitizeError(error) {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /private/i,
    /key/i,
    /token/i,
    /jwt/i,
    /0x[a-fA-F0-9]{64}/, // Private keys
  ];
  
  let message = error.message || 'An error occurred';
  
  // Remove stack traces from client response
  delete error.stack;
  
  // Sanitize sensitive data from message
  for (const pattern of sensitivePatterns) {
    message = message.replace(pattern, '[REDACTED]');
  }
  
  return message;
}

/**
 * Main error handling middleware
 */
function errorHandler(err, req, res, next) {
  // Generate unique error ID for tracking
  const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log error with context
  const errorContext = {
    errorId,
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    walletAddress: req.walletAddress,
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack,
    }
  };
  
  // Log based on severity
  if (err.statusCode >= 500) {
    logger.error('Server Error', errorContext);
  } else if (err.statusCode >= 400) {
    logger.warn('Client Error', errorContext);
  }
  
  // Determine response
  let statusCode = err.statusCode || 500;
  let response = {
    error: true,
    errorId,
    code: err.code || 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
  
  // Operational errors (expected) can show details to client
  if (err.isOperational) {
    response.message = sanitizeError(err);
    
    // Include validation details
    if (err.details) {
      response.details = err.details;
    }
    
    // Include retry after for rate limits
    if (err instanceof RateLimitError) {
      response.retryAfter = 60;
      res.setHeader('Retry-After', 60);
    }
  } else {
    // Programming errors - hide details in production
    if (process.env.NODE_ENV === 'production') {
      response.message = 'Internal server error';
    } else {
      response.message = err.message;
      response.stack = err.stack;
    }
    
    // Alert on unexpected errors
    if (process.env.ALERT_WEBHOOK_URL) {
      sendAlert(errorContext);
    }
  }
  
  // Add help link for certain errors
  if (statusCode === 401) {
    response.help = 'Please authenticate with a valid wallet signature';
  } else if (statusCode === 403) {
    response.help = 'You do not have permission to access this resource';
  } else if (statusCode === 429) {
    response.help = 'Please reduce your request rate';
  }
  
  res.status(statusCode).json(response);
}

/**
 * Send alert for critical errors
 */
async function sendAlert(errorContext) {
  try {
    const axios = require('axios');
    await axios.post(process.env.ALERT_WEBHOOK_URL, {
      text: `🚨 Synapse Error: ${errorContext.error.message}`,
      errorId: errorContext.errorId,
      path: errorContext.path,
      timestamp: errorContext.timestamp,
    });
  } catch (error) {
    logger.error('Failed to send alert', { error: error.message });
  }
}

/**
 * Handle uncaught exceptions
 */
function handleUncaughtExceptions() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });
    
    // Graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

/**
 * Async handler wrapper for controllers
 * Catches errors in async functions
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  handleUncaughtExceptions,
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
};
