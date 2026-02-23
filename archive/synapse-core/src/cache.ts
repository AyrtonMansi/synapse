/**
 * Caching Layer with TTL and LRU Support
 * 
 * @module synapse-core/cache
 * @description Flexible caching for API responses and computed values
 * 
 * @example
 * ```typescript
 * import { MemoryCache, cached } from '@synapse/core/cache';
 * 
 * const cache = new MemoryCache<string>({ ttl: 60000, maxSize: 1000 });
 * cache.set('key', 'value');
 * const value = cache.get('key');
 * ```
 */

/**
 * Cache entry metadata
 * @internal
 */
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /**
   * Total number of entries in cache
   */
  size: number;
  
  /**
   * Number of cache hits
   */
  hits: number;
  
  /**
   * Number of cache misses
   */
  misses: number;
  
  /**
   * Cache hit rate (0-1)
   */
  hitRate: number;
  
  /**
   * Number of entries evicted
   */
  evictions: number;
  
  /**
   * Number of entries expired
   */
  expirations: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Time-to-live in milliseconds
   * @default 300000 (5 minutes)
   */
  ttl: number;
  
  /**
   * Maximum number of entries
   * @default 1000
   */
  maxSize: number;
  
  /**
   * Cleanup interval in milliseconds
   * @default 60000 (1 minute)
   */
  cleanupInterval: number;
  
  /**
   * Whether to update last accessed time on get
   * @default true
   */
  updateOnAccess: boolean;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 300000, // 5 minutes
  maxSize: 1000,
  cleanupInterval: 60000, // 1 minute
  updateOnAccess: true,
};

/**
 * In-memory cache with TTL and LRU eviction
 * @class
 */
export class MemoryCache<V> {
  private readonly cache = new Map<string, CacheEntry<V>>();
  private readonly config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Store value in cache
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Optional override for TTL (ms)
   */
  set(key: string, value: V, ttl?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const effectiveTtl = ttl ?? this.config.ttl;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + effectiveTtl,
      lastAccessed: Date.now(),
      accessCount: 0,
    });
  }

  /**
   * Retrieve value from cache
   * @param key - Cache key
   * @returns Value if found and not expired, undefined otherwise
   */
  get(key: string): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }
    
    // Update access metadata
    if (this.config.updateOnAccess) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;
    }
    
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Check if key exists in cache (not expired)
   * @param key - Cache key
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Remove entry from cache
   * @param key - Cache key
   * @returns True if entry was removed
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
    };
  }

  /**
   * Get all keys (excluding expired)
   */
  keys(): string[] {
    const now = Date.now();
    const keys: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now <= entry.expiresAt) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  /**
   * Get or compute value
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param ttl - Optional TTL override
   * @returns Cached or computed value
   */
  async getOrSet(
    key: string,
    factory: () => Promise<V>,
    ttl?: number
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Dispose of cache and stop cleanup timer
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }

  /**
   * Evict least recently used entry
   * @internal
   */
  private evictLRU(): void {
    let oldest: { key: string; accessed: number } | null = null;
    
    for (const [key, entry] of this.cache) {
      if (!oldest || entry.lastAccessed < oldest.accessed) {
        oldest = { key, accessed: entry.lastAccessed };
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest.key);
      this.stats.evictions++;
    }
  }

  /**
   * Start periodic cleanup of expired entries
   * @internal
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          this.stats.expirations++;
        }
      }
    }, this.config.cleanupInterval);
  }
}

/**
 * Async function memoization with caching
 * 
 * @param fn - Function to memoize
 * @param keyGenerator - Function to generate cache key from arguments
 * @param config - Cache configuration
 * @returns Memoized function
 * 
 * @example
 * ```typescript
 * const fetchUser = memoize(
 *   async (id: string) => await api.getUser(id),
 *   (id) => `user:${id}`,
 *   { ttl: 60000 }
 * );
 * ```
 */
export function memoize<T extends (...args: unknown[]) => Promise<V>, V>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  config?: Partial<CacheConfig>
): T {
  const cache = new MemoryCache<V>(config);
  
  const memoized = async function(
    this: unknown,
    ...args: Parameters<T>
  ): Promise<V> {
    const key = keyGenerator(...args);
    return cache.getOrSet(key, () => fn.apply(this, args));
  } as T;
  
  // Expose cache methods for management
  (memoized as typeof memoized & { cache: MemoryCache<V> }).cache = cache;
  
  return memoized;
}

/**
 * Method decorator for caching
 * 
 * @param keyGenerator - Function to generate cache key
 * @param config - Cache configuration
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class UserService {
 *   @Cached((id: string) => `user:${id}`, { ttl: 60000 })
 *   async getUser(id: string) {
 *     return await this.db.getUser(id);
 *   }
 * }
 * ```
 */
export function Cached(
  keyGenerator: (...args: unknown[]) => string,
  config?: Partial<CacheConfig>
): MethodDecorator {
  const cache = new MemoryCache<unknown>(config);
  
  return function(
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): void {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(this: unknown, ...args: unknown[]) {
      const key = keyGenerator(...args);
      return cache.getOrSet(key, () => originalMethod.apply(this, args));
    };
    
    // Attach cache to method for management
    (descriptor.value as typeof descriptor.value & { cache: typeof cache }).cache = cache;
  };
}

/**
 * Cache key builder with type safety
 * @class
 */
export class CacheKeyBuilder {
  private readonly parts: string[] = [];

  /**
   * Add namespace prefix
   */
  namespace(ns: string): this {
    this.parts.unshift(ns);
    return this;
  }

  /**
   * Add path segment
   */
  segment(segment: string | number): this {
    this.parts.push(String(segment));
    return this;
  }

  /**
   * Add ID segment
   */
  id(id: string): this {
    this.parts.push(`id:${id}`);
    return this;
  }

  /**
   * Build final key string
   */
  build(): string {
    return this.parts.join(':');
  }

  /**
   * Create builder with namespace
   */
  static for(namespace: string): CacheKeyBuilder {
    return new CacheKeyBuilder().namespace(namespace);
  }
}
