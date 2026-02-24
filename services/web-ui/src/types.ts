// Types for Synapse Gateway

export interface Stats {
  nodes_online: number;
  jobs_today: number;
  tokens_processed: number;
  avg_cost: number;
  fallback_rate: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  unlocked: boolean;
  unlockedAt?: Date;
}

export interface Node {
  fingerprint: string;
  model: string;
  hardware: string;
  tok_per_sec: number;
  utilization_percent: number;
  jobs_per_hour: number;
  health_score: number;
  success_rate: number;
  last_heartbeat?: string;
  earnings?: {
    low: number;
    expected: number;
    high: number;
  };
}

export interface YieldEstimate {
  fingerprint: string;
  model: string;
  hardware: string;
  tok_per_sec: number;
  utilization_percent: number;
  jobs_per_hour: number;
  rate_per_1m_tokens: number;
  estimated_revenue_per_day: {
    low: number;
    expected: number;
    high: number;
  };
  health_score: number;
  success_rate: number;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    nodeId?: string;
    isFallback?: boolean;
    receiptVerified?: string;
    latency?: number;
    receiptId?: string;
    verified?: boolean;
  };
}

export interface ApiKeyResponse {
  api_key: string;
}

export interface CompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  model: string;
  synapse_meta?: {
    requested_model: string;
    model_served: string;
    fallback: boolean;
    node_id: string;
    receipt_verified: string;
  };
}
