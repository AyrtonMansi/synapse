const { SiweMessage } = require('siwe');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const winston = require('winston');
const crypto = require('crypto');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// SECURITY: Proper JWT secret validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  logger.error('FATAL: JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

// SECURITY: CSRF token secret
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

// Nonce cache (5 minute expiry)
const nonceCache = new NodeCache({ 
  stdTTL: 300,
  checkperiod: 60,
  deleteOnExpire: true 
});

// Session cache (24 hour expiry)
const sessionCache = new NodeCache({ 
  stdTTL: 86400,
  checkperiod: 600,
  deleteOnExpire: true
});

// SECURITY: Rate limiting per address
const rateLimitCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 30
});

/**
 * Generate a cryptographically secure nonce
 */
function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate CSRF token
 */
function generateCsrfToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${token}`)
    .digest('hex');
  return `${token}.${hash}`;
}

/**
 * Verify CSRF token
 */
function verifyCsrfToken(sessionId, token) {
  if (!token || !token.includes('.')) return false;
  const [nonce, hash] = token.split('.');
  const expectedHash = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${nonce}`)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}

/**
 * Check rate limit for address
 */
function checkRateLimit(address, maxRequests = 5) {
  const key = `ratelimit:${address.toLowerCase()}`;
  const current = rateLimitCache.get(key) || 0;
  
  if (current >= maxRequests) {
    return { allowed: false, retryAfter: rateLimitCache.getTtl(key) - Date.now() };
  }
  
  rateLimitCache.set(key, current + 1);
  return { allowed: true };
}

/**
 * Get nonce for wallet authentication
 * SECURITY: Implements rate limiting per address
 */
async function getNonce(walletAddress) {
  const normalizedAddress = walletAddress.toLowerCase();
  
  // Check rate limit
  const rateLimit = checkRateLimit(normalizedAddress, 10);
  if (!rateLimit.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateLimit.retryAfter / 1000)} seconds`);
  }
  
  const nonce = generateNonce();
  nonceCache.set(normalizedAddress, {
    nonce,
    createdAt: Date.now(),
    attempts: 0
  });
  return nonce;
}

/**
 * Verify SIWE message and signature
 * SECURITY: Implements replay attack protection, nonce validation, signature verification
 */
async function verifySiwe(message, signature, csrfToken) {
  try {
    const siweMessage = new SiweMessage(message);
    const normalizedAddress = siweMessage.address.toLowerCase();
    
    // Get cached nonce data
    const nonceData = nonceCache.get(normalizedAddress);
    if (!nonceData) {
      throw new Error('Nonce not found or expired');
    }
    
    // SECURITY: Rate limit verification attempts
    nonceData.attempts++;
    if (nonceData.attempts > 5) {
      nonceCache.del(normalizedAddress);
      throw new Error('Too many verification attempts. Please request a new nonce.');
    }
    nonceCache.set(normalizedAddress, nonceData);
    
    // Verify nonce matches
    if (nonceData.nonce !== siweMessage.nonce) {
      logger.warn(`Nonce mismatch for ${normalizedAddress}`);
      throw new Error('Invalid nonce');
    }
    
    // SECURITY: Verify nonce is not expired (5 minutes)
    if (Date.now() - nonceData.createdAt > 5 * 60 * 1000) {
      nonceCache.del(normalizedAddress);
      throw new Error('Nonce expired');
    }
    
    // SECURITY: Verify domain matches expected domain
    const expectedDomain = process.env.APP_DOMAIN || 'synapse.network';
    if (siweMessage.domain !== expectedDomain) {
      logger.warn(`Domain mismatch: ${siweMessage.domain} vs ${expectedDomain}`);
      throw new Error('Invalid domain');
    }
    
    // SECURITY: Verify chain ID matches
    const expectedChainId = parseInt(process.env.CHAIN_ID || '1');
    if (siweMessage.chainId !== expectedChainId) {
      logger.warn(`Chain ID mismatch: ${siweMessage.chainId} vs ${expectedChainId}`);
      throw new Error('Invalid chain ID');
    }
    
    // Verify signature
    const result = await siweMessage.verify({ signature });
    
    if (!result.success) {
      throw new Error('Signature verification failed');
    }
    
    // Clear used nonce
    nonceCache.del(normalizedAddress);
    
    // SECURITY: Log successful authentication
    logger.info(`Successful SIWE authentication`, {
      address: normalizedAddress,
      chainId: siweMessage.chainId
    });
    
    return {
      success: true,
      address: normalizedAddress,
      chainId: siweMessage.chainId
    };
  } catch (error) {
    logger.error('SIWE verification failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate JWT token for authenticated session
 * SECURITY: Short expiration, proper claims, secure algorithm
 */
function generateToken(address, chainId) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const csrfToken = generateCsrfToken(sessionId);
  
  const payload = {
    sub: address.toLowerCase(),
    chainId,
    sessionId,
    jti: crypto.randomBytes(16).toString('hex'), // Unique token ID
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  
  const token = jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'synapse-api',
    audience: 'synapse-client'
  });
  
  // Store session
  sessionCache.set(sessionId, {
    address: address.toLowerCase(),
    chainId,
    createdAt: Date.now(),
    csrfToken
  });
  
  return { token, csrfToken, sessionId };
}

/**
 * Verify JWT token
 * SECURITY: Validates all claims, checks expiration, verifies signature
 */
function verifyToken(token, csrfToken) {
  try {
    if (!token) {
      return { valid: false, error: 'Token required' };
    }
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'synapse-api',
      audience: 'synapse-client',
      complete: true
    });
    
    const payload = decoded.payload;
    
    // SECURITY: Verify session exists
    const session = sessionCache.get(payload.sessionId);
    if (!session) {
      return { valid: false, error: 'Session expired or invalid' };
    }
    
    // SECURITY: Verify CSRF token
    if (!verifyCsrfToken(payload.sessionId, csrfToken)) {
      logger.warn(`CSRF validation failed for ${payload.sub}`);
      return { valid: false, error: 'Invalid CSRF token' };
    }
    
    // SECURITY: Check token is not blacklisted
    if (session.revoked) {
      return { valid: false, error: 'Token has been revoked' };
    }
    
    return { 
      valid: true, 
      payload: decoded.payload,
      session
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired' };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token' };
    }
    logger.error('JWT verification error:', error.message);
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Generate API key for wallet
 * SECURITY: Cryptographically secure random generation, prefix for identification
 */
function generateApiKey(walletAddress, permissions = ['read']) {
  const normalizedAddress = walletAddress.toLowerCase();
  const timestamp = Date.now();
  
  // SECURITY: Use crypto.randomBytes for secure random generation
  const randomPart = crypto.randomBytes(32).toString('base64url');
  
  // Create hash for integrity verification
  const integrityHash = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${normalizedAddress}:${timestamp}:${randomPart}`)
    .digest('hex')
    .slice(0, 16);
  
  const apiKey = `syn_${normalizedAddress.slice(2, 10)}_${timestamp}_${randomPart}_${integrityHash}`;
  
  // Store in cache with permissions
  sessionCache.set(apiKey, {
    address: normalizedAddress,
    createdAt: timestamp,
    permissions,
    requestCount: 0,
    lastUsed: timestamp
  });
  
  return apiKey;
}

/**
 * Verify API key
 * SECURITY: Validates integrity hash, checks permissions, rate limits
 */
function verifyApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('syn_')) {
    return { valid: false, error: 'Invalid API key format' };
  }
  
  const parts = apiKey.split('_');
  if (parts.length !== 5) {
    return { valid: false, error: 'Malformed API key' };
  }
  
  const session = sessionCache.get(apiKey);
  if (!session) {
    return { valid: false, error: 'API key not found or expired' };
  }
  
  // SECURITY: Verify integrity hash
  const [, addressPart, timestamp, randomPart, providedHash] = parts;
  const expectedHash = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${session.address}:${timestamp}:${randomPart}`)
    .digest('hex')
    .slice(0, 16);
    
  if (providedHash !== expectedHash) {
    logger.warn(`API key integrity check failed for ${session.address}`);
    return { valid: false, error: 'API key integrity check failed' };
  }
  
  // SECURITY: Rate limiting per API key
  const now = Date.now();
  const timeWindow = 60 * 1000; // 1 minute
  if (now - session.lastUsed < timeWindow) {
    session.requestCount++;
    if (session.requestCount > 100) { // 100 requests per minute
      return { valid: false, error: 'Rate limit exceeded' };
    }
  } else {
    session.requestCount = 1;
  }
  session.lastUsed = now;
  sessionCache.set(apiKey, session);
  
  return { 
    valid: true, 
    address: session.address,
    permissions: session.permissions
  };
}

/**
 * Revoke API key
 */
function revokeApiKey(apiKey) {
  const session = sessionCache.get(apiKey);
  if (session) {
    session.revoked = true;
    session.revokedAt = Date.now();
    sessionCache.set(apiKey, session);
    return true;
  }
  return false;
}

/**
 * Refresh session with new tokens
 */
function refreshSession(sessionId) {
  const session = sessionCache.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  if (session.revoked) {
    return { success: false, error: 'Session revoked' };
  }
  
  // Generate new tokens
  const result = generateToken(session.address, session.chainId);
  
  // Revoke old session
  session.revoked = true;
  sessionCache.set(sessionId, session);
  
  return {
    success: true,
    ...result
  };
}

module.exports = {
  getNonce,
  verifySiwe,
  generateToken,
  verifyToken,
  generateApiKey,
  verifyApiKey,
  revokeApiKey,
  refreshSession,
  generateCsrfToken,
  verifyCsrfToken,
  checkRateLimit,
  nonceCache,
  sessionCache
};
