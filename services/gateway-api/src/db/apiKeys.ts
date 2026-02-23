import { db } from './index.js';
import { randomUUID, createHash } from 'crypto';
import bcrypt from 'bcryptjs';

const KEY_PREFIX = 'syn_';
const BCRYPT_ROUNDS = 12; // Increased from default 10 for better security

export interface ApiKey {
  id: string;
  key_hash: string;
  key_id_prefix: string; // First 8 chars of key for fast lookup
  owner_email?: string;
  owner_wallet?: string;
  created_at: number;
  revoked_at?: number;
  last_used_at?: number;
  use_count: number;
}

export interface CreateKeyInput {
  email?: string;
  wallet?: string;
}

/**
 * Generate a new API key with secure randomness
 */
export function generateApiKey(): string {
  const random = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  return `${KEY_PREFIX}live_${random}`;
}

/**
 * Extract the key ID prefix for fast lookup
 */
export function getKeyIdPrefix(key: string): string {
  // Use hash of the key prefix for consistent lookup
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Hash a key using bcrypt (async to not block event loop)
 */
export async function hashKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_ROUNDS);
}

/**
 * Verify a key against its hash (async to not block event loop)
 */
export async function verifyKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Create a new API key
 */
export function createApiKey(input: CreateKeyInput): { id: string; key: string } {
  const id = randomUUID();
  const key = generateApiKey();
  const keyHash = bcrypt.hashSync(key, BCRYPT_ROUNDS);
  const keyIdPrefix = getKeyIdPrefix(key);
  
  const stmt = db.prepare(`
    INSERT INTO api_keys (id, key_hash, key_id_prefix, owner_email, owner_wallet, created_at, use_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
  
  stmt.run(
    id,
    keyHash,
    keyIdPrefix,
    input.email || null,
    input.wallet || null,
    Date.now()
  );
  
  return { id, key };
}

/**
 * Validate an API key - uses prefix lookup for O(1) performance
 * Falls back to checking recent keys if prefix match fails (handles edge cases)
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  // Skip validation for obviously invalid keys
  if (!key || key.length < 20 || !key.startsWith(KEY_PREFIX)) {
    return null;
  }
  
  const keyIdPrefix = getKeyIdPrefix(key);
  
  // Try fast lookup by prefix first
  const prefixStmt = db.prepare(`
    SELECT * FROM api_keys 
    WHERE key_id_prefix = ? 
    AND revoked_at IS NULL
  `);
  const candidates = prefixStmt.all(keyIdPrefix) as ApiKey[];
  
  // Check candidates with bcrypt (should be 0 or 1 match)
  for (const apiKey of candidates) {
    if (await verifyKey(key, apiKey.key_hash)) {
      // Update usage stats
      const updateStmt = db.prepare(`
        UPDATE api_keys 
        SET last_used_at = ?, use_count = use_count + 1
        WHERE id = ?
      `);
      updateStmt.run(Date.now(), apiKey.id);
      
      return apiKey;
    }
  }
  
  // Fallback: check if any non-revoked key matches (handles edge cases)
  // Limit to recent 100 keys to prevent DoS
  const fallbackStmt = db.prepare(`
    SELECT * FROM api_keys 
    WHERE revoked_at IS NULL 
    AND key_id_prefix != ?
    ORDER BY last_used_at DESC NULLS LAST
    LIMIT 100
  `);
  const fallbackKeys = fallbackStmt.all(keyIdPrefix) as ApiKey[];
  
  for (const apiKey of fallbackKeys) {
    if (await verifyKey(key, apiKey.key_hash)) {
      // Update the key_id_prefix for this key (migration path)
      const migrateStmt = db.prepare(`
        UPDATE api_keys SET key_id_prefix = ? WHERE id = ?
      `);
      migrateStmt.run(keyIdPrefix, apiKey.id);
      
      // Update usage stats
      const updateStmt = db.prepare(`
        UPDATE api_keys 
        SET last_used_at = ?, use_count = use_count + 1
        WHERE id = ?
      `);
      updateStmt.run(Date.now(), apiKey.id);
      
      return apiKey;
    }
  }
  
  return null;
}

/**
 * Revoke an API key by ID
 */
export function revokeApiKey(id: string): boolean {
  const stmt = db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?');
  const result = stmt.run(Date.now(), id);
  return result.changes > 0;
}

/**
 * Get API key by ID
 */
export function getApiKeyById(id: string): ApiKey | null {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
  return stmt.get(id) as ApiKey | null;
}

/**
 * Migration: Add key_id_prefix column if it doesn't exist
 * This is safe to run on startup
 */
export function migrateApiKeys(): void {
  try {
    // Check if column exists
    const checkStmt = db.prepare(`
      SELECT name FROM pragma_table_info('api_keys') WHERE name = 'key_id_prefix'
    `);
    const hasColumn = checkStmt.get();
    
    if (!hasColumn) {
      console.log('Migrating api_keys table: adding key_id_prefix column...');
      
      db.exec(`
        ALTER TABLE api_keys ADD COLUMN key_id_prefix TEXT;
        ALTER TABLE api_keys ADD COLUMN last_used_at INTEGER;
        ALTER TABLE api_keys ADD COLUMN use_count INTEGER DEFAULT 0;
      `);
      
      console.log('Migration complete');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run migration on module load
migrateApiKeys();
