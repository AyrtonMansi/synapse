/**
 * PHASE 8: Billing System
 * Real usage tracking and automated billing
 */

import { db } from '../gateway-api/src/db/index.js';

interface BillingTier {
  name: string;
  minTokens: number;
  pricePer1mTokens: number;
  features: string[];
}

interface UsageInvoice {
  id: string;
  keyId: string;
  periodStart: Date;
  periodEnd: Date;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cost: number;
  status: 'pending' | 'paid' | 'overdue';
  breakdown: {
    model: string;
    tokens: number;
    cost: number;
  }[];
}

// Default billing tiers (customizable)
const DEFAULT_TIERS: BillingTier[] = [
  {
    name: 'Starter',
    minTokens: 0,
    pricePer1mTokens: 10.00,
    features: ['Community support', 'Standard latency']
  },
  {
    name: 'Growth',
    minTokens: 1_000_000,
    pricePer1mTokens: 8.00,
    features: ['Email support', 'Priority routing']
  },
  {
    name: 'Scale',
    minTokens: 10_000_000,
    pricePer1mTokens: 6.00,
    features: ['Dedicated support', 'Custom models', 'SLA']
  },
  {
    name: 'Enterprise',
    minTokens: 100_000_000,
    pricePer1mTokens: 4.00,
    features: ['Custom contracts', 'Private nodes', '24/7 support']
  }
];

export class BillingService {
  private tiers: BillingTier[];

  constructor(tiers: BillingTier[] = DEFAULT_TIERS) {
    this.tiers = tiers.sort((a, b) => b.minTokens - a.minTokens);
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(totalTokens: number): {
    tier: string;
    pricePer1m: number;
    cost: number;
  } {
    const tier = this.tiers.find(t => totalTokens >= t.minTokens) || this.tiers[this.tiers.length - 1];
    const cost = (totalTokens / 1_000_000) * tier.pricePer1mTokens;
    
    return {
      tier: tier.name,
      pricePer1m: tier.pricePer1mTokens,
      cost: Math.round(cost * 100) / 100
    };
  }

  /**
   * Generate invoice for API key usage period
   */
  async generateInvoice(
    keyId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<UsageInvoice | null> {
    // Get usage events for period
    const events = db.prepare(`
      SELECT model, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out,
             COUNT(*) as requests
      FROM usage_events
      WHERE key_id = ? AND created_at >= ? AND created_at < ?
      GROUP BY model
    `).all(
      keyId,
      periodStart.getTime(),
      periodEnd.getTime()
    ) as Array<{
      model: string;
      tokens_in: number;
      tokens_out: number;
      requests: number;
    }>;

    if (events.length === 0) {
      return null;
    }

    const totalTokensIn = events.reduce((sum, e) => sum + e.tokens_in, 0);
    const totalTokensOut = events.reduce((sum, e) => sum + e.tokens_out, 0);
    const totalTokens = totalTokensIn + totalTokensOut;

    // Calculate per-model breakdown
    const breakdown = events.map(e => {
      const tokens = e.tokens_in + e.tokens_out;
      const { cost } = this.calculateCost(tokens);
      return {
        model: e.model,
        tokens,
        cost
      };
    });

    const { cost: totalCost, tier } = this.calculateCost(totalTokens);

    const invoice: UsageInvoice = {
      id: `inv_${Date.now()}_${keyId.slice(0, 8)}`,
      keyId,
      periodStart,
      periodEnd,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      totalTokens,
      cost: totalCost,
      status: 'pending',
      breakdown
    };

    // Store invoice
    this.storeInvoice(invoice);

    return invoice;
  }

  /**
   * Store invoice in database
   */
  private storeInvoice(invoice: UsageInvoice): void {
    const stmt = db.prepare(`
      INSERT INTO invoices (id, key_id, period_start, period_end, 
        tokens_in, tokens_out, total_tokens, cost, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      invoice.id,
      invoice.keyId,
      invoice.periodStart.toISOString(),
      invoice.periodEnd.toISOString(),
      invoice.tokensIn,
      invoice.tokensOut,
      invoice.totalTokens,
      invoice.cost,
      invoice.status,
      Date.now()
    );

    // Store breakdown
    const breakdownStmt = db.prepare(`
      INSERT INTO invoice_breakdown (invoice_id, model, tokens, cost)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of invoice.breakdown) {
      breakdownStmt.run(invoice.id, item.model, item.tokens, item.cost);
    }
  }

  /**
   * Get billing stats for dashboard
   */
  async getBillingStats(keyId: string): Promise<{
    currentMonth: {
      tokens: number;
      cost: number;
      tier: string;
    };
    lastInvoice: UsageInvoice | null;
    tierProgress: {
      current: string;
      next: string | null;
      tokensToNext: number;
    };
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get current month usage
    const usage = db.prepare(`
      SELECT SUM(tokens_in + tokens_out) as total
      FROM usage_events
      WHERE key_id = ? AND created_at >= ? AND created_at < ?
    `).get(keyId, startOfMonth.getTime(), endOfMonth.getTime()) as { total: number };

    const tokens = usage?.total || 0;
    const { cost, tier } = this.calculateCost(tokens);

    // Find next tier
    const currentTierIndex = this.tiers.findIndex(t => t.name === tier);
    const nextTier = currentTierIndex > 0 ? this.tiers[currentTierIndex - 1] : null;
    const tokensToNext = nextTier ? Math.max(0, nextTier.minTokens - tokens) : 0;

    // Get last invoice
    const lastInvoiceRow = db.prepare(`
      SELECT * FROM invoices WHERE key_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(keyId);

    return {
      currentMonth: {
        tokens,
        cost,
        tier
      },
      lastInvoice: lastInvoiceRow ? this.rowToInvoice(lastInvoiceRow) : null,
      tierProgress: {
        current: tier,
        next: nextTier?.name || null,
        tokensToNext
      }
    };
  }

  /**
   * List all invoices for a key
   */
  async listInvoices(keyId: string, limit: number = 12): Promise<UsageInvoice[]> {
    const rows = db.prepare(`
      SELECT * FROM invoices WHERE key_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(keyId, limit);

    return rows.map((r: any) => this.rowToInvoice(r));
  }

  /**
   * Mark invoice as paid
   */
  async markPaid(invoiceId: string, txHash?: string): Promise<void> {
    db.prepare(`
      UPDATE invoices SET status = 'paid', paid_at = ?, tx_hash = ?
      WHERE id = ?
    `).run(Date.now(), txHash || null, invoiceId);
  }

  private rowToInvoice(row: any): UsageInvoice {
    return {
      id: row.id,
      keyId: row.key_id,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      totalTokens: row.total_tokens,
      cost: row.cost,
      status: row.status,
      breakdown: [] // Lazy load if needed
    };
  }
}

// Singleton
let billingService: BillingService | null = null;

export function initBilling(tiers?: BillingTier[]): BillingService {
  billingService = new BillingService(tiers);
  return billingService;
}

export function getBillingService(): BillingService | null {
  return billingService;
}
