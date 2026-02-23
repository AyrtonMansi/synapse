/**
 * Analytics Types
 * Backend type definitions for analytics module
 */

// ============================================================================
// Database Schema Types
// ============================================================================

export interface NodeMetric {
  id: string;
  nodeId: string;
  timestamp: Date;
  cpuUtilization: number;
  gpuUtilization: number;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  powerDraw: number;
  networkIn: number;
  networkOut: number;
  jobsRunning: number;
  jobsQueued: number;
}

export interface JobMetric {
  id: string;
  jobId: string;
  nodeId: string;
  model: string;
  status: 'completed' | 'failed' | 'cancelled' | 'running';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duration: number;
  queueTime: number;
  inferenceTime: number;
  earnings: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface APIMetric {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latency: number;
  requestSize: number;
  responseSize: number;
  userId?: string;
  apiKey?: string;
  timestamp: Date;
  error?: string;
}

export interface EconomicMetric {
  id: string;
  timestamp: Date;
  tokenPrice: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
  totalEarnings: string;
  totalStaked: string;
  stakingApr: number;
}

// ============================================================================
// Service Types
// ============================================================================

export interface TimeRange {
  start: Date;
  end: Date;
  granularity: '1m' | '5m' | '15m' | '1h' | '1d';
}

export interface AggregationResult {
  timestamp: Date;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface CacheConfig {
  ttl: number;
  key: string;
}

// ============================================================================
// Event Types
// ============================================================================

export interface AnalyticsEvent {
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: {
    userId?: string;
    sessionId?: string;
    ip?: string;
    userAgent?: string;
  };
}

export interface AlertEvent {
  alertId: string;
  metric: string;
  threshold: number;
  actualValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

// ============================================================================
// Export Types
// ============================================================================

export interface AnalyticsExport {
  format: 'csv' | 'json' | 'xlsx';
  dataType: string;
  timeRange: TimeRange;
  filters?: Record<string, any>;
}

// ============================================================================
// Report Types
// ============================================================================

export interface AnalyticsReport {
  id: string;
  name: string;
  description?: string;
  type: 'network' | 'economic' | 'performance' | 'custom';
  schedule?: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
}
