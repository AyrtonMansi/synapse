-- Migration: Add billing tables
-- PHASE 8: Billing system schema

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  tx_hash TEXT,
  FOREIGN KEY (key_id) REFERENCES api_keys(key_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_key_id ON invoices(key_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

CREATE TABLE IF NOT EXISTS invoice_breakdown (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_breakdown_invoice ON invoice_breakdown(invoice_id);

-- Add settlement tracking table for Phase 4
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  epoch_id INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  merkle_root TEXT NOT NULL,
  proof TEXT,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_settlements_epoch ON settlements(epoch_id);
CREATE INDEX IF NOT EXISTS idx_settlements_wallet ON settlements(wallet);
CREATE INDEX IF NOT EXISTS idx_settlements_unclaimed ON settlements(wallet, epoch_id) WHERE claimed_at IS NULL;
