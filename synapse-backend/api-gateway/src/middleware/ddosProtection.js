/**
 * DDoS Protection Middleware
 * Detects and blocks distributed denial of service attacks
 */

const NodeCache = require('node-cache');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'warn',
  format: winston.format.json(),
  defaultMeta: { service: 'ddos-protection' },
  transports: [new winston.transports.Console()]
});

// Configuration
const CONFIG = {
  // Window size for tracking requests
  windowMs: 60 * 1000, // 1 minute
  
  // Maximum requests per window before suspicious
  maxRequestsPerWindow: 1000,
  
  // Maximum failed requests before blocking
  maxFailedRequests: 50,
  
  // Block duration in milliseconds
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
  
  // Suspicious patterns
  suspiciousPatterns: [
    // Rapid sequential requests
    { pattern: 'rapid', threshold: 10, windowMs: 1000 },
    // Burst detection
    { pattern: 'burst', threshold: 50, windowMs: 5000 },
    // Path scanning
    { pattern: 'scanning', threshold: 20, uniquePaths: true },
  ],
  
  // Whitelisted IPs (internal services, etc.)
  whitelist: process.env.WHITELISTED_IPS?.split(',') || ['127.0.0.1', '::1'],
};

// Caches for tracking
const requestCache = new NodeCache({ stdTTL: 60 }); // Request counts
const failedCache = new NodeCache({ stdTTL: 300 }); // Failed request counts
const blockCache = new NodeCache({ stdTTL: 900 }); // Blocked IPs
const patternCache = new NodeCache({ stdTTL: 60 }); // Pattern tracking

/**
 * Get client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip;
}

/**
 * Check if IP is whitelisted
 */
function isWhitelisted(ip) {
  return CONFIG.whitelist.includes(ip);
}

/**
 * Check if IP is blocked
 */
function isBlocked(ip) {
  return blockCache.has(ip);
}

/**
 * Block an IP address
 */
function blockIp(ip, reason) {
  blockCache.set(ip, {
    blockedAt: Date.now(),
    reason,
    expiresAt: Date.now() + CONFIG.blockDurationMs
  });
  
  logger.warn(`IP blocked: ${ip}`, { reason, duration: CONFIG.blockDurationMs });
}

/**
 * Track request patterns
 */
function trackPattern(ip, path) {
  const key = `${ip}:patterns`;
  const patterns = patternCache.get(key) || {
    requests: [],
    paths: new Set(),
    failedRequests: 0
  };
  
  const now = Date.now();
  
  // Add current request
  patterns.requests.push(now);
  patterns.paths.add(path);
  
  // Clean old requests (older than 1 minute)
  patterns.requests = patterns.requests.filter(t => now - t < 60000);
  
  patternCache.set(key, patterns);
  
  return patterns;
}

/**
 * Detect DDoS patterns
 */
function detectDdos(ip, path, patterns) {
  const now = Date.now();
  
  // Check rapid requests
  const recentRequests = patterns.requests.filter(t => now - t < 1000);
  if (recentRequests.length > 10) {
    return { detected: true, reason: 'rapid_requests', count: recentRequests.length };
  }
  
  // Check burst
  const burstRequests = patterns.requests.filter(t => now - t < 5000);
  if (burstRequests.length > 50) {
    return { detected: true, reason: 'burst_detected', count: burstRequests.length };
  }
  
  // Check path scanning
  if (patterns.paths.size > 20) {
    return { detected: true, reason: 'path_scanning', uniquePaths: patterns.paths.size };
  }
  
  // Check total requests in window
  if (patterns.requests.length > CONFIG.maxRequestsPerWindow) {
    return { detected: true, reason: 'request_limit', count: patterns.requests.length };
  }
  
  return { detected: false };
}

/**
 * Track failed requests
 */
function trackFailedRequest(ip) {
  const key = `${ip}:failed`;
  const count = (failedCache.get(key) || 0) + 1;
  failedCache.set(key, count);
  
  if (count > CONFIG.maxFailedRequests) {
    blockIp(ip, 'too_many_failed_requests');
    return true;
  }
  
  return false;
}

/**
 * Main DDoS protection middleware
 */
function ddosProtection(req, res, next) {
  const ip = getClientIp(req);
  
  // Skip whitelisted IPs
  if (isWhitelisted(ip)) {
    return next();
  }
  
  // Check if blocked
  if (isBlocked(ip)) {
    const blockInfo = blockCache.get(ip);
    logger.warn(`Blocked request from ${ip}`, { path: req.path });
    
    return res.status(403).json({
      error: 'Access temporarily blocked',
      reason: blockInfo?.reason || 'suspicious_activity',
      retryAfter: Math.ceil((blockInfo?.expiresAt - Date.now()) / 1000)
    });
  }
  
  // Track patterns
  const patterns = trackPattern(ip, req.path);
  
  // Detect DDoS
  const detection = detectDdos(ip, req.path, patterns);
  
  if (detection.detected) {
    blockIp(ip, detection.reason);
    
    return res.status(429).json({
      error: 'Rate limit exceeded - possible DDoS detected',
      reason: detection.reason,
      retryAfter: Math.ceil(CONFIG.blockDurationMs / 1000)
    });
  }
  
  // Track response for failed request detection
  const originalEnd = res.end;
  res.end = function(...args) {
    if (res.statusCode >= 400) {
      trackFailedRequest(ip);
    }
    originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * Get DDoS statistics
 */
function getDdosStats() {
  return {
    blockedIps: blockCache.keys().length,
    trackedPatterns: patternCache.keys().length,
    failedRequests: failedCache.keys().length,
    whitelistSize: CONFIG.whitelist.length
  };
}

/**
 * Manually unblock an IP
 */
function unblockIp(ip) {
  return blockCache.del(ip) > 0;
}

module.exports = {
  ddosProtection,
  getDdosStats,
  unblockIp,
  isBlocked,
  blockIp
};
