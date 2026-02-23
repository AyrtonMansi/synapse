const express = require('express');
const { getNonce, verifySiwe, generateToken, generateApiKey, revokeApiKey } = require('../services/siwe');
const { getRateLimit } = require('../services/rateLimiter');

const router = express.Router();

/**
 * @route GET /auth/nonce/:address
 * @desc Get nonce for SIWE authentication
 * @access Public
 */
router.get('/nonce/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    const nonce = await getNonce(address);
    
    res.json({
      nonce,
      message: `Sign this message to authenticate with Synapse. Nonce: ${nonce}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /auth/verify
 * @desc Verify SIWE signature and authenticate
 * @access Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { message, signature } = req.body;
    
    if (!message || !signature) {
      return res.status(400).json({ error: 'Message and signature required' });
    }
    
    const result = await verifySiwe(message, signature);
    
    if (!result.success) {
      return res.status(401).json({ error: result.error || 'Authentication failed' });
    }
    
    // Generate tokens
    const token = generateToken(result.address, result.chainId);
    const apiKey = generateApiKey(result.address);
    
    // Get rate limit for this wallet
    const rateLimit = await getRateLimit(result.address);
    
    res.json({
      success: true,
      address: result.address,
      token,
      apiKey,
      rateLimit,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /auth/refresh
 * @desc Refresh API key
 * @access Private (requires valid token)
 */
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    const token = authHeader.slice(7);
    const { verifyToken, generateApiKey } = require('../services/siwe');
    const result = verifyToken(token);
    
    if (!result.valid) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    const newApiKey = generateApiKey(result.payload.sub);
    
    res.json({
      apiKey: newApiKey,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /auth/logout
 * @desc Revoke API key
 * @access Private
 */
router.post('/logout', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      revokeApiKey(apiKey);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;