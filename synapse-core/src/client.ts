import { z } from 'zod';
import type { 
  ApiResponse, 
  ApiError, 
  InferenceJob, 
  JobResult,
  NodeInfo,
  SynapseConfig,
  NetworkMetrics 
} from './types.js';

/**
 * Synapse API Client
 * 
 * AUDIT: This is the primary interface for developers. All methods must:
 * 1. Validate inputs before sending
 * 2. Handle network failures gracefully with exponential backoff
 * 3. Never expose API keys in error messages
 * 4. Provide request IDs for debugging without logging sensitive data
 */

const DEFAULT_CONFIG: Partial<SynapseConfig> = {
  baseUrl: 'https://api.synapse.network/v1',
  timeoutMs: 30000,
  maxRetries: 3,
  chainId: 1,  // Ethereum mainnet (configurable for testnets)
};

/**
 * Input validation schemas for API methods
 * Prevents injection attacks and malformed requests
 */
const CreateJobSchema = z.object({
  modelId: z.string().min(1).max(64),
  prompt: z.string().min(1).max(100000),  // 100KB max prompt
  maxTokens: z.number().int().min(1).max(8192).default(1024),
  temperature: z.number().min(0).max(2).default(0.7),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

export class SynapseClient {
  private readonly config: SynapseConfig;
  private readonly headers: Record<string, string>;
  private requestCounter = 0;

  constructor(config: Partial<SynapseConfig> & { apiKey: string }) {
    // AUDIT: Merge with defaults and validate required fields
    this.config = { ...DEFAULT_CONFIG, ...config } as SynapseConfig;
    
    if (!this.config.apiKey || this.config.apiKey.length < 32) {
      throw new SynapseValidationError('Invalid API key format');
    }

    this.headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Synapse-Client': 'js-sdk/1.0.0',
    };
  }

  /**
   * Submit an inference job to the mesh
   * 
   * AUDIT: This is the primary attack surface. Input validation and
   * rate limiting are critical to prevent spam and resource exhaustion.
   */
  async createJob(
    params: z.infer<typeof CreateJobSchema>
  ): Promise<ApiResponse<InferenceJob>> {
    // Validate input
    const validated = CreateJobSchema.safeParse(params);
    if (!validated.success) {
      return this.createErrorResponse(
        'INVALID_REQUEST',
        validated.error.message,
        validated.error.flatten()
      );
    }

    const requestId = this.generateRequestId();

    try {
      const response = await this.fetchWithRetry('/jobs', {
        method: 'POST',
        body: JSON.stringify(validated.data),
      }, requestId);

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        return this.createErrorResponse(error.code, error.message, undefined, requestId);
      }

      const data = await response.json();
      return {
        success: true,
        data: this.deserializeJob(data),
        requestId,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleNetworkError(error, requestId);
    }
  }

  /**
   * Poll for job result
   * 
   * AUDIT: Polling must have backoff to prevent thundering herd.
   * Exponential backoff with jitter spreads load across time.
   */
  async getJobResult(
    jobId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<ApiResponse<JobResult>> {
    const requestId = this.generateRequestId();
    const timeout = options.timeoutMs ?? 120000;  // 2 min default
    const interval = options.pollIntervalMs ?? 1000;
    const startTime = Date.now();

    // AUDIT: Validate jobId format to prevent path traversal
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
      return this.createErrorResponse('INVALID_REQUEST', 'Invalid job ID format', undefined, requestId);
    }

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.fetchWithRetry(`/jobs/${jobId}/result`, {
          method: 'GET',
        }, requestId);

        if (response.status === 202) {
          // Job still processing - implement exponential backoff
          const backoffMs = Math.min(interval * Math.pow(1.5, (Date.now() - startTime) / 10000), 10000);
          await this.sleep(backoffMs + Math.random() * 100);  // Add jitter
          continue;
        }

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          return this.createErrorResponse(error.code, error.message, undefined, requestId);
        }

        const data = await response.json();
        return {
          success: true,
          data: this.deserializeResult(data),
          requestId,
          timestamp: new Date(),
        };
      } catch (error) {
        return this.handleNetworkError(error, requestId);
      }
    }

    return this.createErrorResponse('INTERNAL_ERROR', 'Job result polling timeout', undefined, requestId);
  }

  /**
   * List available nodes and their status
   * 
   * AUDIT: Node list is public information but must be cached to
   * prevent DoS on the registry. Client-side caching reduces server load.
   */
  async listNodes(options: { 
    region?: string; 
    modelId?: string; 
    minReputation?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<NodeInfo[]>> {
    const requestId = this.generateRequestId();
    
    const params = new URLSearchParams();
    if (options.region) params.set('region', options.region);
    if (options.modelId) params.set('modelId', options.modelId);
    if (options.minReputation) params.set('minReputation', String(options.minReputation));
    if (options.limit) params.set('limit', String(Math.min(options.limit, 100)));  // Max 100

    try {
      const response = await this.fetchWithRetry(`/nodes?${params}`, {
        method: 'GET',
      }, requestId);

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        return this.createErrorResponse(error.code, error.message, undefined, requestId);
      }

      const data = await response.json() as { nodes: unknown[] };
      return {
        success: true,
        data: data.nodes.map((n: unknown) => this.deserializeNode(n)),
        requestId,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleNetworkError(error, requestId);
    }
  }

  /**
   * Get network-wide metrics
   */
  async getMetrics(): Promise<ApiResponse<NetworkMetrics>> {
    const requestId = this.generateRequestId();

    try {
      const response = await this.fetchWithRetry('/metrics', {
        method: 'GET',
      }, requestId);

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        return this.createErrorResponse(error.code, error.message, undefined, requestId);
      }

      const data = await response.json();
      return {
        success: true,
        data: this.deserializeMetrics(data),
        requestId,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleNetworkError(error, requestId);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Fetch with exponential backoff retry
   * 
   * AUDIT: Retry logic prevents transient failures from breaking UX,
   * but must not amplify errors. Exponential backoff prevents thundering herd.
   */
  private async fetchWithRetry(
    path: string,
    options: RequestInit,
    requestId: string,
    attempt = 1
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, 'X-Request-ID': requestId },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // AUDIT: Don't retry 4xx errors (client's fault)
      if (!response.ok && response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on 5xx or network errors
      if (!response.ok && attempt < this.config.maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await this.sleep(backoffMs);
        return this.fetchWithRetry(path, options, requestId, attempt + 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network errors
      if (attempt < this.config.maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await this.sleep(backoffMs);
        return this.fetchWithRetry(path, options, requestId, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Parse error response from server
   * AUDIT: Error responses must not leak sensitive internal details
   */
  private async parseErrorResponse(response: Response): Promise<ApiError> {
    try {
      const body = await response.json() as { code?: string; message?: string; details?: Record<string, unknown> };
      return {
        code: (body.code as ApiError['code']) || 'INTERNAL_ERROR',
        message: body.message || 'An unexpected error occurred',
        details: body.details,
      };
    } catch {
      return {
        code: 'INTERNAL_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  }

  private handleNetworkError(error: unknown, requestId: string): ApiResponse<never> {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return this.createErrorResponse('INTERNAL_ERROR', 'Request timeout', undefined, requestId);
      }
      return this.createErrorResponse('INTERNAL_ERROR', error.message, undefined, requestId);
    }
    return this.createErrorResponse('INTERNAL_ERROR', 'Unknown error', undefined, requestId);
  }

  private createErrorResponse(
    code: ApiError['code'],
    message: string,
    details?: Record<string, unknown>,
    requestId?: string
  ): ApiResponse<never> {
    return {
      success: false,
      error: { code, message, details },
      requestId: requestId || this.generateRequestId(),
      timestamp: new Date(),
    };
  }

  private generateRequestId(): string {
    return `req_${++this.requestCounter}_${Date.now().toString(36)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // DESERIALIZATION (sanitize external data)
  // ============================================================================

  private deserializeJob(data: unknown): InferenceJob {
    // AUDIT: Validate all fields even if server sent them
    // Prevents type confusion attacks
    if (typeof data !== 'object' || data === null) {
      throw new SynapseValidationError('Invalid job data format');
    }
    const d = data as Record<string, unknown>;
    
    return {
      id: String(d.id),
      modelId: String(d.modelId),
      prompt: String(d.prompt),
      maxTokens: Number(d.maxTokens),
      temperature: Number(d.temperature),
      userAddress: String(d.userAddress),
      maxPrice: String(d.maxPrice),
      priority: d.priority as InferenceJob['priority'],
      createdAt: new Date(String(d.createdAt)),
      expiresAt: new Date(String(d.expiresAt)),
      status: d.status as InferenceJob['status'],
      result: d.result ? this.deserializeResult(d.result) : undefined,
    };
  }

  private deserializeResult(data: unknown): JobResult {
    if (typeof data !== 'object' || data === null) {
      throw new SynapseValidationError('Invalid result data format');
    }
    const d = data as Record<string, unknown>;

    return {
      output: String(d.output),
      tokensUsed: Number(d.tokensUsed),
      computeTimeMs: Number(d.computeTimeMs),
      nodeId: String(d.nodeId),
      completedAt: new Date(String(d.completedAt)),
      proof: {
        proof: String(d.proof),
        publicInputs: Array.isArray(d.publicInputs) ? d.publicInputs.map(String) : [],
        verifierContract: String(d.verifierContract),
      },
    };
  }

  private deserializeNode(data: unknown): NodeInfo {
    if (typeof data !== 'object' || data === null) {
      throw new SynapseValidationError('Invalid node data format');
    }
    const d = data as Record<string, unknown>;

    return {
      id: String(d.id),
      address: String(d.address),
      endpoint: String(d.endpoint),
      capabilities: {
        gpuModel: String(d.gpuModel),
        vramGB: Number(d.vramGB),
        supportedModels: Array.isArray(d.supportedModels) ? d.supportedModels.map(String) : [],
        maxConcurrentJobs: Number(d.maxConcurrentJobs),
        region: String(d.region),
      },
      status: d.status as NodeInfo['status'],
      reputation: {
        totalJobs: Number(d.totalJobs),
        successfulJobs: Number(d.successfulJobs),
        failedJobs: Number(d.failedJobs),
        averageLatencyMs: Number(d.averageLatencyMs),
        score: Number(d.score),
        lastUpdated: new Date(String(d.lastUpdated)),
      },
      registeredAt: new Date(String(d.registeredAt)),
      lastSeen: new Date(String(d.lastSeen)),
    };
  }

  private deserializeMetrics(data: unknown): NetworkMetrics {
    if (typeof data !== 'object' || data === null) {
      throw new SynapseValidationError('Invalid metrics data format');
    }
    const d = data as Record<string, unknown>;

    return {
      totalNodes: Number(d.totalNodes),
      onlineNodes: Number(d.onlineNodes),
      totalJobs24h: Number(d.totalJobs24h),
      averageLatencyMs: Number(d.averageLatencyMs),
      totalVolume24h: String(d.totalVolume24h),
      activeUsers24h: Number(d.activeUsers24h),
    };
  }
}

/**
 * Custom error classes for better error handling
 */
export class SynapseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SynapseError';
  }
}

export class SynapseValidationError extends SynapseError {
  constructor(message: string) {
    super(message);
    this.name = 'SynapseValidationError';
  }
}
