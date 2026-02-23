/**
 * JWT Secret Enforcement
 * Ensures JWT_SECRET is properly configured before startup
 * Prevents fallback to default/insecure secrets
 */

const crypto = require('crypto');

const MIN_SECRET_LENGTH = 32;
const MIN_ENTROPY_BITS = 128;

/**
 * Calculate Shannon entropy of a string
 */
function calculateEntropy(str) {
  const len = str.length;
  const freq = {};
  
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy * len;
}

/**
 * Validate JWT secret meets security requirements
 */
function validateJwtSecret(secret) {
  const errors = [];
  
  if (!secret) {
    errors.push('JWT_SECRET environment variable is not set');
    return { valid: false, errors };
  }
  
  if (secret.length < MIN_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length})`);
  }
  
  if (calculateEntropy(secret) < MIN_ENTROPY_BITS) {
    errors.push(`JWT_SECRET has insufficient entropy (minimum ${MIN_ENTROPY_BITS} bits)`);
  }
  
  // Check for common weak secrets
  const weakPatterns = [
    /^(password|secret|key|admin|test|dev|local|default)/i,
    /^(abc|123|xyz|qwerty)/i,
    /your-secret-key/i,
    /change-in-production/i,
    /synapse-secret/i,
  ];
  
  for (const pattern of weakPatterns) {
    if (pattern.test(secret)) {
      errors.push('JWT_SECRET appears to be a default/placeholder value');
      break;
    }
  }
  
  // Check for repeated characters
  if (/^(.)\1+$/.test(secret)) {
    errors.push('JWT_SECRET contains repeated characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    entropy: calculateEntropy(secret),
  };
}

/**
 * Generate a secure JWT secret
 */
function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Middleware to ensure JWT is properly configured
 * Call this before starting the server
 */
function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const validation = validateJwtSecret(secret);
  
  if (!validation.valid) {
    console.error('\n❌ JWT_SECRET Validation Failed:');
    console.error('================================\n');
    validation.errors.forEach(err => console.error(`  • ${err}`));
    console.error('\nTo fix this issue:');
    console.error('  1. Set JWT_SECRET environment variable with a secure value');
    console.error(`  2. Minimum length: ${MIN_SECRET_LENGTH} characters`);
    console.error(`  3. Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`);
    console.error(`\nExample secure secret: ${generateSecureSecret().substring(0, 40)}...\n`);
    
    // In production, exit immediately
    if (process.env.NODE_ENV === 'production') {
      console.error('Server startup aborted: insecure JWT_SECRET in production');
      process.exit(1);
    } else {
      console.warn('⚠️  Running with insecure JWT_SECRET in development mode only');
    }
  } else {
    console.log(`✅ JWT_SECRET validated (entropy: ${validation.entropy.toFixed(1)} bits)`);
  }
  
  return validation.valid;
}

/**
 * Express middleware to add security headers
 */
function securityHeaders(req, res, next) {
  // Prevent JWT from being logged
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
}

module.exports = {
  validateJwtSecret,
  generateSecureSecret,
  requireJwtSecret,
  securityHeaders,
  MIN_SECRET_LENGTH,
  MIN_ENTROPY_BITS,
};
