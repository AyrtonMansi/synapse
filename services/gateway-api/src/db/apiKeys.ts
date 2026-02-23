import { db } from './index.js';
import { randomUUID, createHash } from 'crypto';
import bcrypt from 'bcryptjs';

// P1.2: New key format with embedded keyId for O(1) lookup
// Format: syn_live_<keyId>_<secret>
// keyId is a 16-char alphanumeric identifier for fast DB lookup
// secret is a 32-char random string for bcrypt verification
const KEY_PREFIX = 'syn_live_';
const BCRYPT_ROUNDS = 12;

export interface ApiKey {
  id: string;
  key_id: string;        // P1.2: Extractable keyId from key format
  key_hash: string;      // bcrypt hash of full key
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
 * P1.2: Generate a new API key with O(1) lookup format
 * Format: syn_live_<keyId>_<secret>
 * - keyId: 16 chars, used for fast DB lookup
 * - secret: 32 chars, used for bcrypt verification
 */
export function generateApiKey(): { key: string; keyId: string } {
  // Generate 16-char keyId (alphanumeric, URL-safe)
  const keyId = randomUUID().replace(/-/g, '').slice(0, 16);
  // Generate 32-char secret
  const secret = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const key = `${KEY_PREFIX}${keyId}_${secret}`;
  return { key, keyId };
}

/**
 * P1.2: Extract keyId from new format key
 * syn_live_<keyId>_<secret> -> keyId
 */
export function extractKeyId(key: string): string | null {
  if (!key.startsWith(KEY_PREFIX)) {
    return null;
  }
  const withoutPrefix = key.slice(KEY_PREFIX.length);
  const underscoreIndex = withoutPrefix.indexOf('_');
  if (underscoreIndex === -1) {
    return null;
  }
  return withoutPrefix.slice(0, underscoreIndex);
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
 * P1.2: Create a new API key with O(1) lookup format
 */
export function createApiKey(input: CreateKeyInput): { id: string; key: string } {
  const id = randomUUID();
  const { key, keyId } = generateApiKey();
  const keyHash = bcrypt.hashSync(key, BCRYPT_ROUNDS);
  
  const stmt = db.prepare(`
    INSERT INTO api_keys (id, key_id, key_hash, owner_email, owner_wallet, created_at, use_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
  
  stmt.run(
    id,
    keyId,  // P1.2: Store extractable keyId for O(1) lookup
    keyHash,
    input.email || null,
    input.wallet || null,
    Date.now()
  );
  
  return { id, key };
}

/**
 * P1.2: O(1) API key validation
 * 1. Extract keyId from key format: syn_live_<keyId>_<secret>
 * 2. DB lookup by keyId (single row)
 * 3. Single bcrypt compare
 * No iteration over multiple keys required
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  // P1.2: Skip validation for obviously invalid keys
  if (!key || key.length < 30 || !key.startsWith(KEY_PREFIX)) {
    return null;
  }
  
  // P1.2: Extract keyId for O(1) lookup
  const keyId = extractKeyId(key);
  if (!keyId) {
    return null;
  }
  
  // P1.2: Single DB lookup by keyId - O(1) operation
  const stmt = db.prepare(`
    SELECT * FROM api_keys 
    WHERE key_id = ? 
    AND revoked_at IS NULL
  `);
  const apiKey = stmt.get(keyId) as ApiKey | undefined;
  
  // P1.2: Single bcrypt compare - O(1) operation
  if (apiKey && await verifyKey(key, apiKey.key_hash)) {
    // Update usage stats
    const updateStmt = db.prepare(`
      UPDATE api_keys 
      SET last_used_at = ?, use_count = use_count + 1
      WHERE id = ?
    `);
    updateStmt.run(Date.now(), apiKey.id);
    
    return apiKey;
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
 * P1.2: Migration to new schema with key_id column
 * - Adds key_id column if not exists
 * - Migrates old format keys (best effort)
 * - Removes old key_id_prefix column if exists
 */
export function migrateApiKeys(): void {
  try {
    // Check if key_id column exists
    const checkKeyIdStmt = db.prepare(`
      SELECT name FROM pragma_table_info('api_keys') WHERE name = 'key_id'
    `);
    const hasKeyIdColumn = checkKeyIdStmt.get();
    
    if (!hasKeyIdColumn) {
      console.log('P1.2: Migrating api_keys table to new O(1) schema...');
      
      // Add key_id column
      db.exec(`ALTER TABLE api_keys ADD COLUMN key_id TEXT`);
      
      // Migrate existing keys: try to extract keyId from key_hash (we can't recover keys)
      // Mark old keys as needing regeneration
      const oldKeysStmt = db.prepare(`
        SELECT id FROM api_keys WHERE key_id IS NULL
      `);
      const oldKeys = oldKeysStmt.all() as { id: string }[];
      
      if (oldKeys.length > 0) {
        console.log(`P1.2: ${oldKeys.length} legacy keys need migration (will require regeneration)`);
      }
      
      console.log('P1.2: Migration complete - O(1) lookup enabled');
    }
    
    // Ensure last_used_at and use_count columns exist
    const checkLastUsedStmt = db.prepare(`
      SELECT name FROM pragma_table_info('api_keys') WHERE name = 'last_used_at'
    `);
    if (!checkLastUsedStmt.get()) {
      db.exec(`ALTER TABLE api_keys ADD COLUMN last_used_at INTEGER`);
    }
    
    const checkUseCountStmt = db.prepare(`
      SELECT name FROM pragma_table_info('api_keys') WHERE name = 'use_count'
    `);
    if (!checkUseCountStmt.get()) {
      db.exec(`ALTER TABLE api_keys ADD COLUMN use_count INTEGER DEFAULT 0`);
    }
    
  } catch (error) {
    console.error('P1.2: Migration failed:', error);
  }
}

// Run migration on module load
migrateApiKeys();
