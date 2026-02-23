import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SynapseSDK,
  SynapseError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  TimeoutError,
  createSynapseClient,
} from '../src/index';

// Mock fetch globally
global.fetch = vi.fn();

describe('SynapseSDK', () => {
  let sdk: SynapseSDK;

  beforeEach(() => {
    sdk = new SynapseSDK({ apiKey: 'test-api-key' });
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const client = new SynapseSDK({ apiKey: 'key' });
      expect(client).toBeDefined();
    });

    it('should accept custom config', () => {
      const client = new SynapseSDK({
        apiKey: 'key',
        baseUrl: 'https://custom.api.com',
        timeout: 30000,
        retries: 5,
      });
      expect(client).toBeDefined();
    });

    it('should create client via factory', () => {
      const client = createSynapseClient({ apiKey: 'key' });
      expect(client).toBeInstanceOf(SynapseSDK);
    });
  });

  describe('chat completion', () => {
    it('should send chat completion request', async () => {
      const mockResponse = {
        id: 'chat-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finishReason: 'stop',
          },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await sdk.chatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.synapse.ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('streaming', () => {
    it('should stream chat completion chunks', async () => {
      const chunks = [
        { id: '1', choices: [{ delta: { content: 'Hello' } }] },
        { id: '2', choices: [{ delta: { content: ' world' } }] },
        { id: '3', choices: [{ delta: { content: '!' }, finishReason: 'stop' }] },
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const results: any[] = [];
      for await (const chunk of sdk.streamChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('embeddings', () => {
    it('should create embeddings', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        model: 'text-embedding-3-small',
        usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await sdk.createEmbedding({
        model: 'text-embedding-3-small',
        input: 'Hello world',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should batch embeddings', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ object: 'embedding', embedding: [0.1], index: 0 }],
        model: 'text-embedding-3-small',
        usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 },
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const inputs = Array(150).fill('test');
      const results = await sdk.createEmbeddingsBatch(inputs, 'text-embedding-3-small');

      // Should make 2 requests (150 / 100 = 1.5, rounded up)
      expect(results.length).toBe(2);
    });
  });

  describe('models', () => {
    it('should list models', async () => {
      const mockModels = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          capabilities: ['chat', 'function-calling'],
          contextWindow: 8192,
          pricing: { input: 0.03, output: 0.06 },
          status: 'active',
        },
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      });

      const result = await sdk.listModels();
      expect(result).toEqual(mockModels);
    });

    it('should check model availability', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gpt-4', status: 'active' }),
      });

      const available = await sdk.isModelAvailable('gpt-4');
      expect(available).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      });

      await expect(
        sdk.chatCompletion({ model: 'gpt-4', messages: [] })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw RateLimitError on 429', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => '60' },
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      await expect(
        sdk.chatCompletion({ model: 'gpt-4', messages: [] })
      ).rejects.toThrow(RateLimitError);
    });

    it('should throw ValidationError on 422', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          error: { message: 'Invalid request', fieldErrors: { model: ['required'] } },
        }),
      });

      await expect(
        sdk.chatCompletion({ model: '', messages: [] })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw TimeoutError on timeout', async () => {
      (fetch as any).mockImplementationOnce(() => 
        new Promise((_, reject) => {
          const error = new Error('AbortError');
          (error as any).name = 'AbortError';
          reject(error);
        })
      );

      await expect(
        sdk.chatCompletion({ model: 'gpt-4', messages: [] })
      ).rejects.toThrow(TimeoutError);
    });
  });

  describe('batch operations', () => {
    it('should execute batch requests', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await sdk.batch({
        requests: [
          { method: 'GET', endpoint: '/models' },
          { method: 'GET', endpoint: '/models/gpt-4' },
        ],
        concurrency: 2,
      });

      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(2);
    });

    it('should batch completions with concurrency', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chat-1',
          choices: [{ message: { content: 'Test' } }],
          usage: { totalTokens: 10 },
        }),
      });

      const requests = Array(5).fill({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const results = await sdk.batchCompletions(requests, 2);
      expect(results.length).toBe(5);
    });
  });

  describe('usage', () => {
    it('should get usage stats', async () => {
      const mockUsage = {
        period: '2024-01',
        totalRequests: 1000,
        totalTokens: 50000,
        cost: 12.5,
        models: {
          'gpt-4': { requests: 500, tokens: 30000, cost: 10 },
          'gpt-3.5': { requests: 500, tokens: 20000, cost: 2.5 },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsage,
      });

      const result = await sdk.getUsage();
      expect(result).toEqual(mockUsage);
    });
  });
});