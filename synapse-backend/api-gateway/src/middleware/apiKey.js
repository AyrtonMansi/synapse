const { verifyApiKey } = require('./verifyApiKey');
const { smartContractRateLimit } = require('../services/rateLimiter');

/**
 * Verify API key middleware
 */
async function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const result = verifyApiKey(apiKey);
  
  if (!result.valid) {
    return res.status(401).json({ error: result.error || 'Invalid API key' });
  }
  
  req.walletAddress = result.address;
  
  // Check smart contract rate limit
  smartContractRateLimit(req, res, next);
}

module.exports = { apiKeyMiddleware };