const { ethers } = require('ethers');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Rate limit contract ABI (minimal)
const RATE_LIMIT_ABI = [
  "function getRateLimit(address user) external view returns (uint256 requestsPerMinute, uint256 requestsPerHour, uint256 requestsPerDay)",
  "function checkAndUpdateRateLimit(address user) external returns (bool allowed)",
  "function getRemainingQuota(address user) external view returns (uint256)"
];

// Provider setup
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || 'http://localhost:8545'
);

// Contract instance
let rateLimitContract = null;

function getRateLimitContract() {
  if (!rateLimitContract && process.env.RATE_LIMIT_CONTRACT) {
    rateLimitContract = new ethers.Contract(
      process.env.RATE_LIMIT_CONTRACT,
      RATE_LIMIT_ABI,
      provider
    );
  }
  return rateLimitContract;
}

/**
 * Get rate limit for a wallet address from smart contract
 * Falls back to default limits if contract not available
 */
async function getRateLimit(walletAddress) {
  try {
    const contract = getRateLimitContract();
    
    if (!contract) {
      // Default limits if no contract
      return {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        source: 'default'
      };
    }
    
    const limit = await contract.getRateLimit(walletAddress);
    
    return {
      requestsPerMinute: Number(limit[0]),
      requestsPerHour: Number(limit[1]),
      requestsPerDay: Number(limit[2]),
      source: 'contract'
    };
  } catch (error) {
    logger.error('Error fetching rate limit:', error.message);
    // Fallback to default
    return {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      source: 'fallback'
    };
  }
}

/**
 * Check if request is within rate limit via smart contract
 */
async function checkRateLimit(walletAddress) {
  try {
    const contract = getRateLimitContract();
    
    if (!contract) {
      // If no contract, allow all (rely on express-rate-limit)
      return { allowed: true };
    }
    
    const allowed = await contract.checkAndUpdateRateLimit(walletAddress);
    
    if (!allowed) {
      const remaining = await contract.getRemainingQuota(walletAddress);
      return {
        allowed: false,
        remaining: Number(remaining),
        resetAt: Date.now() + 60000 // Estimate
      };
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Rate limit check failed:', error.message);
    // Fail open if contract error
    return { allowed: true, warning: 'Rate limit check failed' };
  }
}

/**
 * Express middleware for smart contract-based rate limiting
 */
function smartContractRateLimit(req, res, next) {
  // Skip if no wallet context
  if (!req.walletAddress) {
    return next();
  }
  
  checkRateLimit(req.walletAddress)
    .then(result => {
      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          remaining: result.remaining,
          resetAt: result.resetAt
        });
      }
      next();
    })
    .catch(error => {
      logger.error('Rate limit middleware error:', error);
      next();
    });
}

module.exports = {
  getRateLimit,
  checkRateLimit,
  smartContractRateLimit
};