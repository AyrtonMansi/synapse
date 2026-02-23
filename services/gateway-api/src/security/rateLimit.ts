/**
 * PHASE 1: Security Baseline - Rate Limiting & Abuse Detection
 * Prevents DDoS, credential stuffing, and API abuse
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  burstCount: number;
  lastRequest: number;
}

interface AbuseMetrics {
  ip: string;
  requestCount: number;
  errorCount: number;
  burstIncidents: number;
  anomalyScore: number;
  lastReset: number;
}

// Configuration
const RATE_LIMIT = {
  // Per-key limits
  keyWindowMs: 60000,      // 1 minute window
  keyMaxRequests: 100,     // 100 req/min per key
  keyBurstMax: 10,         // Max 10 requests in 1 second

  // Per-IP limits (stricter)
  ipWindowMs: 60000,
  ipMaxRequests: 200,      // 200 req/min per IP
  ipBurstMax: 20,

  // Global limits (DDoS protection)
  globalWindowMs: 1000,    // 1 second
  globalMaxRequests: 10000 // 10k req/sec globally
};

// In-memory stores (use Redis in production)
const keyLimits = new Map<string, RateLimitEntry>();
const ipLimits = new Map<string, RateLimitEntry>();
const abuseMetrics = new Map<string, AbuseMetrics>();
const blockedIps = new Set<string>();

let globalRequestCount = 0;
let globalResetTime = Date.now() + RATE_LIMIT.globalWindowMs;

/**
 * Check if client is rate limited
 * Returns: { allowed: boolean, retryAfter?: number, reason?: string }
 */
export function checkRateLimit(
  identifier: string,
  type: 'key' | 'ip' = 'key'
): { allowed: boolean; retryAfter?: number; reason?: string } {
  const now = Date.now();
  const store = type === 'key' ? keyLimits : ipLimits;
  const config = type === 'key' ? RATE_LIMIT : { ...RATE_LIMIT, keyMaxRequests: RATE_LIMIT.ipMaxRequests, keyBurstMax: RATE_LIMIT.ipBurstMax };

  // Check if IP is blocked
  if (type === 'ip' && blockedIps.has(identifier)) {
    return { allowed: false, reason: 'IP_BLOCKED' };
  }

  let entry = store.get(identifier);

  if (!entry || now > entry.resetTime) {
    // New window
    entry = {
      count: 1,
      resetTime: now + config.keyWindowMs,
      burstCount: 1,
      lastRequest: now
    };
    store.set(identifier, entry);
    return { allowed: true };
  }

  // Check burst rate (requests within 1 second)
  if (now - entry.lastRequest < 1000) {
    entry.burstCount++;
    if (entry.burstCount > config.keyBurstMax) {
      recordAbuse(identifier, type, 'burst');
      return {
        allowed: false,
        retryAfter: 1,
        reason: 'BURST_LIMIT'
      };
    }
  } else {
    entry.burstCount = 1;
  }

  // Check window limit
  if (entry.count >= config.keyMaxRequests) {
    recordAbuse(identifier, type, 'rate');
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      reason: 'RATE_LIMIT'
    };
  }

  entry.count++;
  entry.lastRequest = now;
  return { allowed: true };
}

/**
 * Check global rate limit (DDoS protection)
 */
export function checkGlobalLimit(): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  if (now > globalResetTime) {
    globalRequestCount = 1;
    globalResetTime = now + RATE_LIMIT.globalWindowMs;
    return { allowed: true };
  }

  if (globalRequestCount >= RATE_LIMIT.globalMaxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((globalResetTime - now) / 1000)
    };
  }

  globalRequestCount++;
  return { allowed: true };
}

/**
 * Record abuse incident for tracking
 */
function recordAbuse(
  identifier: string,
  type: 'key' | 'ip',
  incidentType: 'burst' | 'rate' | 'error'
): void {
  if (type === 'key') return; // Only track IP abuse

  let metrics = abuseMetrics.get(identifier);
  const now = Date.now();

  if (!metrics || now - metrics.lastReset > 3600000) { // 1 hour reset
    metrics = {
      ip: identifier,
      requestCount: 0,
      errorCount: 0,
      burstIncidents: 0,
      anomalyScore: 0,
      lastReset: now
    };
  }

  if (incidentType === 'burst') {
    metrics.burstIncidents++;
    metrics.anomalyScore += 5;
  } else if (incidentType === 'rate') {
    metrics.anomalyScore += 2;
  } else if (incidentType === 'error') {
    metrics.errorCount++;
    metrics.anomalyScore += 1;
  }

  metrics.requestCount++;

  // Auto-block if anomaly score too high
  if (metrics.anomalyScore > 50) {
    blockedIps.add(identifier);
    console.warn(`[PHASE 1] Auto-blocked IP ${identifier} due to abuse (score: ${metrics.anomalyScore})`);
  }

  abuseMetrics.set(identifier, metrics);
}

/**
 * Record API error for abuse detection
 */
export function recordError(identifier: string, type: 'key' | 'ip'): void {
  if (type === 'ip') {
    recordAbuse(identifier, type, 'error');
  }
}

/**
 * Get abuse metrics for monitoring
 */
export function getAbuseMetrics(): {
  blockedIpCount: number;
  suspiciousIps: Array<{ ip: string; score: number }>;
} {
  const suspicious: Array<{ ip: string; score: number }> = [];

  for (const [ip, metrics] of abuseMetrics) {
    if (metrics.anomalyScore > 10) {
      suspicious.push({ ip, score: metrics.anomalyScore });
    }
  }

  return {
    blockedIpCount: blockedIps.size,
    suspiciousIps: suspicious.sort((a, b) => b.score - a.score).slice(0, 10)
  };
}

/**
 * Manually block/unblock IP (admin only)
 */
export function blockIp(ip: string): void {
  blockedIps.add(ip);
}

export function unblockIp(ip: string): void {
  blockedIps.delete(ip);
}

/**
 * Cleanup old entries (call periodically)
 */
export function cleanup(): void {
  const now = Date.now();

  // Cleanup rate limit entries
  for (const [key, entry] of keyLimits) {
    if (now > entry.resetTime) {
      keyLimits.delete(key);
    }
  }

  for (const [key, entry] of ipLimits) {
    if (now > entry.resetTime) {
      ipLimits.delete(key);
    }
  }

  // Cleanup old abuse metrics
  for (const [ip, metrics] of abuseMetrics) {
    if (now - metrics.lastReset > 86400000) { // 24 hours
      abuseMetrics.delete(ip);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanup, 300000);
