/**
 * Redis-based session store for decentralized API gateway
 * Replaces in-memory NodeCache with Redis for horizontal scaling
 */

const Redis = require('ioredis');

class RedisSessionStore {
  constructor(redisUrl = process.env.REDIS_URL) {
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    // Key prefixes for organization
    this.NONCE_PREFIX = 'synapse:nonce:';
    this.SESSION_PREFIX = 'synapse:session:';
    this.API_KEY_PREFIX = 'synapse:apikey:';
    this.RATE_LIMIT_PREFIX = 'synapse:ratelimit:';
  }

  /**
   * Store a nonce for SIWE authentication
   */
  async storeNonce(address, nonce, ttl = 300) {
    const key = `${this.NONCE_PREFIX}${address.toLowerCase()}`;
    await this.redis.setex(key, ttl, nonce);
  }

  /**
   * Get and delete a nonce (one-time use)
   */
  async getNonce(address) {
    const key = `${this.NONCE_PREFIX}${address.toLowerCase()}`;
    const nonce = await this.redis.get(key);
    if (nonce) {
      await this.redis.del(key);
    }
    return nonce;
  }

  /**
   * Create a new session
   */
  async createSession(sessionId, data, ttl = 86400) {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.setex(key, ttl, JSON.stringify({
      ...data,
      createdAt: Date.now(),
    }));
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update session TTL (keep alive)
   */
  async touchSession(sessionId, ttl = 86400) {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.expire(key, ttl);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    return await this.redis.del(key) > 0;
  }

  /**
   * Store API key
   */
  async storeApiKey(apiKey, data, ttl = 0) {
    const key = `${this.API_KEY_PREFIX}${apiKey}`;
    const payload = JSON.stringify({
      ...data,
      createdAt: Date.now(),
    });

    if (ttl > 0) {
      await this.redis.setex(key, ttl, payload);
    } else {
      await this.redis.set(key, payload);
    }
  }

  /**
   * Get API key data
   */
  async getApiKey(apiKey) {
    const key = `${this.API_KEY_PREFIX}${apiKey}`;
    const data = await this.redis.get(key);
    
    if (data) {
      const parsed = JSON.parse(data);
      // Update last used
      parsed.lastUsed = Date.now();
      await this.redis.set(key, JSON.stringify(parsed));
      return parsed;
    }
    
    return null;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKey) {
    const key = `${this.API_KEY_PREFIX}${apiKey}`;
    return await this.redis.del(key) > 0;
  }

  /**
   * Get all API keys for an address
   */
  async getApiKeysByAddress(address) {
    const pattern = `${this.API_KEY_PREFIX}*`;
    const keys = await this.redis.keys(pattern);
    const result = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.address === address.toLowerCase()) {
          result.push({
            apiKey: key.replace(this.API_KEY_PREFIX, ''),
            ...parsed,
          });
        }
      }
    }

    return result;
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(identifier, windowSeconds, maxRequests) {
    const key = `${this.RATE_LIMIT_PREFIX}${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const count = await this.redis.zcard(key);

    if (count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, windowSeconds);

    return { allowed: true, remaining: maxRequests - count - 1 };
  }

  /**
   * Get all active sessions count
   */
  async getActiveSessionCount() {
    const pattern = `${this.SESSION_PREFIX}*`;
    const keys = await this.redis.keys(pattern);
    return keys.length;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.redis.ping();
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Close connection
   */
  async close() {
    await this.redis.quit();
  }
}

// Singleton instance
let store = null;

function getSessionStore() {
  if (!store) {
    store = new RedisSessionStore();
  }
  return store;
}

module.exports = {
  RedisSessionStore,
  getSessionStore,
};
