import { Request, Response, NextFunction } from 'express';
import { SiweMessage } from 'siwe';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import NodeCache from 'node-cache';

// Types
export interface AuthRequest extends Request {
  walletAddress?: string;
  chainId?: number;
}

export interface SiweSession {
  address: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

// Determine which session store to use
const useRedis = !!process.env.REDIS_URL;

// Fallback to NodeCache for development
const nonceCache = new NodeCache({ stdTTL: 300 }); // 5 minutes
const sessionCache = new NodeCache({ stdTTL: 86400 }); // 24 hours

// Get Redis store if available
async function getStore() {
  if (useRedis) {
    try {
      const { getSessionStore } = await import('../services/redis-session');
      return getSessionStore();
    } catch (error) {
      console.warn('Redis not available, using in-memory cache');
    }
  }
  return null;
}

// Environment
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m'; // Short expiry for security
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Generate cryptographically secure nonce
 */
export function generateNonce(): string {
  return ethers.randomBytes(32).toString('hex');
}

/**
 * Create SIWE message for client to sign
 */
export async function createSiweMessage(
  address: string,
  chainId: number = 1,
  domain: string = process.env.DOMAIN || 'localhost'
): Promise<{ message: string; nonce: string }> {
  const normalizedAddress = address.toLowerCase();
  const nonce = generateNonce();
  
  // Store nonce (prefer Redis if available)
  const store = await getStore();
  if (store) {
    await store.storeNonce(normalizedAddress, nonce);
  } else {
    nonceCache.set(normalizedAddress, nonce);
  }
  
  const message = new SiweMessage({
    domain,
    address: normalizedAddress,
    statement: 'Sign in to Synapse - Decentralized Compute Network',
    uri: `https://${domain}`,
    version: '1',
    chainId,
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min expiry
  });
  
  return {
    message: message.prepareMessage(),
    nonce
  };
}

/**
 * Verify SIWE signature
 */
export async function verifySiweSignature(
  message: string,
  signature: string
): Promise<{ success: boolean; address?: string; chainId?: number; error?: string }> {
  try {
    const siweMessage = new SiweMessage(message);
    const normalizedAddress = siweMessage.address.toLowerCase();
    
    // Check expiration
    if (siweMessage.expirationTime) {
      const expiry = new Date(siweMessage.expirationTime);
      if (expiry < new Date()) {
        return { success: false, error: 'Message expired' };
      }
    }
    
    // Verify nonce
    const store = await getStore();
    let cachedNonce: string | null;
    
    if (store) {
      cachedNonce = await store.getNonce(normalizedAddress);
    } else {
      cachedNonce = nonceCache.get<string>(normalizedAddress);
      nonceCache.del(normalizedAddress);
    }
    
    if (!cachedNonce || cachedNonce !== siweMessage.nonce) {
      return { success: false, error: 'Invalid or expired nonce' };
    }
    
    // Verify signature
    const result = await siweMessage.verify({ signature });
    
    if (!result.success) {
      return { success: false, error: 'Signature verification failed' };
    }
    
    return {
      success: true,
      address: normalizedAddress,
      chainId: siweMessage.chainId
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate JWT token pair (access + refresh)
 */
export async function generateJwtToken(
  address: string, 
  chainId: number
): Promise<{ accessToken: string; refreshToken: string }> {
  const normalizedAddress = address.toLowerCase();
  
  const payload = {
    sub: normalizedAddress,
    chainId,
    type: 'access',
    jti: ethers.randomBytes(16).toString('hex'), // Unique token ID
  };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRY,
    issuer: 'synapse-api',
    audience: 'synapse-client'
  });
  
  const refreshPayload = {
    sub: normalizedAddress,
    type: 'refresh',
    jti: ethers.randomBytes(16).toString('hex'),
  };
  
  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
    issuer: 'synapse-api',
    audience: 'synapse-client'
  });
  
  // Store refresh token (for revocation)
  const store = await getStore();
  if (store) {
    await store.createSession(refreshPayload.jti, {
      address: normalizedAddress,
      type: 'refresh',
      createdAt: Date.now(),
    }, 7 * 24 * 60 * 60); // 7 days
  }
  
  return { accessToken, refreshToken };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ 
  success: boolean; 
  accessToken?: string; 
  error?: string 
}> {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as any;
    
    if (payload.type !== 'refresh') {
      return { success: false, error: 'Invalid token type' };
    }
    
    // Check if session exists (not revoked)
    const store = await getStore();
    if (store) {
      const session = await store.getSession(payload.jti);
      if (!session) {
        return { success: false, error: 'Token revoked' };
      }
    }
    
    // Generate new access token
    const newToken = jwt.sign({
      sub: payload.sub,
      chainId: payload.chainId || 1,
      type: 'access',
      jti: ethers.randomBytes(16).toString('hex'),
    }, JWT_SECRET, { 
      expiresIn: JWT_EXPIRY,
      issuer: 'synapse-api',
      audience: 'synapse-client'
    });
    
    return { success: true, accessToken: newToken };
  } catch (error) {
    return { success: false, error: 'Invalid refresh token' };
  }
}

/**
 * Generate API key for long-term access
 */
export async function generateApiKey(address: string): Promise<string> {
  const normalizedAddress = address.toLowerCase();
  const timestamp = Date.now();
  const random = ethers.randomBytes(16).toString('hex');
  
  const apiKey = `syn_${normalizedAddress.slice(2, 10)}_${timestamp}_${random}`;
  
  const keyData = {
    address: normalizedAddress,
    createdAt: timestamp,
    lastUsed: timestamp,
  };
  
  const store = await getStore();
  if (store) {
    await store.storeApiKey(apiKey, keyData);
  } else {
    sessionCache.set(apiKey, keyData);
  }
  
  return apiKey;
}

/**
 * Verify JWT token from Authorization header
 */
export function verifyJwtToken(token: string): { valid: boolean; payload?: any; error?: string } {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'synapse-api',
      audience: 'synapse-client'
    });
    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token'
    };
  }
}

/**
 * Verify API key
 */
export async function verifyApiKey(apiKey: string): Promise<{ valid: boolean; address?: string; error?: string }> {
  let session;
  
  const store = await getStore();
  if (store) {
    session = await store.getApiKey(apiKey);
  } else {
    session = sessionCache.get<{ address: string; createdAt: number }>(apiKey);
    if (session) {
      sessionCache.set(apiKey, { ...session, lastUsed: Date.now() });
    }
  }
  
  if (!session) {
    return { valid: false, error: 'Invalid or expired API key' };
  }
  
  return { valid: true, address: session.address };
}

/**
 * Revoke API key
 */
export async function revokeApiKey(apiKey: string): Promise<boolean> {
  const store = await getStore();
  if (store) {
    return await store.revokeApiKey(apiKey);
  }
  return sessionCache.del(apiKey) > 0;
}

/**
 * Revoke refresh token (logout)
 */
export async function revokeRefreshToken(tokenId: string): Promise<boolean> {
  const store = await getStore();
  if (store) {
    return await store.deleteSession(tokenId);
  }
  return sessionCache.del(tokenId) > 0;
}

/**
 * Express middleware to require authentication
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Check API key first
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    const result = await verifyApiKey(apiKey);
    if (result.valid && result.address) {
      req.walletAddress = result.address;
      next();
      return;
    }
  }
  
  // Check JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const result = verifyJwtToken(token);
    if (result.valid && result.payload) {
      req.walletAddress = result.payload.sub;
      req.chainId = result.payload.chainId;
      next();
      return;
    }
  }
  
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Get session info for wallet
 */
export async function getSessionInfo(address: string): Promise<{
  hasActiveSession: boolean;
  sessions: number;
}> {
  const normalizedAddress = address.toLowerCase();
  
  const store = await getStore();
  if (store) {
    const keys = await store.getApiKeysByAddress(normalizedAddress);
    return {
      hasActiveSession: keys.length > 0,
      sessions: keys.length
    };
  }
  
  const keys = sessionCache.keys();
  const userSessions = keys.filter(key => {
    const session = sessionCache.get<{ address: string }>(key);
    return session?.address === normalizedAddress;
  });
  
  return {
    hasActiveSession: userSessions.length > 0,
    sessions: userSessions.length
  };
}
