/**
 * Analytics Types
 * Synapse Protocol Analytics & Monitoring Platform
 */

// ============================================================================
// Network Analytics Types
// ============================================================================

export interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  onlineNodes: number;
  syncingNodes: number;
  maintenanceNodes: number;
  totalGPUCount: number;
  totalTFLOPS: number;
  networkUtilization: number; // percentage
  lastUpdated: number;
}

export interface GeographicNode {
  id: string;
  lat: number;
  lng: number;
  region: string;
  country: string;
  city: string;
  nodeCount: number;
  gpuCount: number;
  tflops: number;
  utilization: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface GPUUtilization {
  timestamp: number;
  totalGPUs: number;
  activeGPUs: number;
  averageUtilization: number;
  utilizationByTier: {
    tier: string;
    count: number;
    utilization: number;
  }[];
  utilizationByRegion: {
    region: string;
    utilization: number;
    gpuCount: number;
  }[];
}

export interface JobCompletionMetrics {
  period: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  completionRate: number;
  averageDuration: number;
  averageQueueTime: number;
  jobsByModel: {
    model: string;
    count: number;
    successRate: number;
  }[];
}

// ============================================================================
// Economic Metrics Types
// ============================================================================

export interface TokenPriceData {
  timestamp: number;
  price: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
  fullyDilutedValuation: number;
}

export interface TradingVolume {
  period: string;
  volume: number;
  volumeChange: number;
  trades: number;
  buyVolume: number;
  sellVolume: number;
  volumeByExchange: {
    exchange: string;
    volume: number;
    percentage: number;
  }[];
}

export interface NodeEarningsDistribution {
  period: string;
  totalEarnings: string;
  averageEarnings: string;
  medianEarnings: string;
  topEarners: {
    nodeId: string;
    earnings: string;
    rank: number;
  }[];
  distributionByTier: {
    tier: string;
    nodeCount: number;
    totalEarnings: string;
    averageEarnings: string;
  }[];
  earningsByRegion: {
    region: string;
    earnings: string;
    nodeCount: number;
  }[];
}

export interface StakingPool {
  id: string;
  name: string;
  totalStaked: string;
  apr: number;
  totalRewards: string;
  lockPeriod: number;
  minStake: string;
  participants: number;
  risk: 'low' | 'medium' | 'high';
}

export interface StakingCalculation {
  amount: string;
  poolId: string;
  duration: number; // days
  estimatedRewards: string;
  projectedApr: number;
  dailyReward: string;
  monthlyReward: string;
  yearlyReward: string;
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

export interface APILatencyMetrics {
  timestamp: number;
  endpoint: string;
  method: string;
  p50: number;
  p95: number;
  p99: number;
  average: number;
  min: number;
  max: number;
  requestCount: number;
  errorCount: number;
}

export interface LatencyHeatmapData {
  timeBucket: string;
  endpoint: string;
  latencies: number[];
  averageLatency: number;
  percentile95: number;
  errorRate: number;
}

export interface ModelPerformance {
  model: string;
  version: string;
  totalRequests: number;
  averageLatency: number;
  p95Latency: number;
  tokensPerSecond: number;
  successRate: number;
  costPerToken: number;
  userSatisfaction: number;
  lastUpdated: number;
}

export interface ErrorRateMetrics {
  timestamp: number;
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  errorsByType: {
    type: string;
    count: number;
    percentage: number;
  }[];
  errorsByEndpoint: {
    endpoint: string;
    count: number;
    errorRate: number;
  }[];
}

export interface CapacityForecast {
  timestamp: number;
  currentCapacity: number;
  predictedCapacity: number[];
  confidence: number[];
  timeHorizon: string[];
  growthRate: number;
  recommendedActions: string[];
}

// ============================================================================
// Leaderboard Types
// ============================================================================

export interface NodeLeaderboardEntry {
  rank: number;
  nodeId: string;
  operator: string;
  name: string;
  score: number;
  earnings: string;
  jobsCompleted: number;
  uptime: number;
  region: string;
  tier: string;
  gpuModel: string;
  reputation: number;
  change24h: number; // rank change
}

export interface ReliabilityLeaderboardEntry {
  rank: number;
  nodeId: string;
  operator: string;
  name: string;
  reliabilityScore: number;
  uptime: number;
  consecutiveSuccessfulJobs: number;
  failedJobs: number;
  averageResponseTime: number;
  lastFailure?: number;
  change24h: number;
}

export interface SpeedLeaderboardEntry {
  rank: number;
  nodeId: string;
  operator: string;
  name: string;
  averageInferenceTime: number;
  fastestInferenceTime: number;
  tokensPerSecond: number;
  model: string;
  gpuModel: string;
  samples: number;
  change24h: number;
}

export interface RegionalPerformance {
  region: string;
  rank: number;
  nodeCount: number;
  averageUptime: number;
  averageLatency: number;
  totalJobs: number;
  totalEarnings: string;
  growthRate: number;
  status: 'expanding' | 'stable' | 'declining';
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface AnalyticsDashboardState {
  timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | '1y';
  selectedRegion: string | null;
  selectedModel: string | null;
  autoRefresh: boolean;
  refreshInterval: number;
}

export interface AlertConfig {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  enabled: boolean;
  notifyChannels: string[];
  lastTriggered?: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  services: {
    name: string;
    status: 'healthy' | 'degraded' | 'critical';
    latency: number;
    uptime: number;
    lastCheck: number;
  }[];
  incidents: {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    startedAt: number;
    resolvedAt?: number;
  }[];
}
