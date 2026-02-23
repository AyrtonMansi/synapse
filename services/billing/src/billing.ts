/**
 * PHASE 1: USD-Stable Billing Service
 * Users pay in USD-stable amounts, settled in HSK at current rates
 */

import { db } from '../../gateway-api/src/db/index.js';

// USD pricing per 1M tokens (stable, not affected by HSK volatility)
const USD_PRICING: Record<string, number> = {
  'deepseek-v3': 2.00,      // $2 per 1M tokens
  'deepseek-chat': 1.50,
  'llama-3-70b': 1.80,
  'llama-3-8b': 0.50,
  'echo-stub': 0.01,        // Testing model
  'default': 2.00
};

// HSK/USD exchange rate (updated periodically by oracle/service)
let hskUsdRate = 0.10; // 1 HSK = $0.10 USD (example)

interface UsageRecord {
  id: string;
  keyId: string;
  nodeId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  usdAmount: number;
  hskAmount: number;
  exchangeRate: number;
  timestamp: number;
}

interface UserBalance {
  keyId: string;
  usdBalance: number;
  hskBalance: number;
  totalSpent: number;
  lastUpdated: number;
}

/**
 * Calculate USD cost for token usage
 * Price is STABLE USD - does not change with HSK volatility
 */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): { usd: number; hsk: number; rate: number } {
  const pricePer1m = USD_PRICING[model] || USD_PRICING['default'];
  const totalTokens = tokensIn + tokensOut;
  
  // USD amount is FIXED - never changes
  const usdAmount = (totalTokens / 1_000_000) * pricePer1m;
  
  // HSK amount varies with exchange rate
  const hskAmount = usdAmount / hskUsdRate;
  
  return {
    usd: Math.round(usdAmount * 10000) / 10000, // 4 decimal places
    hsk: Math.round(hskAmount * 10000) / 10000,
    rate: hskUsdRate
  };
}

/**
 * Update HSK/USD exchange rate (called by price oracle)
 */
export function updateExchangeRate(newRate: number): void {
  if (newRate <= 0) throw new Error('Exchange rate must be positive');
  hskUsdRate = newRate;
  console.log(`[Billing] HSK/USD rate updated: $${newRate}`);
}

/**
 * Record usage and charge user
 */
export function chargeUsage(
  keyId: string,
  nodeId: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): { success: boolean; usd: number; hsk: number; error?: string } {
  const cost = calculateCost(model, tokensIn, tokensOut);
  
  // Check balance
  const balance = getBalance(keyId);
  if (balance.usdBalance < cost.usd) {
    return {
      success: false,
      usd: cost.usd,
      hsk: cost.hsk,
      error: `Insufficient balance: $${balance.usdBalance.toFixed(4)} USD available, $${cost.usd.toFixed(4)} required`
    };
  }
  
  // Deduct balance
  const stmt = db.prepare(`
    UPDATE user_balances
    SET usd_balance = usd_balance - ?,
        total_spent = total_spent + ?,
        last_updated = ?
    WHERE key_id = ?
  `);
  
  stmt.run(cost.usd, cost.usd, Date.now(), keyId);
  
  // Record usage
  recordUsage({
    id: crypto.randomUUID(),
    keyId,
    nodeId,
    model,
    tokensIn,
    tokensOut,
    usdAmount: cost.usd,
    hskAmount: cost.hsk,
    exchangeRate: cost.rate,
    timestamp: Date.now()
  });
  
  return {
    success: true,
    usd: cost.usd,
    hsk: cost.hsk
  };
}

/**
 * Get user balance
 */
export function getBalance(keyId: string): UserBalance {
  const row = db.prepare(`
    SELECT * FROM user_balances WHERE key_id = ?
  `).get(keyId) as {
    key_id: string;
    usd_balance: number;
    hsk_balance: number;
    total_spent: number;
    last_updated: number;
  } | undefined;
  
  if (!row) {
    // Initialize zero balance
    initBalance(keyId);
    return {
      keyId,
      usdBalance: 0,
      hskBalance: 0,
      totalSpent: 0,
      lastUpdated: Date.now()
    };
  }
  
  return {
    keyId: row.key_id,
    usdBalance: row.usd_balance,
    hskBalance: row.hsk_balance,
    totalSpent: row.total_spent,
    lastUpdated: row.last_updated
  };
}

/**
 * Initialize user balance record
 */
function initBalance(keyId: string): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO user_balances
    (key_id, usd_balance, hsk_balance, total_spent, last_updated)
    VALUES (?, 0, 0, 0, ?)
  `);
  stmt.run(keyId, Date.now());
}

/**
 * Deposit funds (simulated - real would interact with escrow contract)
 */
export function deposit(
  keyId: string,
  usdAmount: number,
  hskAmount: number
): boolean {
  const stmt = db.prepare(`
    INSERT INTO user_balances (key_id, usd_balance, hsk_balance, total_spent, last_updated)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(key_id) DO UPDATE SET
      usd_balance = usd_balance + excluded.usd_balance,
      hsk_balance = hsk_balance + excluded.hsk_balance,
      last_updated = excluded.last_updated
  `);
  
  stmt.run(keyId, usdAmount, hskAmount, Date.now());
  return true;
}

/**
 * Record usage event
 */
function recordUsage(record: UsageRecord): void {
  const stmt = db.prepare(`
    INSERT INTO billing_usage (
      id, key_id, node_id, model,
      tokens_in, tokens_out, usd_amount, hsk_amount,
      exchange_rate, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    record.id,
    record.keyId,
    record.nodeId,
    record.model,
    record.tokensIn,
    record.tokensOut,
    record.usdAmount,
    record.hskAmount,
    record.exchangeRate,
    record.timestamp
  );
}

/**
 * Get usage stats for user
 */
export function getUsageStats(keyId: string, days: number = 30): {
  totalUsd: number;
  totalHsk: number;
  totalTokens: number;
  requestCount: number;
} {
  const since = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  const row = db.prepare(`
    SELECT 
      COALESCE(SUM(usd_amount), 0) as total_usd,
      COALESCE(SUM(hsk_amount), 0) as total_hsk,
      COALESCE(SUM(tokens_in + tokens_out), 0) as total_tokens,
      COUNT(*) as request_count
    FROM billing_usage
    WHERE key_id = ? AND timestamp >= ?
  `).get(keyId, since) as {
    total_usd: number;
    total_hsk: number;
    total_tokens: number;
    request_count: number;
  };
  
  return {
    totalUsd: row.total_usd,
    totalHsk: row.total_hsk,
    totalTokens: row.total_tokens,
    requestCount: row.request_count
  };
}

/**
 * Concurrency cap check
 */
const activeRequests = new Map<string, number>();
const MAX_CONCURRENT = 10;

export function checkConcurrency(keyId: string): { allowed: boolean; current: number } {
  const current = activeRequests.get(keyId) || 0;
  
  if (current >= MAX_CONCURRENT) {
    return { allowed: false, current };
  }
  
  activeRequests.set(keyId, current + 1);
  return { allowed: true, current: current + 1 };
}

export function releaseConcurrency(keyId: string): void {
  const current = activeRequests.get(keyId) || 0;
  if (current > 0) {
    activeRequests.set(keyId, current - 1);
  }
}

// Database migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS user_balances (
    key_id TEXT PRIMARY KEY,
    usd_balance REAL NOT NULL DEFAULT 0,
    hsk_balance REAL NOT NULL DEFAULT 0,
    total_spent REAL NOT NULL DEFAULT 0,
    last_updated INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS billing_usage (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    usd_amount REAL NOT NULL DEFAULT 0,
    hsk_amount REAL NOT NULL DEFAULT 0,
    exchange_rate REAL NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_billing_key ON billing_usage(key_id);
  CREATE INDEX IF NOT EXISTS idx_billing_time ON billing_usage(timestamp);
`);
