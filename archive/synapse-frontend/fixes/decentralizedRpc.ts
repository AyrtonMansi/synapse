/**
 * Decentralized RPC Provider
 * Implements multi-RPC fallback with rotation and user-defined endpoints
 * Reduces reliance on single centralized RPC provider
 */

import { createPublicClient, http, fallback, PublicClient, HttpTransport } from 'viem';
import type { Chain } from 'viem/chains';

interface RpcEndpoint {
  url: string;
  priority: number;
  weight: number;
  isCustom?: boolean;
}

interface RpcConfig {
  endpoints: RpcEndpoint[];
  timeout: number;
  retryCount: number;
}

// Default RPC endpoints by chain
const DEFAULT_RPC_ENDPOINTS: Record<number, RpcEndpoint[]> = {
  // Ethereum Mainnet
  1: [
    { url: 'https://rpc.ankr.com/eth', priority: 1, weight: 2 },
    { url: 'https://ethereum.publicnode.com', priority: 2, weight: 2 },
    { url: 'https://eth.llamarpc.com', priority: 3, weight: 1 },
    { url: 'https://cloudflare-eth.com', priority: 4, weight: 1 },
  ],
  // Sepolia
  11155111: [
    { url: 'https://rpc.ankr.com/eth_sepolia', priority: 1, weight: 2 },
    { url: 'https://ethereum-sepolia.publicnode.com', priority: 2, weight: 2 },
  ],
  // Arbitrum
  42161: [
    { url: 'https://rpc.ankr.com/arbitrum', priority: 1, weight: 2 },
    { url: 'https://arbitrum.publicnode.com', priority: 2, weight: 2 },
    { url: 'https://arb1.arbitrum.io/rpc', priority: 3, weight: 1 },
  ],
  // Arbitrum Sepolia
  421614: [
    { url: 'https://sepolia-rollup.arbitrum.io/rpc', priority: 1, weight: 2 },
  ],
  // Base
  8453: [
    { url: 'https://rpc.ankr.com/base', priority: 1, weight: 2 },
    { url: 'https://base.publicnode.com', priority: 2, weight: 2 },
    { url: 'https://mainnet.base.org', priority: 3, weight: 1 },
  ],
  // Base Sepolia
  84532: [
    { url: 'https://sepolia.base.org', priority: 1, weight: 2 },
  ],
  // Polygon
  137: [
    { url: 'https://rpc.ankr.com/polygon', priority: 1, weight: 2 },
    { url: 'https://polygon.publicnode.com', priority: 2, weight: 2 },
    { url: 'https://polygon-rpc.com', priority: 3, weight: 1 },
  ],
  // Mumbai
  80001: [
    { url: 'https://rpc.ankr.com/polygon_mumbai', priority: 1, weight: 2 },
  ],
};

class DecentralizedRpcProvider {
  private customEndpoints: Map<number, RpcEndpoint[]> = new Map();
  private preferredEndpoints: Map<number, string> = new Map();
  private failedEndpoints: Map<string, number> = new Map();
  private readonly MAX_FAILURES = 3;
  private readonly FAILURE_RESET_TIME = 5 * 60 * 1000; // 5 minutes

  /**
   * Add a custom RPC endpoint for a chain
   */
  addCustomEndpoint(chainId: number, url: string): void {
    const endpoint: RpcEndpoint = {
      url,
      priority: 0, // Custom endpoints have highest priority
      weight: 5,
      isCustom: true,
    };

    const existing = this.customEndpoints.get(chainId) || [];
    existing.push(endpoint);
    this.customEndpoints.set(chainId, existing);

    // Store in localStorage for persistence
    this.saveCustomEndpoints();
  }

  /**
   * Remove a custom RPC endpoint
   */
  removeCustomEndpoint(chainId: number, url: string): void {
    const existing = this.customEndpoints.get(chainId) || [];
    const filtered = existing.filter(e => e.url !== url);
    this.customEndpoints.set(chainId, filtered);
    this.saveCustomEndpoints();
  }

  /**
   * Set preferred RPC endpoint
   */
  setPreferredEndpoint(chainId: number, url: string): void {
    this.preferredEndpoints.set(chainId, url);
    localStorage.setItem(`synapse-preferred-rpc-${chainId}`, url);
  }

  /**
   * Get preferred RPC endpoint
   */
  getPreferredEndpoint(chainId: number): string | null {
    // Check memory first
    const preferred = this.preferredEndpoints.get(chainId);
    if (preferred) return preferred;

    // Check localStorage
    const stored = localStorage.getItem(`synapse-preferred-rpc-${chainId}`);
    if (stored) {
      this.preferredEndpoints.set(chainId, stored);
      return stored;
    }

    return null;
  }

  /**
   * Load custom endpoints from localStorage
   */
  private loadCustomEndpoints(): void {
    try {
      const stored = localStorage.getItem('synapse-custom-rpc-endpoints');
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [chainId, endpoints] of Object.entries(parsed)) {
          this.customEndpoints.set(Number(chainId), endpoints as RpcEndpoint[]);
        }
      }
    } catch (error) {
      console.error('Failed to load custom RPC endpoints:', error);
    }
  }

  /**
   * Save custom endpoints to localStorage
   */
  private saveCustomEndpoints(): void {
    try {
      const data: Record<string, RpcEndpoint[]> = {};
      for (const [chainId, endpoints] of this.customEndpoints.entries()) {
        data[chainId] = endpoints;
      }
      localStorage.setItem('synapse-custom-rpc-endpoints', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save custom RPC endpoints:', error);
    }
  }

  /**
   * Mark an endpoint as failed
   */
  private markEndpointFailed(url: string): void {
    const failures = (this.failedEndpoints.get(url) || 0) + 1;
    this.failedEndpoints.set(url, failures);

    // Reset after some time
    setTimeout(() => {
      this.failedEndpoints.delete(url);
    }, this.FAILURE_RESET_TIME);
  }

  /**
   * Check if endpoint is healthy
   */
  private isEndpointHealthy(url: string): boolean {
    const failures = this.failedEndpoints.get(url) || 0;
    return failures < this.MAX_FAILURES;
  }

  /**
   * Get all available endpoints for a chain
   */
  getEndpoints(chainId: number): RpcEndpoint[] {
    const defaults = DEFAULT_RPC_ENDPOINTS[chainId] || [];
    const customs = this.customEndpoints.get(chainId) || [];

    // Filter out unhealthy endpoints
    const allEndpoints = [...customs, ...defaults].filter(e =>
      this.isEndpointHealthy(e.url)
    );

    // Sort by priority
    return allEndpoints.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Create a viem public client with fallback RPC
   */
  createClient(chain: Chain, options: { timeout?: number; batch?: boolean } = {}): PublicClient {
    const endpoints = this.getEndpoints(chain.id);

    if (endpoints.length === 0) {
      throw new Error(`No healthy RPC endpoints available for chain ${chain.id}`);
    }

    // Check for preferred endpoint
    const preferred = this.getPreferredEndpoint(chain.id);
    if (preferred) {
      // Move preferred to front
      const preferredIndex = endpoints.findIndex(e => e.url === preferred);
      if (preferredIndex > 0) {
        const [endpoint] = endpoints.splice(preferredIndex, 1);
        endpoints.unshift(endpoint);
      }
    }

    // Create transports
    const transports: HttpTransport[] = endpoints.map(endpoint =>
      http(endpoint.url, {
        timeout: options.timeout || 10000,
        retryCount: 2,
      })
    );

    return createPublicClient({
      chain,
      transport: fallback(transports, {
        rank: true,
        retryCount: 3,
        retryDelay: 1000,
      }),
      batch: options.batch ? { multicall: true } : undefined,
    }) as PublicClient;
  }

  /**
   * Test an RPC endpoint
   */
  async testEndpoint(url: string, chainId: number): Promise<{ success: boolean; latency: number; error?: string }> {
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        }),
      });

      const data = await response.json();
      const latency = performance.now() - start;

      if (data.error) {
        return { success: false, latency, error: data.error.message };
      }

      const returnedChainId = parseInt(data.result, 16);
      if (returnedChainId !== chainId) {
        return {
          success: false,
          latency,
          error: `Chain ID mismatch: expected ${chainId}, got ${returnedChainId}`,
        };
      }

      return { success: true, latency };
    } catch (error) {
      return {
        success: false,
        latency: performance.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test all endpoints for a chain and return sorted by latency
   */
  async rankEndpoints(chainId: number): Promise<Array<{ url: string; latency: number }>> {
    const endpoints = this.getEndpoints(chainId);
    const results = await Promise.all(
      endpoints.map(async (e) => {
        const result = await this.testEndpoint(e.url, chainId);
        return {
          url: e.url,
          latency: result.success ? result.latency : Infinity,
          success: result.success,
        };
      })
    );

    return results
      .filter(r => r.success)
      .sort((a, b) => a.latency - b.latency);
  }

  /**
   * Get RPC status for UI display
   */
  async getRpcStatus(chainId: number): Promise<{
    chainId: number;
    endpoints: Array<{
      url: string;
      status: 'healthy' | 'unhealthy' | 'unknown';
      latency?: number;
      isCustom: boolean;
      isPreferred: boolean;
    }>;
  }> {
    const endpoints = [...(this.customEndpoints.get(chainId) || []), ...(DEFAULT_RPC_ENDPOINTS[chainId] || [])];
    const preferred = this.getPreferredEndpoint(chainId);

    const results = await Promise.all(
      endpoints.map(async (e) => {
        const test = await this.testEndpoint(e.url, chainId);
        return {
          url: e.url,
          status: test.success ? 'healthy' as const : 'unhealthy' as const,
          latency: test.success ? Math.round(test.latency) : undefined,
          isCustom: e.isCustom || false,
          isPreferred: e.url === preferred,
        };
      })
    );

    return {
      chainId,
      endpoints: results,
    };
  }
}

// Singleton instance
const rpcProvider = new DecentralizedRpcProvider();

// Load saved endpoints on startup
rpcProvider.loadCustomEndpoints();

export { rpcProvider, DecentralizedRpcProvider };
export default rpcProvider;
