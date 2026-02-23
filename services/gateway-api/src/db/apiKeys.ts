import { db } from './index.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const KEY_PREFIX = 'syn_';

export interface ApiKey {
  id: string;
  key_hash: string;
  owner_email?: string;
  owner_wallet?: string;
  created_at: number;
  revoked_at?: number;
}

export interface CreateKeyInput {
  email?: string;
  wallet?: string;
}

export function generateApiKey(): string {
  const random = randomUUID().replace(/-/g, '');
  return `${KEY_PREFIX}live_${random}`;
}

export async function hashKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

export async function verifyKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

export function createApiKey(input: CreateKeyInput): { id: string; key: string } {
  const id = randomUUID();
  const key = generateApiKey();
  const keyHash = bcrypt.hashSync(key, 10);
  
  const stmt = db.prepare(`
    INSERT INTO api_keys (id, key_hash, owner_email, owner_wallet, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    keyHash,
    input.email || null,
    input.wallet || null,
    Date.now()
  );
  
  return { id, key };
}

export function validateApiKey(key: string): ApiKey | null {
  // Extract ID from key for lookup optimization (optional)
  const stmt = db.prepare('SELECT * FROM api_keys WHERE revoked_at IS NULL');
  const keys = stmt.all() as ApiKey[];
  
  for (const apiKey of keys) {
    if (bcrypt.compareSync(key, apiKey.key_hash)) {
      return apiKey;
    }
  }
  
  return null;
}

export function revokeApiKey(id: string): void {
  const stmt = db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?');
  stmt.run(Date.now(), id);
}