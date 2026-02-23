/**
 * Retry Utilities with Exponential Backoff
 * 
 * @module synapse-core/retry
 * @description Resilient retry logic for network and transient failures
 * 
 * @example
 * ```typescript
 * import { withRetry, ExponentialBackoff } from '@synapse/core/retry';
 * 
 * const result = await withRetry(
 *   () => fetchData(),
 *   new ExponentialBackoff({ maxRetries: 3, baseDelay: 1000 })
 * );
 * ```
 */

import { SynapseError, ErrorCode, NetworkError, TimeoutError } from './errors.js';

/**
 * Configuration options for retry behavior
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries: number;
  
  /**
   * Initial delay between retries in milliseconds
   * @default 1000
   */
  baseDelay: number;
  
  /**
   * Maximum delay between retries in milliseconds
   * @default 30000
   */
  maxDelay: number;
  
  /**
   * Factor to multiply delay by after each retry
   * @default 2
   */
  backoffFactor: number;
  
  /**
   * Whether to add random jitter to delays
   * @default true
   */
  jitter: boolean;
  
  /**
   * Function to determine if error is retryable
   */
  retryableError?: (error: unknown) => boolean;
  
  /**
   * Function called before each retry attempt
   */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
};

/**
 * Backoff strategy for calculating retry delays
 */
export interface BackoffStrategy {
  /**
   * Calculate delay for a specific retry attempt
   * @param attempt - Current attempt number (0-indexed)
   * @returns Delay in milliseconds
   */
  calculateDelay(attempt: number): number;
}

/**
 * Exponential backoff with optional jitter
 * @class
 */
export class ExponentialBackoff implements BackoffStrategy {
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Calculate delay using exponential backoff formula
   * delay = min(baseDelay * factor^attempt + jitter, maxDelay)
   */
  calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt);
    const jitter = this.config.jitter ? Math.random() * 1000 : 0;
    return Math.min(exponentialDelay + jitter, this.config.maxDelay);
  }
}

/**
 * Linear backoff strategy
 * @class
 */
export class LinearBackoff implements BackoffStrategy {
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Calculate delay using linear formula
   * delay = min(baseDelay * (attempt + 1) + jitter, maxDelay)
   */
  calculateDelay(attempt: number): number {
    const linearDelay = this.config.baseDelay * (attempt + 1);
    const jitter = this.config.jitter ? Math.random() * 500 : 0;
    return Math.min(linearDelay + jitter, this.config.maxDelay);
  }
}

/**
 * Fixed backoff strategy (constant delay)
 * @class
 */
export class FixedBackoff implements BackoffStrategy {
  private readonly delay: number;

  constructor(delay: number) {
    this.delay = delay;
  }

  calculateDelay(): number {
    return this.delay;
  }
}

/**
 * Circuit breaker states
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Number of failures before opening circuit
   * @default 5
   */
  failureThreshold: number;
  
  /**
   * Time in milliseconds before attempting reset
   * @default 30000
   */
  resetTimeoutMs: number;
  
  /**
   * Number of successes required to close circuit
   * @default 3
   */
  successThreshold: number;
}

/**
 * Circuit breaker pattern for preventing cascade failures
 * @class
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      successThreshold: 3,
      ...config,
    };
  }

  /**
   * Execute function with circuit breaker protection
   * @template T Return type
   * @param fn - Function to execute
   * @returns Promise resolving to function result
   * @throws SynapseError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new SynapseError(
          ErrorCode.NODE_UNAVAILABLE,
          'Circuit breaker is OPEN - too many failures'
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force circuit to closed state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }
}

/**
 * Default retryable error checker
 */
function defaultRetryableError(error: unknown): boolean {
  if (error instanceof SynapseError) {
    return error.isRetryable();
  }
  
  if (error instanceof Error) {
    // Network-related errors
    const networkErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      'NETWORK_ERROR',
      'TIMEOUT',
    ];
    return networkErrors.some(code => 
      error.message.includes(code) || 
      (error as Error & { code?: string }).code === code
    );
  }
  
  return false;
}

/**
 * Sleep/delay utility
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
 * 
 * @template T Return type
 * @param fn - Function to execute with retry
 * @param backoff - Backoff strategy instance
 * @param config - Additional retry configuration
 * @returns Promise resolving to function result
 * @throws Last error encountered if all retries fail
 * 
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetchFromAPI(),
 *   new ExponentialBackoff({ maxRetries: 5 }),
 *   { onRetry: (e, attempt) => console.log(`Retry ${attempt}: ${e.message}`) }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  backoff: BackoffStrategy = new ExponentialBackoff(),
  config?: Partial<Omit<RetryConfig, 'maxRetries' | 'baseDelay' | 'maxDelay' | 'backoffFactor'>> & { maxRetries?: number }
): Promise<T> {
  const maxRetries = config?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries;
  const isRetryable = config?.retryableError ?? defaultRetryableError;
  const onRetry = config?.onRetry;

  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if error is not retryable
      if (!isRetryable(error)) {
        throw error;
      }
      
      // Don't retry after last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = backoff.calculateDelay(attempt);
      
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Retry decorator for class methods
 * 
 * @param backoff - Backoff strategy
 * @param config - Retry configuration
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class APIClient {
 *   @Retryable(new ExponentialBackoff({ maxRetries: 3 }))
 *   async fetchData() {
 *     // This will be retried on failure
 *   }
 * }
 * ```
 */
export function Retryable(
  backoff: BackoffStrategy = new ExponentialBackoff(),
  config?: Partial<RetryConfig>
): MethodDecorator {
  return function(
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(this: unknown, ...args: unknown[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        backoff,
        config
      );
    };
  };
}

/**
 * Timeout wrapper for promises
 * 
 * @template T Return type
 * @param promise - Promise to wrap with timeout
 * @param ms - Timeout in milliseconds
 * @param operation - Operation name for error message
 * @returns Promise resolving to original result
 * @throws TimeoutError if operation exceeds timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(operation, ms));
      }, ms);
    }),
  ]);
}
