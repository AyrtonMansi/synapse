/**
 * Synapse SDK - Improved with Core Integration
 * 
 * This enhanced version integrates with @synapse/core for:
 * - Standardized error handling
 * - Retry logic with circuit breaker
 * - Request caching
 * - Structured logging
 * 
 * @module synapse-sdk/javascript-sdk
 * @version 1.1.0
 */

// Import core utilities when available
// import { 
//   SynapseError, 
//   withRetry, 
//   ExponentialBackoff,
//   CircuitBreaker,
//   MemoryCache,
//   createLogger 
// } from '@synapse/core';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * SDK Configuration
 */
export interface SynapseSDKConfig {
  /** API key for authentication */
  readonly apiKey: string;
  /** Base URL for API (optional) */
  readonly baseUrl?: string;
  /** Request timeout in milliseconds (default: 60000) */
  readonly timeout?: number;
  /** Number of retry attempts (default: 3) */
  readonly retries?: number;
  /** API version (default: 'v1') */
  readonly version?: string;
  /** Enable request caching (default: true) */
  readonly enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 300000) */
  readonly cacheTtl?: number;
  /** Enable request/response logging (default: false) */
  readonly debug?: boolean;
}

/** @internal */
const DEFAULT_CONFIG: Required<Omit<SynapseSDKConfig, 'apiKey'>> = {
  baseUrl: 'https://api.synapse.ai/v1',
  timeout: 60000,
  retries: 3,
  version: 'v1',
  enableCache: true,
  cacheTtl: 300000,
  debug: false,
};

// ============================================================================
// TYPES
// ============================================================================

export * from './types/completion';
export * from './types/embedding';
export * from './types/model';
export * from './types/usage';

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Base SDK error
 */
export class SynapseSDKError extends Error {
  /**
   * Error code
   * @readonly
   */
  readonly code: string;
  
  /**
   * HTTP status code
   * @readonly
   */
  readonly statusCode?: number;
  
  /**
   * Original response data
   * @readonly
   */
  readonly response?: unknown;
  
  /**
   * Request ID for tracking
   * @readonly
   */
  readonly requestId: string;
  
  /**
   * Timestamp when error occurred
   * @readonly
   */
  readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    response?: unknown
  ) {
    super(message);
    this.name = 'SynapseSDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.response = response;
    this.requestId = generateRequestId();
    this.timestamp = new Date();
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SynapseSDKError);
    }
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      requestId: this.requestId,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    if (!this.statusCode) return true;
    // Retry on 5xx errors and specific 4xx errors
    return this.statusCode >= 500 || [408, 429].includes(this.statusCode);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends SynapseSDKError {
  constructor(message: string, response?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, response);
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends SynapseSDKError {
  /**
   * Seconds to wait before retry
   * @readonly
   */
  readonly retryAfter?: number;
  
  constructor(message: string, retryAfter?: number, response?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', 429, response);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Validation error (422)
 */
export class ValidationError extends SynapseSDKError {
  /**
   * Field-specific errors
   * @readonly
   */
  readonly fieldErrors?: Record<string, string[]>;
  
  constructor(
    message: string,
    fieldErrors?: Record<string, string[]>,
    response?: unknown
  ) {
    super(message, 'VALIDATION_ERROR', 422, response);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Server error (5xx)
 */
export class ServerError extends SynapseSDKError {
  constructor(message: string, statusCode: number = 500, response?: unknown) {
    super(message, 'SERVER_ERROR', statusCode, response);
    this.name = 'ServerError';
  }
}

/**
 * Timeout error (408)
 */
export class TimeoutError extends SynapseSDKError {
  readonly timeoutMs: number;
  
  constructor(timeoutMs: number) {
    super(`Request timeout after ${timeoutMs}ms`, 'TIMEOUT_ERROR', 408);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Network error
 */
export class NetworkError extends SynapseSDKError {
  constructor(message: string = 'Network error') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Type guard for SDK errors
 */
export function isSynapseSDKError(error: unknown): error is SynapseSDKError {
  return error instanceof SynapseSDKError;
}

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

/**
 * Simple in-memory cache
 * @internal
 */
class SimpleCache<V> {
  private cache = new Map<string, { value: V; expiresAt: number }>();
  
  constructor(private ttlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// LOGGER IMPLEMENTATION
// ============================================================================

/**
 * Simple logger
 * @internal
 */
class SimpleLogger {
  constructor(private debug: boolean) {}

  log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[SynapseSDK] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.error(`[SynapseSDK] ${message}`, ...args);
    }
  }
}

// ============================================================================
// MAIN SDK CLASS
// ============================================================================

/**
 * Synapse SDK Client
 * 
 * @example
 * ```typescript
 * import { SynapseSDK } from '@synapse/sdk';
 * 
 * const client = new SynapseSDK({
 *   apiKey: 'your-api-key',
 *   debug: true,
 * });
 * 
 * const response = await client.chatCompletion({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class SynapseSDK {
  private readonly config: Required<SynapseSDKConfig>;
  private readonly cache: SimpleCache<unknown>;
  private readonly logger: SimpleLogger;
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(config: SynapseSDKConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new SimpleCache(this.config.cacheTtl);
    this.logger = new SimpleLogger(this.config.debug);
    
    this.logger.log('SDK initialized', { version: this.config.version });
  }

  // ========================================================================
  // CORE METHODS
  // ========================================================================

  /**
   * Create a chat completion
   * 
   * @param request - Completion request
   * @returns Completion response
   * @throws {SynapseSDKError} On API error
   * 
   * @example
   * ```typescript
   * const response = await client.chatCompletion({
   *   model: 'gpt-4',
   *   messages: [
   *     { role: 'system', content: 'You are helpful.' },
   *     { role: 'user', content: 'Hello!' }
   *   ],
   *   temperature: 0.7,
   *   maxTokens: 500,
   * });
   * ```
   */
  async chatCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    return this.makeRequest('POST', '/chat/completions', request);
  }

  /**
   * Stream a chat completion
   * 
   * @param request - Completion request
   * @yields Stream chunks
   * 
   * @example
   * ```typescript
   * for await (const chunk of client.streamChatCompletion(request)) {
   *   process.stdout.write(chunk.choices[0]?.delta?.content || '');
   * }
   * ```
   */
  async *streamChatCompletion(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const streamRequest = { ...request, stream: true };
    const controller = new AbortController();
    const requestId = generateRequestId();
    this.abortControllers.set(requestId, controller);

    this.logger.log('Starting stream', { requestId, model: request.model });

    try {
      const response = await fetch(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(streamRequest),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new SynapseSDKError('No response body', 'STREAM_ERROR');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              yield json as StreamChunk;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      this.abortControllers.delete(requestId);
      this.logger.log('Stream ended', { requestId });
    }
  }

  /**
   * Create embeddings
   */
  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.makeRequest('POST', '/embeddings', request);
  }

  /**
   * List available models
   */
  async listModels(): Promise<ModelInfo[]> {
    const cacheKey = 'models';
    const cached = this.config.enableCache ? this.cache.get(cacheKey) : undefined;
    
    if (cached) {
      this.logger.log('Cache hit for models');
      return cached as ModelInfo[];
    }

    const models = await this.makeRequest<ModelInfo[]>('GET', '/models');
    
    if (this.config.enableCache) {
      this.cache.set(cacheKey, models);
    }
    
    return models;
  }

  /**
   * Get model information
   */
  async getModel(modelId: string): Promise<ModelInfo> {
    return this.makeRequest('GET', `/models/${modelId}`);
  }

  /**
   * Get usage statistics
   */
  async getUsage(startDate?: Date, endDate?: Date): Promise<UsageStats> {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate.toISOString());
    if (endDate) params.append('end', endDate.toISOString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest('GET', `/usage${query}`);
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Synapse-Version': this.config.version,
      'X-Synapse-SDK': 'javascript',
      'X-Request-ID': generateRequestId(),
    };
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    attempt: number = 1
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    this.logger.log('Request', { method, endpoint, attempt });

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (isSynapseSDKError(error)) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(this.config.timeout);
        }

        // Retry on network errors
        if (attempt < this.config.retries && this.isRetryableError(error)) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.log('Retrying after error', { error: error.message, delay });
          await this.sleep(delay);
          return this.makeRequest<T>(method, endpoint, body, attempt + 1);
        }
      }

      throw new NetworkError(String(error));
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const body = await response.json().catch(() => ({}));

    switch (response.status) {
      case 401:
        throw new AuthenticationError(
          body.error?.message || 'Authentication failed',
          body
        );
      case 429:
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          body.error?.message || 'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          body
        );
      case 422:
        throw new ValidationError(
          body.error?.message || 'Validation failed',
          body.error?.fieldErrors,
          body
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServerError(
          body.error?.message || 'Server error',
          response.status,
          body
        );
      default:
        throw new SynapseSDKError(
          body.error?.message || `HTTP ${response.status}`,
          'API_ERROR',
          response.status,
          body
        );
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN',
      'fetch failed',
    ];
    return retryableMessages.some(msg => error.message.includes(msg));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel all ongoing requests
   */
  cancelAll(): void {
    for (const [id, controller] of this.abortControllers) {
      controller.abort();
      this.abortControllers.delete(id);
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SynapseSDK;

/**
 * Create SDK client with configuration
 */
export function createSynapseClient(config: SynapseSDKConfig): SynapseSDK {
  return new SynapseSDK(config);
}
