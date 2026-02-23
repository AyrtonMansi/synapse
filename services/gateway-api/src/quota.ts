/**
 * Quota Enforcement for API Keys
 * PHASE B: Daily token caps and billing integration
 */

import { db } from './db/index.js';

interface QuotaConfig {
  dailyTokenLimit: number;
  dailyCostLimit: number;
  enforceQuota: boolean;
}

interface QuotaStatus {
  keyId: string;
  tokensUsed: number;
  tokensRemaining: number;
  costIncurred: number;
  costRemaining: number;
  resetTime: number;
  quotaExceeded: boolean;
}

// Default quotas by tier
const DEFAULT_QUOTAS: Record<string, QuotaConfig> = {
  starter: {
    dailyTokenLimit: 100_000,  // 100k tokens/day
    dailyCostLimit: 10,        // $10/day
    enforceQuota: true
  },
  growth: {
    dailyTokenLimit: 1_000_000,  // 1M tokens/day
    dailyCostLimit: 100,         // $100/day
    enforceQuota: true
  },
  scale: {
    dailyTokenLimit: 10_000_000,  // 10M tokens/day
    dailyCostLimit: 1000,         // $1000/day
    enforceQuota: true
  },
  unlimited: {
    dailyTokenLimit: Number.MAX_SAFE_INTEGER,
    dailyCostLimit: Number.MAX_SAFE_INTEGER,
    enforceQuota: false
  }
};

/**
 * Check quota status for an API key
 */
export function checkQuota(keyId: string, tier: string = 'starter'): QuotaStatus {
  const config = DEFAULT_QUOTAS[tier] || DEFAULT_QUOTAS.starter;
  
  // Get today's usage
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const usage = db.prepare(`
    SELECT 
      COALESCE(SUM(tokens_in + tokens_out), 0) as tokens,
      COALESCE(SUM(cost_estimate), 0) as cost
    FROM usage_events
    WHERE key_id = ? AND created_at >= ?
  `).get(keyId, startOfDay.getTime()) as { tokens: number; cost: number };
  
  const tokensUsed = usage?.tokens || 0;
  const costIncurred = usage?.cost || 0;
  
  // Calculate reset time (next midnight)
  const resetTime = new Date();
  resetTime.setDate(resetTime.getDate() + 1);
  resetTime.setHours(0, 0, 0, 0);
  
  return {
    keyId,
    tokensUsed,
    tokensRemaining: Math.max(0, config.dailyTokenLimit - tokensUsed),
    costIncurred,
    costRemaining: Math.max(0, config.dailyCostLimit - costIncurred),
    resetTime: resetTime.getTime(),
    quotaExceeded: config.enforceQuota && (
      tokensUsed >= config.dailyTokenLimit ||
      costIncurred >= config.dailyCostLimit
    )
  };
}

/**
 * Check if a request would exceed quota
 */
export function wouldExceedQuota(
  keyId: string,
  estimatedTokens: number,
  tier: string = 'starter'
): { allowed: boolean; reason?: string; quota: QuotaStatus } {
  const quota = checkQuota(keyId, tier);
  const config = DEFAULT_QUOTAS[tier] || DEFAULT_QUOTAS.starter;
  
  if (!config.enforceQuota) {
    return { allowed: true, quota };
  }
  
  if (quota.tokensRemaining < estimatedTokens) {
    return {
      allowed: false,
      reason: `Token quota exceeded. Remaining: ${quota.tokensRemaining}, Requested: ${estimatedTokens}`,
      quota
    };
  }
  
  return { allowed: true, quota };
}

/**
 * Increment quota usage (called after successful request)
 */
export function recordQuotaUsage(
  keyId: string,
  tokens: number,
  cost: number
): void {
  // Usage is recorded via usage_events table
  // This function is a placeholder for future quota-specific tracking
}

/**
 * Get quota headers for response
 */
export function getQuotaHeaders(quota: QuotaStatus): Record<string, string> {
  return {
    'x-quota-tokens-used': quota.tokensUsed.toString(),
    'x-quota-tokens-remaining': quota.tokensRemaining.toString(),
    'x-quota-reset-at': new Date(quota.resetTime).toISOString(),
    'x-quota-cost-incurred': quota.costIncurred.toFixed(4),
    'x-quota-cost-remaining': quota.costRemaining.toFixed(2)
  };
}

/**
 * Get quota stats for dashboard
 */
export function getQuotaStats(keyId: string): {
  current: QuotaStatus;
  history: Array<{ date: string; tokens: number; cost: number }>;
} {
  const current = checkQuota(keyId);
  
  // Get last 30 days history
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const rows = db.prepare(`
    SELECT 
      date(created_at / 1000, 'unixepoch') as date,
      SUM(tokens_in + tokens_out) as tokens,
      SUM(cost_estimate) as cost
    FROM usage_events
    WHERE key_id = ? AND created_at >= ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT 30
  `).all(keyId, thirtyDaysAgo) as Array<{ date: string; tokens: number; cost: number }>;
  
  return {
    current,
    history: rows
  };
}

/**
 * Admin: Set custom quota for a key
 */
export function setCustomQuota(
  keyId: string,
  dailyTokenLimit: number,
  dailyCostLimit: number
): void {
  const stmt = db.prepare(`
    INSERT INTO custom_quotas (key_id, daily_token_limit, daily_cost_limit, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key_id) DO UPDATE SET
      daily_token_limit = excluded.daily_token_limit,
      daily_cost_limit = excluded.daily_cost_limit,
      updated_at = excluded.updated_at
  `);
  
  stmt.run(keyId, dailyTokenLimit, dailyCostLimit, Date.now());
}

/**
 * Get effective quota for a key (custom or default)
 */
export function getEffectiveQuota(keyId: string): QuotaConfig {
  const custom = db.prepare(`
    SELECT daily_token_limit, daily_cost_limit FROM custom_quotas
    WHERE key_id = ?
  `).get(keyId) as { daily_token_limit: number; daily_cost_limit: number } | undefined;
  
  if (custom) {
    return {
      dailyTokenLimit: custom.daily_token_limit,
      dailyCostLimit: custom.daily_cost_limit,
      enforceQuota: true
    };
  }
  
  return DEFAULT_QUOTAS.starter;
}

// Database migration
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_quotas (
    key_id TEXT PRIMARY KEY,
    daily_token_limit INTEGER NOT NULL,
    daily_cost_limit REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);
