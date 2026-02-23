/**
 * Synapse JavaScript SDK
 * OpenAI-compatible client for Synapse Network
 * 
 * @example
 * import { Synapse } from '@synapse/sdk';
 * 
 * const synapse = new Synapse({
 *   apiKey: 'syn_live_...',
 *   baseURL: 'https://api.synapse.sh'
 * });
 * 
 * const response = await synapse.chat.completions.create({
 *   model: 'deepseek-v3',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 */

export interface SynapseConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  synapse_meta?: {
    requested_model: string;
    served_model: string;
    fallback: boolean;
    node_id: string;
  };
}

export class Synapse {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: SynapseConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.synapse.sh';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const fetchWithTimeout = (url: string, options: RequestInit): Promise<Response> => {
      return Promise.race([
        fetch(url, options),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), this.timeout)
        )
      ]);
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(
            `HTTP ${response.status}: ${error.error || response.statusText}`
          );
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error;
        }
        
        // Exponential backoff
        if (attempt < this.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Chat completions API
   */
  chat = {
    completions: {
      create: async (
        request: ChatCompletionRequest
      ): Promise<ChatCompletionResponse> => {
        return this.request<ChatCompletionResponse>('/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify(request)
        });
      },

      /**
       * Streaming chat completions
       */
      createStream: async function*(
        request: ChatCompletionRequest
      ): AsyncGenerator<ChatCompletionResponse, void, unknown> {
        // Implementation would use EventSource or fetch with streaming
        throw new Error('Streaming not yet implemented');
      }
    }
  };

  /**
   * Models API
   */
  models = {
    list: async (): Promise<{ data: Array<{ id: string; object: string }> }> => {
      return this.request('/v1/models');
    }
  };

  /**
   * Usage and billing
   */
  usage = {
    getStats: async (): Promise<{
      tokensUsed: number;
      tokensRemaining: number;
      costIncurred: number;
    }> => {
      // Would call usage endpoint
      throw new Error('Usage stats not yet implemented');
    }
  };
}

// Default export
export default Synapse;

// CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Synapse };
}
