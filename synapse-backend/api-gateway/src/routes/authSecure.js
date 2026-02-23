const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { 
  getNonce, 
  verifySiwe, 
  generateToken, 
  verifyToken, 
  generateApiKey, 
  revokeApiKey,
  generateCsrfToken,
  verifyCsrfToken
} = require('../services/siweSecure');
const { getRateLimit } = require('../services/rateLimiter');

const router = express.Router();

// SECURITY: Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { 
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

const nonceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 nonces per minute
  message: {
    error: 'Too many nonce requests. Please try again later.',
    retryAfter: 60
  }
});

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * @route GET /auth/nonce/:address
 * @desc Get nonce for SIWE authentication
 * @access Public
 * @security Rate limited, input validated
 */
router.get('/nonce/:address', 
  nonceLimiter,
  [
    param('address')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Invalid Ethereum address format')
      .custom((value) => {
        // Additional checksum validation
        const { ethers } = require('ethers');
        try {
          ethers.getAddress(value); // Will throw if invalid
          return true;
        } catch {
          throw new Error('Invalid Ethereum address checksum');
        }
      })
  ],
  validate,
  async (req, res) => {
    try {
      const { address } = req.params;
      
      const nonce = await getNonce(address);
      
      // SECURITY: Include domain and chain in message for client
      const domain = process.env.APP_DOMAIN || 'synapse.network';
      const chainId = process.env.CHAIN_ID || '1';
      
      res.json({
        nonce,
        domain,
        chainId,
        message: `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign this message to authenticate with Synapse.\n\nURI: https://${domain}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`
      });
    } catch (error) {
      // SECURITY: Don't leak internal errors
      console.error('Nonce generation error:', error);
      res.status(500).json({ error: 'Failed to generate nonce' });
    }
  }
);

/**
 * @route POST /auth/verify
 * @desc Verify SIWE signature and authenticate
 * @access Public
 * @security CSRF protection, signature verification, rate limiting
 */
router.post('/verify',
  authLimiter,
  [
    body('message')
      .notEmpty()
      .isLength({ min: 100, max: 2000 })
      .trim()
      .escape()
      .withMessage('Invalid message format'),
    body('signature')
      .notEmpty()
      .matches(/^0x[a-fA-F0-9]{130}$/)
      .withMessage('Invalid signature format'),
    body('csrfToken')
      .optional()
      .isLength({ min: 64, max: 128 })
      .withMessage('Invalid CSRF token')
  ],
  validate,
  async (req, res) => {
    try {
      const { message, signature, csrfToken } = req.body;
      
      // SECURITY: Verify SIWE with CSRF protection
      const result = await verifySiwe(message, signature, csrfToken);
      
      if (!result.success) {
        // SECURITY: Add delay to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.status(401).json({ error: result.error || 'Authentication failed' });
      }
      
      // Generate tokens with CSRF protection
      const { token, csrfToken: newCsrfToken, sessionId } = generateToken(result.address, result.chainId);
      const apiKey = generateApiKey(result.address, ['read', 'write']);
      
      // Get rate limit for this wallet
      const rateLimit = await getRateLimit(result.address);
      
      // SECURITY: Set secure session cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({
        success: true,
        address: result.address,
        token,
        csrfToken: newCsrfToken,
        apiKey,
        rateLimit,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      });
    } catch (error) {
      console.error('Auth verification error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
);

/**
 * @route POST /auth/refresh
 * @desc Refresh API key with CSRF protection
 * @access Private (requires valid token and CSRF token)
 */
router.post('/refresh',
  [
    body('csrfToken')
      .notEmpty()
      .isLength({ min: 64, max: 128 })
      .withMessage('CSRF token required')
  ],
  validate,
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { csrfToken } = req.body;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
      }
      
      const token = authHeader.slice(7);
      const result = verifyToken(token, csrfToken);
      
      if (!result.valid) {
        return res.status(401).json({ error: result.error || 'Invalid or expired token' });
      }
      
      // Generate new API key with new CSRF token
      const newApiKey = generateApiKey(result.payload.sub, ['read', 'write']);
      const newCsrfToken = generateCsrfToken(result.payload.sessionId);
      
      res.json({
        apiKey: newApiKey,
        csrfToken: newCsrfToken,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  }
);

/**
 * @route POST /auth/logout
 * @desc Revoke API key and clear session
 * @access Private
 */
router.post('/logout', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;
    
    if (apiKey) {
      revokeApiKey(apiKey);
    }
    
    // Clear session cookie
    res.clearCookie('sessionId', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * @route GET /auth/session
 * @desc Get current session info
 * @access Private
 */
router.get('/session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const csrfToken = req.headers['x-csrf-token'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    const token = authHeader.slice(7);
    const result = verifyToken(token, csrfToken);
    
    if (!result.valid) {
      return res.status(401).json({ error: result.error || 'Invalid session' });
    }
    
    res.json({
      valid: true,
      address: result.payload.sub,
      chainId: result.payload.chainId,
      expiresAt: result.payload.exp * 1000
    });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ error: 'Failed to check session' });
  }
});

module.exports = router;
