const { SiweMessage } = require('siwe');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Nonce cache (5 minute expiry)
const nonceCache = new NodeCache({ stdTTL: 300 });

// Session cache (24 hour expiry)
const sessionCache = new NodeCache({ stdTTL: 86400 });

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Generate a nonce for SIWE authentication
 */
function generateNonce() {
  return ethers.randomBytes(32).toString('hex');
}

/**
 * Get nonce for wallet authentication
 */
async function getNonce(walletAddress) {
  const normalizedAddress = walletAddress.toLowerCase();
  const nonce = generateNonce();
  nonceCache.set(normalizedAddress, nonce);
  return nonce;
}

/**
 * Verify SIWE message and signature
 */
async function verifySiwe(message, signature) {
  try {
    const siweMessage = new SiweMessage(message);
    const normalizedAddress = siweMessage.address.toLowerCase();
    
    // Verify nonce
    const cachedNonce = nonceCache.get(normalizedAddress);
    if (!cachedNonce || cachedNonce !== siweMessage.nonce) {
      throw new Error('Invalid or expired nonce');
    }
    
    // Verify signature
    const result = await siweMessage.verify({ signature });
    
    if (!result.success) {
      throw new Error('Signature verification failed');
    }
    
    // Clear used nonce
    nonceCache.del(normalizedAddress);
    
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
 */
function generateToken(address, chainId) {
  const payload = {
    sub: address.toLowerCase(),
    chainId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  
  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, payload: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Generate API key for wallet
 */
function generateApiKey(walletAddress) {
  const normalizedAddress = walletAddress.toLowerCase();
  const timestamp = Date.now();
  const random = ethers.randomBytes(16).toString('hex');
  
  const apiKey = `syn_${normalizedAddress.slice(2, 10)}_${timestamp}_${random}`;
  
  // Store in cache
  sessionCache.set(apiKey, {
    address: normalizedAddress,
    createdAt: timestamp
  });
  
  return apiKey;
}

/**
 * Verify API key
 */
function verifyApiKey(apiKey) {
  const session = sessionCache.get(apiKey);
  if (!session) {
    return { valid: false };
  }
  return { valid: true, address: session.address };
}

/**
 * Revoke API key
 */
function revokeApiKey(apiKey) {
  return sessionCache.del(apiKey);
}

module.exports = {
  getNonce,
  verifySiwe,
  generateToken,
  verifyToken,
  generateApiKey,
  verifyApiKey,
  revokeApiKey
};