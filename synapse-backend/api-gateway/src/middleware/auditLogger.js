/**
 * Audit Logger Middleware
 * Logs all requests for security auditing and compliance
 */

const winston = require('winston');
const path = require('path');

// Create audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'audit' },
  transports: [
    new winston.transports.File({
      filename: path.join('logs', 'audit.log'),
      maxsize: 52428800, // 50MB
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Also log to console in development
if (process.env.NODE_ENV !== 'production') {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Determine if request contains sensitive data
 */
function containsSensitiveData(path) {
  const sensitivePatterns = [
    /\/auth\/sign/,
    /\/auth\/verify/,
    /\/auth\/nonce/,
    /password/i,
    /private/i,
    /secret/i,
    /key/i,
    /signature/i,
    /mnemonic/i,
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(path));
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    'authorization',
    'x-api-key',
    'cookie',
    'x-auth-token',
    'proxy-authorization'
  ];
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Main audit logging middleware
 */
function auditLogMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Capture original end function
  const originalEnd = res.end;
  
  // Override end function to log on response
  res.end = function(chunk, encoding) {
    // Restore original function
    res.end = originalEnd;
    res.end(chunk, encoding);
    
    const duration = Date.now() - startTime;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.ip;
    
    // Build audit log entry
    const auditEntry = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      clientIp,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'],
      // Response info
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      // Security info
      contentLength: res.get('content-length'),
      rateLimitRemaining: res.get('x-ratelimit-remaining'),
      // Auth info (if available)
      walletAddress: req.walletAddress || req.user?.address,
      // Whether this contains sensitive data
      sensitive: containsSensitiveData(req.path),
    };
    
    // Don't log body for sensitive endpoints
    if (!auditEntry.sensitive && req.body && Object.keys(req.body).length > 0) {
      const bodyKeys = Object.keys(req.body);
      auditEntry.bodyKeys = bodyKeys;
    }
    
    // Log level based on status code
    if (res.statusCode >= 500) {
      auditLogger.error('Request completed with server error', auditEntry);
    } else if (res.statusCode >= 400) {
      auditLogger.warn('Request completed with client error', auditEntry);
    } else if (auditEntry.sensitive) {
      auditLogger.info('Sensitive endpoint accessed', auditEntry);
    } else {
      auditLogger.info('Request completed', auditEntry);
    }
  };
  
  next();
}

module.exports = {
  auditLogger: auditLogMiddleware,
  auditLoggerInstance: auditLogger
};
