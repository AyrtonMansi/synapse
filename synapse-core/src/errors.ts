/**
 * Shared Error Types and Utilities
 * 
 * @module synapse-core/errors
 * @description Centralized error handling for all Synapse packages
 * 
 * @example
 * ```typescript
 * import { SynapseError, ErrorCode } from '@synapse/core/errors';
 * 
 * throw new SynapseError(
 *   ErrorCode.INSUFFICIENT_FUNDS,
 *   'Insufficient balance for transaction',
 *   { requested: '1000', available: '500' }
 * );
 * ```
 */

/**
 * Standardized error codes across the Synapse ecosystem
 * 
 * @enum {string}
 */
export enum ErrorCode {
  // Validation errors (400)
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_PROOF = 'INVALID_PROOF',
  INVALID_NODE_ID = 'INVALID_NODE_ID',
  INVALID_JOB_ID = 'INVALID_JOB_ID',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INSUFFICIENT_STAKE = 'INSUFFICIENT_STAKE',
  MODEL_NOT_SUPPORTED = 'MODEL_NOT_SUPPORTED',
  PARAM_OUT_OF_RANGE = 'PARAM_OUT_OF_RANGE',
  
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  
  // Permission errors (403)
  FORBIDDEN = 'FORBIDDEN',
  NOT_NODE_OWNER = 'NOT_NODE_OWNER',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Not found (404)
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  
  // State errors (409)
  JOB_ALREADY_ASSIGNED = 'JOB_ALREADY_ASSIGNED',
  JOB_ALREADY_COMPLETED = 'JOB_ALREADY_COMPLETED',
  NODE_BUSY = 'NODE_BUSY',
  NODE_OFFLINE = 'NODE_OFFLINE',
  NODE_SUSPENDED = 'NODE_SUSPENDED',
  PROOF_VERIFICATION_FAILED = 'PROOF_VERIFICATION_FAILED',
  DISPUTE_PERIOD_ACTIVE = 'DISPUTE_PERIOD_ACTIVE',
  ALREADY_CLAIMED = 'ALREADY_CLAIMED',
  
  // Network errors (503)
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  NODE_UNAVAILABLE = 'NODE_UNAVAILABLE',
  
  // System errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  ZK_VERIFICATION_ERROR = 'ZK_VERIFICATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
}

/**
 * HTTP status code mapping for error codes
 * @internal
 */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.INVALID_ADDRESS]: 400,
  [ErrorCode.INVALID_AMOUNT]: 400,
  [ErrorCode.INVALID_SIGNATURE]: 400,
  [ErrorCode.INVALID_PROOF]: 400,
  [ErrorCode.INVALID_NODE_ID]: 400,
  [ErrorCode.INVALID_JOB_ID]: 400,
  [ErrorCode.INSUFFICIENT_FUNDS]: 400,
  [ErrorCode.INSUFFICIENT_STAKE]: 400,
  [ErrorCode.MODEL_NOT_SUPPORTED]: 400,
  [ErrorCode.PARAM_OUT_OF_RANGE]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.EXPIRED_TOKEN]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_NODE_OWNER]: 403,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.JOB_NOT_FOUND]: 404,
  [ErrorCode.NODE_NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.ENDPOINT_NOT_FOUND]: 404,
  [ErrorCode.JOB_ALREADY_ASSIGNED]: 409,
  [ErrorCode.JOB_ALREADY_COMPLETED]: 409,
  [ErrorCode.NODE_BUSY]: 409,
  [ErrorCode.NODE_OFFLINE]: 409,
  [ErrorCode.NODE_SUSPENDED]: 409,
  [ErrorCode.PROOF_VERIFICATION_FAILED]: 409,
  [ErrorCode.DISPUTE_PERIOD_ACTIVE]: 409,
  [ErrorCode.ALREADY_CLAIMED]: 409,
  [ErrorCode.NETWORK_ERROR]: 503,
  [ErrorCode.TIMEOUT]: 504,
  [ErrorCode.NODE_UNAVAILABLE]: 503,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BLOCKCHAIN_ERROR]: 500,
  [ErrorCode.ZK_VERIFICATION_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
};

/**
 * Base Synapse error class with structured error information
 * 
 * @class
 * @extends Error
 */
export class SynapseError extends Error {
  /**
   * Standardized error code
   * @readonly
   */
  readonly code: ErrorCode;
  
  /**
   * Additional context for debugging
   * @readonly
   */
  readonly details?: Record<string, unknown>;
  
  /**
   * Unique request ID for tracing
   * @readonly
   */
  readonly requestId: string;
  
  /**
   * Timestamp when error occurred
   * @readonly
   */
  readonly timestamp: Date;
  
  /**
   * HTTP status code (for API responses)
   * @readonly
   */
  readonly statusCode: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(message);
    this.name = 'SynapseError';
    this.code = code;
    this.details = details;
    this.requestId = requestId || generateRequestId();
    this.timestamp = new Date();
    this.statusCode = ERROR_STATUS_MAP[code] || 500;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SynapseError);
    }
  }

  /**
   * Convert to JSON-serializable format for API responses
   */
  toJSON(): {
    success: false;
    error: {
      code: ErrorCode;
      message: string;
      details?: Record<string, unknown>;
      requestId: string;
      timestamp: string;
    };
  } {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId: this.requestId,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }

  /**
   * Check if error is retryable (network/timeout errors)
   */
  isRetryable(): boolean {
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.NODE_UNAVAILABLE,
      ErrorCode.INTERNAL_ERROR,
    ].includes(this.code);
  }

  /**
   * Check if error is a validation error (client's fault)
   */
  isValidationError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500 && this.statusCode !== 429;
  }
}

/**
 * Validation error for input validation failures
 * @class
 * @extends SynapseError
 */
export class ValidationError extends SynapseError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(ErrorCode.INVALID_REQUEST, message, details, requestId);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error for auth failures
 * @class
 * @extends SynapseError
 */
export class AuthenticationError extends SynapseError {
  constructor(
    message = 'Authentication failed',
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(ErrorCode.UNAUTHORIZED, message, details, requestId);
    this.name = 'AuthenticationError';
  }
}

/**
 * Not found error for missing resources
 * @class
 * @extends SynapseError
 */
export class NotFoundError extends SynapseError {
  constructor(
    resource: string,
    identifier?: string,
    requestId?: string
  ) {
    super(
      ErrorCode.JOB_NOT_FOUND,
      `${resource}${identifier ? ` '${identifier}'` : ''} not found`,
      { resource, identifier },
      requestId
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Network error for connectivity issues
 * @class
 * @extends SynapseError
 */
export class NetworkError extends SynapseError {
  readonly retryAfter?: number;

  constructor(
    message = 'Network error occurred',
    retryAfter?: number,
    requestId?: string
  ) {
    super(ErrorCode.NETWORK_ERROR, message, { retryAfter }, requestId);
    this.name = 'NetworkError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout error for operation timeouts
 * @class
 * @extends SynapseError
 */
export class TimeoutError extends SynapseError {
  readonly timeoutMs: number;

  constructor(
    operation: string,
    timeoutMs: number,
    requestId?: string
  ) {
    super(
      ErrorCode.TIMEOUT,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      { operation, timeoutMs },
      requestId
    );
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Generate a unique request ID for error tracing
 * @internal
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Type guard to check if error is a SynapseError
 * 
 * @param error - Error to check
 * @returns True if error is a SynapseError
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isSynapseError(error)) {
 *     console.log(error.code); // Type-safe access
 *   }
 * }
 * ```
 */
export function isSynapseError(error: unknown): error is SynapseError {
  return error instanceof SynapseError;
}

/**
 * Convert unknown error to SynapseError
 * 
 * @param error - Unknown error to convert
 * @param fallbackCode - Error code to use if not a SynapseError
 * @returns SynapseError instance
 */
export function toSynapseError(
  error: unknown,
  fallbackCode: ErrorCode = ErrorCode.INTERNAL_ERROR
): SynapseError {
  if (isSynapseError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new SynapseError(fallbackCode, error.message);
  }
  
  return new SynapseError(fallbackCode, 'An unknown error occurred');
}
