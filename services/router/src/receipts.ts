/**
 * Receipt Verification and Nonce Registry
 * PHASE 5: Signed receipts with replay protection
 */

import { db } from '../../gateway-api/src/db/index.js';
import { createHash, randomBytes } from 'crypto';

interface Receipt {
  job_id: string;
  prompt_hash: string;
  output_hash: string;
  tokens_in: number;
  tokens_out: number;
  served_model: string;
  timestamp: number;
  nonce: number;
  node_id: string;
  signature: string; // Ed25519 signature
}

interface VerifiedReceipt extends Receipt {
  valid: boolean;
  errors: string[];
  processed_at: number;
}

// In-memory nonce cache for fast lookups
const nonceCache = new Map<string, Set<number>>();

/**
 * Verify a receipt signature and nonce
 */
export async function verifyReceipt(
  receipt: Receipt,
  nodePubkey: string
): Promise<VerifiedReceipt> {
  const errors: string[] = [];
  
  // 1. Check nonce not reused
  if (await isNonceUsed(receipt.node_id, receipt.nonce)) {
    errors.push('Nonce already used');
  }
  
  // 2. Verify timestamp is reasonable (within 5 minutes)
  const now = Date.now();
  const receiptAge = now - receipt.timestamp;
  if (receiptAge > 300000 || receiptAge < -60000) {
    errors.push(`Receipt timestamp invalid: ${receiptAge}ms old`);
  }
  
  // 3. Verify signature (placeholder - actual verification needs ed25519 library)
  const isValidSignature = await verifyEd25519Signature(receipt, nodePubkey);
  if (!isValidSignature) {
    errors.push('Invalid signature');
  }
  
  // 4. Verify token counts are reasonable
  if (receipt.tokens_in < 0 || receipt.tokens_out < 0) {
    errors.push('Negative token count');
  }
  
  if (receipt.tokens_in > 1000000 || receipt.tokens_out > 1000000) {
    errors.push('Token count exceeds maximum');
  }
  
  const verified: VerifiedReceipt = {
    ...receipt,
    valid: errors.length === 0,
    errors,
    processed_at: now
  };
  
  // Mark nonce as used if valid
  if (verified.valid) {
    await markNonceUsed(receipt.node_id, receipt.nonce);
  }
  
  return verified;
}

/**
 * Check if nonce has been used
 */
export async function isNonceUsed(nodeId: string, nonce: number): Promise<boolean> {
  // Check cache first
  const nodeNonces = nonceCache.get(nodeId);
  if (nodeNonces && nodeNonces.has(nonce)) {
    return true;
  }
  
  // Check database
  const row = db.prepare(`
    SELECT 1 FROM used_nonces WHERE node_id = ? AND nonce = ?
  `).get(nodeId, nonce);
  
  return row !== undefined;
}

/**
 * Mark nonce as used
 */
export async function markNonceUsed(nodeId: string, nonce: number): Promise<void> {
  // Update cache
  if (!nonceCache.has(nodeId)) {
    nonceCache.set(nodeId, new Set());
  }
  nonceCache.get(nodeId)!.add(nonce);
  
  // Update database
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO used_nonces (node_id, nonce, used_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(nodeId, nonce, Date.now());
}

/**
 * Generate a unique nonce for a node
 */
export function generateNonce(nodeId: string): number {
  // Use timestamp + random for uniqueness
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return timestamp * 1000000 + random;
}

/**
 * Verify Ed25519 signature (placeholder implementation)
 * In production, use tweetnacl or similar library
 */
async function verifyEd25519Signature(
  receipt: Receipt,
  pubkey: string
): Promise<boolean> {
  // TODO: Implement actual Ed25519 verification
  // const message = serializeReceipt(receipt);
  // return nacl.sign.detached.verify(message, receipt.signature, pubkey);
  
  // For now, return true (assume valid in development)
  return true;
}

/**
 * Serialize receipt for signing
 */
export function serializeReceipt(receipt: Omit<Receipt, 'signature'>): string {
  const data = {
    job_id: receipt.job_id,
    prompt_hash: receipt.prompt_hash,
    output_hash: receipt.output_hash,
    tokens_in: receipt.tokens_in,
    tokens_out: receipt.tokens_out,
    served_model: receipt.served_model,
    timestamp: receipt.timestamp,
    nonce: receipt.nonce,
    node_id: receipt.node_id
  };
  return JSON.stringify(data, Object.keys(data).sort());
}

/**
 * Hash prompt and output for privacy-preserving receipts
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Store receipt in database
 */
export function storeReceipt(receipt: VerifiedReceipt): void {
  const stmt = db.prepare(`
    INSERT INTO receipts (
      job_id, node_id, prompt_hash, output_hash, 
      tokens_in, tokens_out, served_model, timestamp,
      nonce, signature, valid, errors, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    receipt.job_id,
    receipt.node_id,
    receipt.prompt_hash,
    receipt.output_hash,
    receipt.tokens_in,
    receipt.tokens_out,
    receipt.served_model,
    receipt.timestamp,
    receipt.nonce,
    receipt.signature,
    receipt.valid ? 1 : 0,
    JSON.stringify(receipt.errors),
    receipt.processed_at
  );
}

/**
 * Get receipts for a node in a time range
 */
export function getNodeReceipts(
  nodeId: string,
  startTime: number,
  endTime: number
): VerifiedReceipt[] {
  const stmt = db.prepare(`
    SELECT * FROM receipts 
    WHERE node_id = ? AND timestamp >= ? AND timestamp < ? AND valid = 1
    ORDER BY timestamp
  `);
  
  const rows = stmt.all(nodeId, startTime, endTime) as any[];
  
  return rows.map(row => ({
    job_id: row.job_id,
    node_id: row.node_id,
    prompt_hash: row.prompt_hash,
    output_hash: row.output_hash,
    tokens_in: row.tokens_in,
    tokens_out: row.tokens_out,
    served_model: row.served_model,
    timestamp: row.timestamp,
    nonce: row.nonce,
    signature: row.signature,
    valid: row.valid === 1,
    errors: JSON.parse(row.errors || '[]'),
    processed_at: row.processed_at
  }));
}

/**
 * Get total tokens processed by a node
 */
export function getNodeTokenTotal(nodeId: string, startTime: number, endTime: number): {
  tokens_in: number;
  tokens_out: number;
  count: number;
} {
  const stmt = db.prepare(`
    SELECT 
      COALESCE(SUM(tokens_in), 0) as tokens_in,
      COALESCE(SUM(tokens_out), 0) as tokens_out,
      COUNT(*) as count
    FROM receipts 
    WHERE node_id = ? AND timestamp >= ? AND timestamp < ? AND valid = 1
  `);
  
  return stmt.get(nodeId, startTime, endTime) as { tokens_in: number; tokens_out: number; count: number };
}

// Database migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS used_nonces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    used_at INTEGER NOT NULL,
    UNIQUE(node_id, nonce)
  );
  
  CREATE INDEX IF NOT EXISTS idx_nonces_node ON used_nonces(node_id);
  CREATE INDEX IF NOT EXISTS idx_nonces_lookup ON used_nonces(node_id, nonce);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    output_hash TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    served_model TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    signature TEXT NOT NULL,
    valid INTEGER NOT NULL DEFAULT 0,
    errors TEXT,
    processed_at INTEGER NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_receipts_node ON receipts(node_id);
  CREATE INDEX IF NOT EXISTS idx_receipts_time ON receipts(timestamp);
  CREATE INDEX IF NOT EXISTS idx_receipts_valid ON receipts(node_id, timestamp, valid);
`);
