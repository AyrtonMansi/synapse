/**
 * PHASE 8: Intelligent Router Scoring Module
 * Adaptive node scoring using tok_per_sec, latency, success rate, utilization
 */

interface Node {
  id: string;
  healthScore: number;
  successRate: number;
  avgLatencyMs: number;
  tok_per_sec?: number;
  utilization?: number;
  load: number;
  concurrency: number;
  pricePer1m: number;
  totalJobs: number;
  lastErrorAt?: number;
}

interface RoutingScore {
  nodeId: string;
  score: number;
  components: {
    performance: number;    // tok_per_sec weighted
    reliability: number;    // successRate * healthScore
    latency: number;        // inverse of latency
    utilization: number;    // available capacity
    price: number;          // cost efficiency
  };
  reason?: string;
}

// PHASE 8: Weight configuration (tuneable)
const SCORE_WEIGHTS = {
  performance: 0.25,   // tok_per_sec throughput
  reliability: 0.30,   // success rate + health
  latency: 0.20,       // response time
  utilization: 0.15,   // available capacity
  price: 0.10          // cost factor
};

// Reference values for normalization
const REFERENCE = {
  tokPerSec: 50,       // 50 tok/s baseline
  latencyMs: 500,      // 500ms baseline
  pricePer1m: 0.0015   // baseline price
};

/**
 * PHASE 8: Calculate adaptive routing score for a node
 * Higher score = better routing candidate
 */
export function calculateRoutingScore(node: Node): RoutingScore {
  // Performance score: normalized tok_per_sec (0-1+)
  const performanceScore = Math.min(
    (node.tok_per_sec || 0) / REFERENCE.tokPerSec,
    2.0 // Cap at 2x reference
  );

  // Reliability score: combine successRate and healthScore
  const reliabilityScore = node.successRate * node.healthScore;

  // Latency score: inverse, normalized (lower latency = higher score)
  const latencyScore = Math.max(
    0,
    1 - (node.avgLatencyMs / (REFERENCE.latencyMs * 2))
  );

  // Utilization score: available capacity (0-1)
  const utilizationScore = Math.max(
    0,
    1 - ((node.load || 0) / (node.concurrency || 1))
  );

  // Price score: inverse, normalized (lower price = higher score)
  const priceScore = Math.max(
    0,
    1 - (node.pricePer1m / (REFERENCE.pricePer1m * 3))
  );

  // Weighted composite score
  const compositeScore = 
    performanceScore * SCORE_WEIGHTS.performance +
    reliabilityScore * SCORE_WEIGHTS.reliability +
    latencyScore * SCORE_WEIGHTS.latency +
    utilizationScore * SCORE_WEIGHTS.utilization +
    priceScore * SCORE_WEIGHTS.price;

  return {
    nodeId: node.id,
    score: Math.round(compositeScore * 1000) / 1000, // 3 decimal precision
    components: {
      performance: Math.round(performanceScore * 100) / 100,
      reliability: Math.round(reliabilityScore * 100) / 100,
      latency: Math.round(latencyScore * 100) / 100,
      utilization: Math.round(utilizationScore * 100) / 100,
      price: Math.round(priceScore * 100) / 100
    }
  };
}

/**
 * PHASE 8: Sort nodes by routing score (highest first)
 */
export function sortNodesByScore(nodes: Node[]): Node[] {
  return [...nodes].sort((a, b) => {
    const scoreA = calculateRoutingScore(a).score;
    const scoreB = calculateRoutingScore(b).score;
    return scoreB - scoreA;
  });
}

/**
 * PHASE 8: Soft load shedding - filter nodes under pressure
 * Removes nodes with utilization > 90% unless all nodes are under pressure
 */
export function applyLoadShedding(nodes: Node[]): Node[] {
  // If no nodes, return empty
  if (nodes.length === 0) return [];

  // Filter out severely congested nodes (>90% utilization)
  const availableNodes = nodes.filter(n => {
    const utilization = ((n.load || 0) / (n.concurrency || 1)) * 100;
    return utilization < 90;
  });

  // If all nodes are congested, return the least congested ones
  // (emergency mode - don't completely fail)
  if (availableNodes.length === 0) {
    return nodes
      .sort((a, b) => {
        const utilA = (a.load || 0) / (a.concurrency || 1);
        const utilB = (b.load || 0) / (b.concurrency || 1);
        return utilA - utilB; // Least congested first
      })
      .slice(0, 3); // Return top 3 least congested
  }

  return availableNodes;
}

/**
 * PHASE 8: Reliability penalty - gradually reduce score for flaky nodes
 */
export function applyReliabilityPenalty(node: Node, recentFailures: number): number {
  const baseScore = calculateRoutingScore(node).score;
  
  // Exponential backoff for recent failures
  // 1 failure: 10% penalty, 2 failures: 30% penalty, 3+: 50% penalty
  const penaltyFactor = recentFailures === 0 ? 1.0 :
    recentFailures === 1 ? 0.9 :
    recentFailures === 2 ? 0.7 :
    0.5;

  return baseScore * penaltyFactor;
}

/**
 * PHASE 8: Get routing metrics for stats endpoint
 */
export function getRoutingMetrics(nodes: Node[]) {
  if (nodes.length === 0) {
    return {
      avg_score: 0,
      performance_weight: SCORE_WEIGHTS.performance,
      reliability_weight: SCORE_WEIGHTS.reliability,
      latency_weight: SCORE_WEIGHTS.latency,
      utilization_weight: SCORE_WEIGHTS.utilization,
      price_weight: SCORE_WEIGHTS.price,
      load_shedding_active: false,
      nodes_available: 0,
      nodes_congested: 0
    };
  }

  const scores = nodes.map(calculateRoutingScore);
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  const congestedCount = nodes.filter(n => {
    const util = ((n.load || 0) / (n.concurrency || 1)) * 100;
    return util >= 90;
  }).length;

  return {
    avg_score: Math.round(avgScore * 1000) / 1000,
    performance_weight: SCORE_WEIGHTS.performance,
    reliability_weight: SCORE_WEIGHTS.reliability,
    latency_weight: SCORE_WEIGHTS.latency,
    utilization_weight: SCORE_WEIGHTS.utilization,
    price_weight: SCORE_WEIGHTS.price,
    load_shedding_active: congestedCount > 0 && congestedCount < nodes.length,
    nodes_available: nodes.length - congestedCount,
    nodes_congested: congestedCount
  };
}
