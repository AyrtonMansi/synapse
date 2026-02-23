import { db } from './index.js';
import { randomUUID } from 'crypto';

export interface UsageEvent {
  id: string;
  key_id: string;
  node_id: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_estimate: number;
  status: 'success' | 'error';
  created_at: number;
}

export interface CreateUsageEventInput {
  key_id: string;
  node_id: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_estimate: number;
  status: 'success' | 'error';
}

export function createUsageEvent(input: CreateUsageEventInput): UsageEvent {
  const id = randomUUID();
  const created_at = Date.now();
  
  const stmt = db.prepare(`
    INSERT INTO usage_events 
    (id, key_id, node_id, model, tokens_in, tokens_out, latency_ms, cost_estimate, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    input.key_id,
    input.node_id,
    input.model,
    input.tokens_in,
    input.tokens_out,
    input.latency_ms,
    input.cost_estimate,
    input.status,
    created_at
  );
  
  return {
    id,
    ...input,
    created_at
  };
}

export function getUsageByKey(keyId: string): UsageEvent[] {
  const stmt = db.prepare(
    'SELECT * FROM usage_events WHERE key_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(keyId) as UsageEvent[];
}

export function getRecentUsage(limit: number = 100): UsageEvent[] {
  const stmt = db.prepare(
    'SELECT * FROM usage_events ORDER BY created_at DESC LIMIT ?'
  );
  return stmt.all(limit) as UsageEvent[];
}

export function getUsageStats(): { 
  total_tokens: number; 
  total_jobs: number; 
  avg_latency: number;
} {
  const stmt = db.prepare(`
    SELECT 
      COALESCE(SUM(tokens_in + tokens_out), 0) as total_tokens,
      COUNT(*) as total_jobs,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM usage_events
    WHERE status = 'success'
  `);
  return stmt.get() as { total_tokens: number; total_jobs: number; avg_latency: number };
}