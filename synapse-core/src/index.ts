/**
 * Synapse Core SDK
 * 
 * @packageDocumentation
 * @module synapse-core
 * 
 * Core library for interacting with the Synapse decentralized compute network.
 * Provides type-safe interfaces for jobs, nodes, payments, and network operations.
 * 
 * @example
 * ```typescript
 * import { SynapseClient, SynapseError } from '@synapse/core';
 * 
 * const client = new SynapseClient({ apiKey: 'your-api-key' });
 * 
 * try {
 *   const job = await client.createJob({
 *     modelId: 'llama-2-70b',
 *     prompt: 'Explain quantum computing',
 *     maxTokens: 1000,
 *   });
 *   console.log(`Job created: ${job.id}`);
 * } catch (error) {
 *   if (error instanceof SynapseError) {
 *     console.error(`Error ${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */

// Core modules
export * from './types.js';
export * from './client.js';
export * from './contracts.js';
export * from './mesh.js';

// Error handling
export {
  // Error classes
  SynapseError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  // Error utilities
  isSynapseError,
  toSynapseError,
} from './errors.js';
export { ErrorCode, ERROR_STATUS_MAP } from './errors.js';
export type { ErrorCode as ErrorCodeType } from './errors.js';

// Retry logic
export {
  withRetry,
  withTimeout,
  Retryable,
  CircuitBreaker,
  ExponentialBackoff,
  LinearBackoff,
  FixedBackoff,
  sleep,
} from './retry.js';
export type {
  RetryConfig,
  BackoffStrategy,
  CircuitBreakerConfig,
} from './retry.js';

// Caching
export {
  MemoryCache,
  memoize,
  Cached,
  CacheKeyBuilder,
  DEFAULT_CACHE_CONFIG,
} from './cache.js';
export type { CacheConfig, CacheStats } from './cache.js';

// Validation utilities
export {
  validateAddress,
  validateTokenAmount,
  validateJobId,
  validateNodeId,
  isValidAddress,
  isValidTokenAmount,
} from './validation.js';

// Logging utilities
export {
  createLogger,
  LogLevel,
  type Logger,
} from './logger.js';

// Utility types
export type {
  DeepPartial,
  DeepReadonly,
  Optional,
  Nullable,
  NonNullable,
  AsyncReturnType,
  ValueOf,
  KeysOf,
} from './utils/types.js';
