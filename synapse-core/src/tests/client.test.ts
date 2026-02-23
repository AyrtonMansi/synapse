import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { SynapseClient } from '../client.js';
import type { InferenceJob, SynapseConfig } from '../types.js';

/**
 * Comprehensive Test Suite for Synapse Core
 * 
 * AUDIT: Every critical path must have tests. Test coverage targets:
 * - Input validation: 100%
 * - Error handling: 100%
 * - Financial calculations: 100%
 * - Security boundaries: 100%
 */

describe('SynapseClient', () => {
  let client: SynapseClient;
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new SynapseClient({
      apiKey: 'hsk_test_valid_api_key_that_is_long_enough_32chars',
      baseUrl: 'https://api.test.synapse.network/v1',
    });
  });

  // ============================================================================
  // CONSTRUCTOR TESTS
  // ============================================================================
  
  describe('constructor', () => {
    it('should create client with valid API key', () => {
      expect(() => new SynapseClient({
        apiKey: 'hsk_test_valid_api_key_that_is_long_enough_32chars',
      })).not.toThrow();
    });

    it('should reject short API key', () => {
      expect(() => new SynapseClient({
        apiKey: 'short_key',
      })).toThrow('Invalid API key format');
    });

    it('should reject empty API key', () => {
      expect(() => new SynapseClient({
        apiKey: '',
      })).toThrow('Invalid API key format');
    });

    it('should apply default config values', () => {
      const c = new SynapseClient({
        apiKey: 'hsk_test_valid_api_key_that_is_long_enough_32chars',
      });
      // Access private config for testing
      expect((c as any).config.timeoutMs).toBe(30000);
      expect((c as any).config.maxRetries).toBe(3);
    });
  });

  // ============================================================================
  // CREATE JOB TESTS
  // ============================================================================

  describe('createJob', () => {
    const validJob = {
      modelId: 'deepseek-v2',
      prompt: 'Write a Python function',
      maxTokens: 1024,
      temperature: 0.7,
      priority: 'normal' as const,
    };

    it('should create job with valid params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'job_123',
          modelId: 'deepseek-v2',
          prompt: 'Write a Python function',
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      const result = await client.createJob(validJob);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('pending');
    });

    it('should reject job with empty prompt', async () => {
      const result = await client.createJob({
        ...validJob,
        prompt: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });

    it('should reject job with oversized prompt', async () => {
      const result = await client.createJob({
        ...validJob,
        prompt: 'x'.repeat(100001),
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });

    it('should reject negative temperature', async () => {
      const result = await client.createJob({
        ...validJob,
        temperature: -0.5,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });

    it('should reject excessive maxTokens', async () => {
      const result = await client.createJob({
        ...validJob,
        maxTokens: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });

    it('should handle server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          code: 'INTERNAL_ERROR',
          message: 'Database connection failed',
        }),
      });

      const result = await client.createJob(validJob);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    it('should handle network timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await client.createJob(validJob);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    it('should retry on transient failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'job_123',
            modelId: 'deepseek-v2',
            prompt: 'Write a Python function',
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
        });

      const result = await client.createJob(validJob);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // GET JOB RESULT TESTS
  // ============================================================================

  describe('getJobResult', () => {
    const mockResult = {
      output: 'Here is the Python function...',
      tokensUsed: 150,
      computeTimeMs: 850,
      nodeId: 'node_abc',
      completedAt: new Date().toISOString(),
      proof: {
        proof: '0x1234...',
        publicInputs: ['input_hash', 'output_hash'],
        verifierContract: '0x5678...',
      },
    };

    it('should return result when job complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResult),
      });

      const result = await client.getJobResult('job_123');

      expect(result.success).toBe(true);
      expect(result.data?.output).toBe(mockResult.output);
    });

    it('should poll until job complete', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 202,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 202,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResult),
        });

      const result = await client.getJobResult('job_123', { pollIntervalMs: 100 });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should timeout if job takes too long', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 202,
        json: () => Promise.resolve({}),
      });

      const result = await client.getJobResult('job_123', { 
        timeoutMs: 500,
        pollIntervalMs: 100 
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('should reject invalid jobId format', async () => {
      const result = await client.getJobResult('../../../etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });
  });

  // ============================================================================
  // LIST NODES TESTS
  // ============================================================================

  describe('listNodes', () => {
    const mockNodes = [
      {
        id: 'node_1',
        address: '0x1234567890123456789012345678901234567890',
        endpoint: '192.168.1.1:8080',
        capabilities: {
          gpuModel: 'RTX 4090',
          vramGB: 24,
          supportedModels: ['llama-3', 'deepseek-v2'],
          maxConcurrentJobs: 4,
          region: 'us-east',
        },
        status: 'online',
        reputation: {
          totalJobs: 1000,
          successfulJobs: 995,
          failedJobs: 5,
          averageLatencyMs: 150,
          score: 995,
          lastUpdated: new Date().toISOString(),
        },
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      },
    ];

    it('should list all nodes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nodes: mockNodes }),
      });

      const result = await client.listNodes();

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].id).toBe('node_1');
    });

    it('should filter by region', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nodes: mockNodes }),
      });

      await client.listNodes({ region: 'us-east' });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('region=us-east');
    });

    it('should limit results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nodes: mockNodes }),
      });

      await client.listNodes({ limit: 50 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('limit=50');
    });

    it('should enforce max limit of 100', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ nodes: [] }),
      });

      await client.listNodes({ limit: 500 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('limit=100');
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('error handling', () => {
    it('should include requestId in all responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'job_123',
          modelId: 'deepseek-v2',
          prompt: 'test',
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        }),
      });

      const result = await client.createJob({
        modelId: 'deepseek-v2',
        prompt: 'test',
      });

      expect(result.requestId).toBeDefined();
      expect(result.requestId).toMatch(/^req_\d+_/);
    });

    it('should not expose API key in errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await client.createJob({
        modelId: 'deepseek-v2',
        prompt: 'test',
      });

      expect(result.error?.message).not.toContain('apiKey');
      expect(result.error?.message).not.toContain('hsk_');
    });
  });
});

// ============================================================================
// TYPE VALIDATION TESTS
// ============================================================================

describe('Type Validation', () => {
  describe('TokenAmountSchema', () => {
    const TokenAmountSchema = z.string().regex(
      /^\d+(\.\d{1,18})?$/,
      'Invalid token amount format'
    );

    it('should accept valid integer amount', () => {
      expect(() => TokenAmountSchema.parse('100')).not.toThrow();
    });

    it('should accept valid decimal amount', () => {
      expect(() => TokenAmountSchema.parse('100.5')).not.toThrow();
    });

    it('should accept max 18 decimals', () => {
      expect(() => TokenAmountSchema.parse('1.123456789012345678')).not.toThrow();
    });

    it('should reject more than 18 decimals', () => {
      expect(() => TokenAmountSchema.parse('1.1234567890123456789')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => TokenAmountSchema.parse('')).toThrow();
    });
  });

  describe('AddressSchema', () => {
    it('should validate Ethereum address format', () => {
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      
      // Valid addresses (40 hex chars after 0x)
      expect(addressRegex.test('0x742d35Cc6634C0532925a3b844Bc9e7595f8dEef')).toBe(true);
      expect(addressRegex.test('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
      
      // Invalid addresses
      expect(addressRegex.test('742d35Cc6634C0532925a3b844Bc9e7595f8dEef')).toBe(false);
      expect(addressRegex.test('0x742d35Cc6634')).toBe(false);
      expect(addressRegex.test('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false);
    });
  });
});

// ============================================================================
// SECURITY TESTS
// ============================================================================

describe('Security', () => {
  describe('Input sanitization', () => {
    it('should sanitize jobId to prevent path traversal', async () => {
      const client = new SynapseClient({
        apiKey: 'hsk_test_valid_api_key_that_is_long_enough_32chars',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ code: 'INVALID_REQUEST', message: 'Bad request' }),
      });
      global.fetch = mockFetch;

      const result = await client.getJobResult('../../../etc/passwd');
      
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should limit prompt size to prevent DoS', async () => {
      const client = new SynapseClient({
        apiKey: 'hsk_test_valid_api_key_that_is_long_enough_32chars',
      });

      const largePrompt = 'x'.repeat(1000000);  // 1MB

      const result = await client.createJob({
        modelId: 'deepseek-v2',
        prompt: largePrompt,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });
  });
});
