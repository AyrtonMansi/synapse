/**
 * PHASE 6: Router Federation
 * Regional routers + Coordinator for global load balancing
 */

export interface RegionalRouter {
  id: string;
  region: string;
  endpoint: string;
  weight: number;
  healthy: boolean;
  latencyMs: number;
  capacity: number; // max concurrent jobs
  load: number; // current load
}

export interface RoutingDecision {
  routerId: string;
  endpoint: string;
  estimatedLatency: number;
  confidence: number;
}

export interface GlobalNodeView {
  nodeId: string;
  fingerprint: string;
  region: string;
  models: string[];
  pricePer1m: number;
  tokPerSec: number;
  healthScore: number;
  load: number;
}

/**
 * Coordinator manages regional routers and global routing decisions
 */
export class FederationCoordinator {
  private routers: Map<string, RegionalRouter> = new Map();
  private globalNodeView: Map<string, GlobalNodeView> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private coordinatorId: string,
    private healthCheckIntervalMs: number = 30000
  ) {}

  /**
   * Initialize coordinator and start health checks
   */
  initialize(): void {
    console.log(`[PHASE 6] Federation coordinator ${this.coordinatorId} initialized`);
    this.startHealthChecks();
  }

  /**
   * Register a new regional router
   */
  registerRouter(router: RegionalRouter): void {
    this.routers.set(router.id, router);
    console.log(`[PHASE 6] Registered router: ${router.id} (${router.region})`);
  }

  /**
   * Unregister a regional router
   */
  unregisterRouter(routerId: string): void {
    this.routers.delete(routerId);
    console.log(`[PHASE 6] Unregistered router: ${routerId}`);
  }

  /**
   * Get best router for a request based on latency, load, and region affinity
   */
  routeRequest(preferences: {
    preferredRegion?: string;
    model?: string;
    maxLatency?: number;
  } = {}): RoutingDecision | null {
    const candidates = Array.from(this.routers.values())
      .filter(r => r.healthy)
      .filter(r => !preferences.maxLatency || r.latencyMs <= preferences.maxLatency);

    if (candidates.length === 0) {
      return null;
    }

    // Calculate score for each router
    const scored = candidates.map(router => {
      let score = 0;
      
      // Latency score (lower is better)
      score += (1000 - Math.min(router.latencyMs, 1000)) * 0.3;
      
      // Load score (lower is better) - prefer < 70% capacity
      const loadRatio = router.load / router.capacity;
      score += (1 - loadRatio) * 100 * 0.4;
      
      // Region affinity bonus
      if (preferences.preferredRegion && router.region === preferences.preferredRegion) {
        score += 100 * 0.2;
      }
      
      // Weight multiplier
      score *= router.weight;

      return { router, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      routerId: best.router.id,
      endpoint: best.router.endpoint,
      estimatedLatency: best.router.latencyMs,
      confidence: Math.min(best.score / 100, 1.0)
    };
  }

  /**
   * Broadcast node discovery to all regional routers
   */
  async broadcastNodeUpdate(node: GlobalNodeView): Promise<void> {
    this.globalNodeView.set(node.nodeId, node);
    
    // Notify all regional routers
    const updates = Array.from(this.routers.values()).map(async router => {
      try {
        const response = await fetch(`${router.endpoint}/federation/node-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(node)
        });
        return { routerId: router.id, success: response.ok };
      } catch (error) {
        return { routerId: router.id, success: false, error };
      }
    });

    const results = await Promise.allSettled(updates);
    const failures = results.filter(r => r.status === 'rejected' || !r.value.success);
    
    if (failures.length > 0) {
      console.warn(`[PHASE 6] Failed to update ${failures.length} routers`);
    }
  }

  /**
   * Get global network view for analytics
   */
  getGlobalView(): {
    routerCount: number;
    healthyRouterCount: number;
    totalNodeCount: number;
    nodesByRegion: Record<string, number>;
    avgLatencyByRegion: Record<string, number>;
  } {
    const routers = Array.from(this.routers.values());
    const nodes = Array.from(this.globalNodeView.values());
    
    const nodesByRegion: Record<string, number> = {};
    const latencyByRegion: Record<string, number[]> = {};

    for (const router of routers) {
      nodesByRegion[router.region] = (nodesByRegion[router.region] || 0) + 1;
      if (!latencyByRegion[router.region]) latencyByRegion[router.region] = [];
      latencyByRegion[router.region].push(router.latencyMs);
    }

    const avgLatencyByRegion: Record<string, number> = {};
    for (const [region, latencies] of Object.entries(latencyByRegion)) {
      avgLatencyByRegion[region] = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    }

    return {
      routerCount: routers.length,
      healthyRouterCount: routers.filter(r => r.healthy).length,
      totalNodeCount: nodes.length,
      nodesByRegion,
      avgLatencyByRegion
    };
  }

  /**
   * Health check all regional routers
   */
  private async healthCheck(): Promise<void> {
    for (const [id, router] of this.routers) {
      try {
        const start = Date.now();
        const response = await fetch(`${router.endpoint}/health`, {
          signal: AbortSignal.timeout(5000)
        });
        const latency = Date.now() - start;
        
        router.healthy = response.ok;
        router.latencyMs = latency;
        
        if (response.ok) {
          const stats = await response.json();
          router.load = stats.queue_depth || 0;
          router.capacity = stats.max_capacity || 100;
        }
      } catch (error) {
        router.healthy = false;
        console.warn(`[PHASE 6] Health check failed for router ${id}`);
      }
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.heartbeatInterval = setInterval(() => {
      this.healthCheck();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop health checks
   */
  dispose(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}

/**
 * Regional Router Client
 * Connects local router to federation coordinator
 */
export class RegionalRouterClient {
  constructor(
    private routerId: string,
    private coordinatorEndpoint: string,
    private localEndpoint: string,
    private region: string
  ) {}

  /**
   * Register with coordinator
   */
  async register(): Promise<boolean> {
    try {
      const response = await fetch(`${this.coordinatorEndpoint}/federation/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.routerId,
          region: this.region,
          endpoint: this.localEndpoint,
          weight: 1.0
        })
      });
      return response.ok;
    } catch (error) {
      console.error(`[PHASE 6] Failed to register with coordinator:`, error);
      return false;
    }
  }

  /**
   * Report local metrics to coordinator
   */
  async reportMetrics(metrics: {
    load: number;
    capacity: number;
    nodeCount: number;
  }): Promise<void> {
    try {
      await fetch(`${this.coordinatorEndpoint}/federation/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: this.routerId,
          ...metrics
        })
      });
    } catch (error) {
      // Silent fail - coordinator will detect via health check
    }
  }
}
