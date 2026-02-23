import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL || join(process.cwd(), 'data', 'gateway.db');

export const db: DatabaseType = new Database(dbPath);
db.pragma('journal_mode = WAL');

export function initDb() {
  // API Keys table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT NOT NULL UNIQUE,
      owner_email TEXT,
      owner_wallet TEXT,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      metadata TEXT
    )
  `);

  // Usage events table with receipt fields
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_in INTEGER NOT NULL,
      tokens_out INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      cost_estimate REAL NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      prompt_hash TEXT,
      output_hash TEXT,
      receipt_json TEXT,
      FOREIGN KEY (key_id) REFERENCES api_keys(id)
    )
  `);

  // Nodes table (cached from router)
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      status TEXT NOT NULL,
      models TEXT NOT NULL,
      price_per_1m REAL NOT NULL,
      concurrency INTEGER NOT NULL,
      hardware TEXT,
      last_seen INTEGER NOT NULL,
      uptime_score REAL DEFAULT 1.0
    )
  `);

  // Node earnings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_earnings (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      tokens INTEGER NOT NULL,
      revenue REAL NOT NULL,
      jobs INTEGER NOT NULL,
      uptime_score REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    )
  `);

  console.log('Database initialized at:', dbPath);
}

initDb();