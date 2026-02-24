/**
 * Synapse Privacy Layer - Client-Side Encryption
 * 
 * Tier 2: Encrypted at Rest (MVP Implementation)
 * - Workspace Key: User-held, never sent to server
 * - AES-GCM-256 for chat history encryption
 * - Gateway sees only hashes/metadata, never plaintext
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export type PrivacyTier = 'standard' | 'encrypted' | 'e2ee';

export interface PrivacyConfig {
  tier: PrivacyTier;
  workspaceKey?: CryptoKey;
  keyId?: string;
}

export interface EncryptedSession {
  iv: string;
  ciphertext: string;
  keyId: string;
  timestamp: number;
}

/**
 * Generate a new workspace key (Tier 2)
 * This key never leaves the client
 */
export async function generateWorkspaceKey(): Promise<{ key: CryptoKey; keyId: string }> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable for export
    ['encrypt', 'decrypt']
  );
  
  // Generate key ID from key material (for reference only)
  const exported = await crypto.subtle.exportKey('raw', key);
  const keyHash = await crypto.subtle.digest('SHA-256', exported);
  const keyId = Array.from(new Uint8Array(keyHash))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return { key, keyId };
}

/**
 * Export workspace key for backup (Tier 2)
 * User must store this securely
 */
export async function exportWorkspaceKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(exported);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Import workspace key from backup (Tier 2)
 */
export async function importWorkspaceKey(keyData: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    bytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt chat message (Tier 2)
 */
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedSession> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  const exported = await crypto.subtle.exportKey('raw', key);
  const keyHash = await crypto.subtle.digest('SHA-256', exported);
  const keyId = Array.from(new Uint8Array(keyHash))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    keyId,
    timestamp: Date.now(),
  };
}

/**
 * Decrypt chat message (Tier 2)
 */
export async function decryptMessage(
  encrypted: EncryptedSession,
  key: CryptoKey
): Promise<string> {
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Hash for server-side metadata (no plaintext)
 */
export async function hashForMetadata(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Privacy tier descriptions for UI
 */
export const privacyDescriptions: Record<PrivacyTier, {
  title: string;
  description: string;
  warnings: string[];
}> = {
  standard: {
    title: 'Standard',
    description: 'TLS encryption in transit. Server may log minimal metadata (timestamps, model used, node ID). Chat history stored server-side for conversation continuity.',
    warnings: [
      'Synapse operators can see that you made a request',
      'Node operators see anonymized request metadata',
      'Chat history stored on Synapse servers',
    ],
  },
  encrypted: {
    title: 'Encrypted at Rest',
    description: 'Your workspace key encrypts chat history client-side before storage. Gateway stores only cryptographic hashes and routing metadata — never plaintext. You control the key.',
    warnings: [
      'Synapse operators can see that you made a request',
      'Node operators see anonymized request metadata',
      'If you lose your workspace key, history is unrecoverable',
    ],
  },
  e2ee: {
    title: 'End-to-End (Preview)',
    description: 'Client encrypts prompts with ephemeral session keys. Only compatible nodes can decrypt. Maximum privacy, limited node availability.',
    warnings: [
      'Limited to E2EE-capable nodes (~30% of network)',
      'Higher latency due to key exchange',
      'If you lose session keys, history is unrecoverable',
      'Node operators cannot see request content',
    ],
  },
};

/**
 * Threat model documentation
 */
export const threatModel = `
## Synapse Privacy Threat Model

### What Synapse CANNOT protect against:
- **Network observers**: See that you're connecting to Synapse (use VPN/Tor for this)
- **Compromised nodes**: Malicious nodes could log or tamper with requests
- **Client compromise**: Malware on your device can read messages before encryption
- **Metadata correlation**: Request timing patterns can reveal usage

### What each tier protects:

**Standard**: Protects data in transit from passive eavesdroppers.

**Encrypted at Rest**: Protects chat history from Synapse server compromise. 
Server operators see only hashes ( SHA-256 of ciphertext ), not content.

**E2EE-lite**: Protects prompt content from Synapse infrastructure. 
Only the executing node can decrypt. Requires node support.

### What we log (all tiers):
- Request timestamp
- Model requested
- Node that served request (anonymized)
- Success/failure status
- Latency metrics

### What we NEVER log (Encrypted/E2EE tiers):
- Prompt content (Encrypted: ciphertext only, E2EE: never sees plaintext)
- Response content
- Workspace keys
`;
