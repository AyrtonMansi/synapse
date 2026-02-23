# Backend Performance Optimization Guide

## Overview
This guide covers backend performance optimizations for the Synapse platform.

## 1. Redis Caching Layer

### Redis Configuration
```yaml
# redis.conf
# Memory optimization
maxmemory 2gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence (for cache, disable AOF for speed)
appendonly no
save ""

# Performance tuning
tcp-keepalive 60
timeout 0
tcp-backlog 511

# Disable snapshotting for pure cache use
stop-writes-on-bgsave-error no
rdbcompression yes
rdbchecksum no

# Client output buffer limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60
```

### Redis Client Configuration (Node.js)
```typescript
// src/cache/redis.ts
import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Connection pool
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  maxSockets: 50,
  
  // Retry strategy
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Reconnect on error
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT'];
    return targetErrors.some(e => err.message.includes(e));
  },
  
  // Enable offline queue for resilience
  enableOfflineQueue: true,
  
  // Connection timeout
  connectTimeout: 10000,
  
  // Lazy connect
  lazyConnect: true
};

// Primary connection
export const redis = new Redis(redisConfig);

// Cluster mode for production
export const redisCluster = new Redis.Cluster(
  [
    { host: 'redis-node-1', port: 6379 },
    { host: 'redis-node-2', port: 6379 },
    { host: 'redis-node-3', port: 6379 }
  ],
  {
    redisOptions: redisConfig,
    slotsRefreshTimeout: 2000,
    slotsRefreshInterval: 5000,
    natMap: {}
  }
);

// Connection health check
redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));
redis.on('reconnecting', () => console.log('Redis reconnecting...'));
```

### Caching Strategies
```typescript
// src/cache/strategies.ts
import { redis } from './redis';

// Cache-aside pattern
export class CacheAside {
  async get<T>(key: string, fetcher: () => Promise<T>, ttl: number = 300): Promise<T> {
    const cached = await redis.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const data = await fetcher();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  }
  
  async invalidate(pattern: string) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// Write-through pattern
export class WriteThrough {
  async set<T>(key: string, data: T, dbWriter: () => Promise<void>, ttl: number = 300) {
    // Write to cache first
    await redis.setex(key, ttl, JSON.stringify(data));
    
    // Then write to database
    try {
      await dbWriter();
    } catch (error) {
      // Rollback cache on DB failure
      await redis.del(key);
      throw error;
    }
  }
}

// Cache warming
export class CacheWarmer {
  async warm(pattern: string, fetcher: () => Promise<any[]>, ttl: number = 600) {
    const data = await fetcher();
    const pipeline = redis.pipeline();
    
    for (const item of data) {
      const key = `${pattern}:${item.id}`;
      pipeline.setex(key, ttl, JSON.stringify(item));
    }
    
    await pipeline.exec();
  }
}

// Usage examples
const cache = new CacheAside();

// Cache job listings
export const getJobListings = async (filters: JobFilters) => {
  const cacheKey = `jobs:list:${hashFilters(filters)}`;
  
  return cache.get(cacheKey, async () => {
    return db.jobs.findMany({
      where: filters,
      include: { employer: true },
      orderBy: { createdAt: 'desc' }
    });
  }, 60); // 1 minute TTL for frequently changing data
};

// Cache user profile
export const getUserProfile = async (userId: string) => {
  const cacheKey = `user:profile:${userId}`;
  
  return cache.get(cacheKey, async () => {
    return db.users.findUnique({
      where: { id: userId },
      include: { stats: true, reputation: true }
    });
  }, 3600); // 1 hour TTL for stable data
};

// Cache blockchain data
export const getTokenPrice = async (token: string) => {
  const cacheKey = `price:${token}`;
  
  return cache.get(cacheKey, async () => {
    return fetchTokenPriceFromOracle(token);
  }, 30); // 30 seconds TTL for price data
};
```

### Redis Pipeline Batching
```typescript
// src/cache/batch.ts
export class BatchProcessor {
  private pipeline: Redis.Pipeline;
  private batchSize: number;
  private operations: number = 0;
  
  constructor(batchSize: number = 100) {
    this.batchSize = batchSize;
    this.pipeline = redis.pipeline();
  }
  
  async get(keys: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = [];
    
    for (let i = 0; i < keys.length; i += this.batchSize) {
      const batch = keys.slice(i, i + this.batchSize);
      const batchPipeline = redis.pipeline();
      
      batch.forEach(key => batchPipeline.get(key));
      const batchResults = await batchPipeline.exec();
      
      results.push(...batchResults.map(([err, val]) => val as string | null));
    }
    
    return results;
  }
  
  async set(items: { key: string; value: string; ttl?: number }[]) {
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const batchPipeline = redis.pipeline();
      
      batch.forEach(({ key, value, ttl }) => {
        if (ttl) {
          batchPipeline.setex(key, ttl, value);
        } else {
          batchPipeline.set(key, value);
        }
      });
      
      await batchPipeline.exec();
    }
  }
}

// Usage: Batch fetch user profiles
const batch = new BatchProcessor(50);
const userIds = ['user1', 'user2', 'user3', ...]; // 1000 users
const keys = userIds.map(id => `user:profile:${id}`);
const profiles = await batch.get(keys);
```

## 2. Database Query Optimization

### PostgreSQL Configuration
```sql
-- postgresql.conf optimizations
# Memory settings (adjust based on available RAM)
shared_buffers = 4GB                    # 25% of RAM
effective_cache_size = 12GB             # 75% of RAM
work_mem = 64MB                         # Per-operation memory
maintenance_work_mem = 512MB            # For vacuum, index creation
wal_buffers = 16MB

# Query planner
effective_io_concurrency = 200          # For SSD storage
random_page_cost = 1.1                  # Lower for SSD
seq_page_cost = 1.0
default_statistics_target = 100

# Logging slow queries
log_min_duration_statement = 1000       # Log queries > 1s
log_slow_queries = on
log_queries_with_no_index = on

# Connection settings
max_connections = 200
superuser_reserved_connections = 3

# Autovacuum
autovacuum_max_workers = 4
autovacuum_naptime = 10s
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.025

# WAL settings for performance
wal_level = replica
wal_compression = on
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9
```

### Prisma Optimization
```typescript
// prisma/schema.prisma optimization
// Add indexes for frequent queries
model Job {
  id          String   @id @default(cuid())
  employerId  String
  status      JobStatus
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Indexes
  @@index([employerId])
  @@index([status])
  @@index([createdAt])
  @@index([employerId, status])
  @@index([status, createdAt])
}

model JobExecution {
  id          String   @id @default(cuid())
  jobId       String
  nodeId      String
  status      ExecutionStatus
  startedAt   DateTime
  completedAt DateTime?
  
  @@index([jobId])
  @@index([nodeId])
  @@index([status])
  @@index([startedAt])
  @@index([jobId, status])
}
```

### Query Optimization Patterns
```typescript
// src/db/optimized-queries.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' }
  ]
});

// Log slow queries
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    console.warn(`Slow query (${e.duration}ms):`, e.query);
  }
});

// Optimized job listing query
export const getJobListings = async (params: ListingParams) => {
  const { cursor, limit = 20, filters } = params;
  
  // Use cursor-based pagination instead of offset
  const jobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      ...filters
    },
    take: limit + 1, // Extra item to determine if there's a next page
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      budget: true,
      employer: {
        select: {
          id: true,
          name: true,
          avatar: true
        }
      },
      // Avoid selecting large fields
      _count: {
        select: { proposals: true }
      }
    }
  });
  
  const hasMore = jobs.length > limit;
  const items = hasMore ? jobs.slice(0, -1) : jobs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  
  return { items, nextCursor, hasMore };
};

// Batch loading with DataLoader
import DataLoader from 'dataloader';

const userLoader = new DataLoader(async (userIds: readonly string[]) => {
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } }
  });
  
  // Return in same order as keys
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id));
});

// Usage in resolvers
export const resolveJobEmployer = async (job: Job) => {
  return userLoader.load(job.employerId);
};

// Optimized aggregation query
export const getJobStats = async () => {
  // Single query for multiple stats
  const [totalJobs, activeJobs, completedJobs, totalBudget] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: 'OPEN' } }),
    prisma.job.count({ where: { status: 'COMPLETED' } }),
    prisma.job.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { budget: true }
    })
  ]);
  
  return { totalJobs, activeJobs, completedJobs, totalBudget: totalBudget._sum.budget };
};

// Connection pooling optimization
const prismaOptimized = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Connection pool settings
  // Note: These are configured in the connection string for Prisma
});

// DATABASE_URL format with pool settings:
// postgresql://user:pass@host:port/db?connection_limit=20&pool_timeout=10
```

## 3. Connection Pooling

### pgBouncer Configuration
```ini
; pgbouncer.ini
[databases]
synapse_db = host=postgres port=5432 dbname=synapse

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool settings
pool_mode = transaction           ; Transaction-level pooling
max_client_conn = 10000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

; Timeouts
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 5
query_timeout = 0
query_wait_timeout = 120

; Logging
log_connections = 0
log_disconnections = 0
stats_period = 60

; Admin
admin_users = postgres
stats_users = stats
```

### Application Connection Pool
```typescript
// src/db/pool.ts
import { Pool } from 'pg';

export const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Pool configuration
  max: 20,                    // Maximum connections
  min: 5,                     // Minimum connections
  idleTimeoutMillis: 10000,   // Close idle connections after 10s
  connectionTimeoutMillis: 5000, // Timeout for new connections
  
  // Keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Health check
pgPool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});

// Connection monitoring
export const getPoolStatus = () => ({
  totalCount: pgPool.totalCount,
  idleCount: pgPool.idleCount,
  waitingCount: pgPool.waitingCount
});

// Graceful shutdown
export const closePool = async () => {
  await pgPool.end();
};
```

## 4. Rate Limiting Optimization

### Redis Rate Limiter
```typescript
// src/middleware/rateLimiter.ts
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '@/cache/redis';

// General API rate limiter
export const apiLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_api',
  points: 100,          // 100 requests
  duration: 60,         // per minute
  blockDuration: 120,   // Block for 2 minutes if exceeded
  
  // Custom in-memory cache for speed
  inmemoryBlockOnConsumed: 120,
  inmemoryBlockDuration: 60,
  
  // Insurance limits
  insuranceLimiter: {
    points: 200,
    duration: 60
  }
});

// Strict limiter for auth endpoints
export const authLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_auth',
  points: 5,            // 5 requests
  duration: 60,         // per minute
  blockDuration: 300,   // Block for 5 minutes
  
  // Progressive penalty
  customPenalty: (points) => points * 2
});

// WebSocket connection limiter
export const wsLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_ws',
  points: 10,           // 10 connections
  duration: 60,         // per minute
  blockDuration: 60
});

// Job submission limiter (by user tier)
export const createTieredLimiter = (tier: 'free' | 'pro' | 'enterprise') => {
  const limits = {
    free: { points: 10, duration: 3600 },      // 10 jobs/hour
    pro: { points: 100, duration: 3600 },      // 100 jobs/hour
    enterprise: { points: 1000, duration: 3600 } // 1000 jobs/hour
  };
  
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: `rl_jobs_${tier}`,
    ...limits[tier]
  });
};

// Express middleware
export const rateLimitMiddleware = (limiter: RateLimiterRedis) => {
  return async (req, res, next) => {
    try {
      const key = req.user?.id || req.ip;
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.round(rejRes.msBeforeNext / 1000)
      });
    }
  };
};
```

### Distributed Rate Limiting
```typescript
// src/middleware/distributedRateLimit.ts
import { slidingWindow } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN
});

// Sliding window for accurate rate limiting
export const slidingWindowLimiter = slidingWindow({
  redis,
  limiter: slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true
});

// Token bucket for burst capacity
export const tokenBucketLimiter = {
  async consume(key: string, tokens: number = 1) {
    const bucketKey = `bucket:${key}`;
    const now = Date.now();
    
    const pipeline = redis.pipeline();
    
    // Get current bucket state
    pipeline.hgetall(bucketKey);
    
    const [bucketData] = await pipeline.exec();
    
    let tokensAvailable = parseInt(bucketData?.tokens || '10');
    const lastRefill = parseInt(bucketData?.lastRefill || '0');
    
    // Refill tokens
    const timePassed = now - lastRefill;
    const tokensToAdd = Math.floor(timePassed / 1000); // 1 token per second
    tokensAvailable = Math.min(10, tokensAvailable + tokensToAdd);
    
    if (tokensAvailable >= tokens) {
      // Consume tokens
      await redis.hset(bucketKey, {
        tokens: tokensAvailable - tokens,
        lastRefill: now
      });
      await redis.expire(bucketKey, 60);
      return { allowed: true, remaining: tokensAvailable - tokens };
    }
    
    return { allowed: false, remaining: tokensAvailable };
  }
};
```

## 5. Load Balancing Setup

### Nginx Load Balancer
```nginx
# nginx.conf
upstream synapse_backend {
    least_conn;                    # Least connections algorithm
    
    server backend-1:3000 weight=3 max_fails=3 fail_timeout=30s;
    server backend-2:3000 weight=3 max_fails=3 fail_timeout=30s;
    server backend-3:3000 weight=3 max_fails=3 fail_timeout=30s;
    server backend-4:3000 backup;  # Backup server
    
    keepalive 32;                  # Keepalive connections
    keepalive_timeout 60s;
    keepalive_requests 1000;
}

server {
    listen 80;
    server_name api.synapse.network;
    
    # Compression
    gzip on;
    gzip_types application/json application/javascript text/css;
    gzip_min_length 1000;
    
    # Timeouts
    proxy_connect_timeout 5s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Buffer settings
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
    
    location / {
        proxy_pass http://synapse_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### HAProxy Configuration
```haproxy
# haproxy.cfg
global
    maxconn 4096
    daemon
    nbthread 4

defaults
    mode http
    timeout connect 5s
    timeout client 30s
    timeout server 30s
    option httpchk GET /health
    default-server inter 2s fall 3 rise 2

frontend synapse_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/synapse.pem alpn h2,http/1.1
    
    # HTTP to HTTPS redirect
    redirect scheme https if !{ ssl_fc }
    
    # Rate limiting stick table
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    
    # Connection limits
    tcp-request connection track-sc0 src
    tcp-request connection reject if { sc_http_req_rate(0) gt 100 }
    
    default_backend synapse_backend

backend synapse_backend
    balance roundrobin
    
    # Health checks
    option httpchk GET /health
    http-check expect status 200
    
    # Servers
    server backend-1 backend-1:3000 check weight 3
    server backend-2 backend-2:3000 check weight 3
    server backend-3 backend-3:3000 check weight 3
    server backend-4 backend-4:3000 check weight 1 backup
    
    # Circuit breaker
    retries 3
    option redispatch
```

### Kubernetes Load Balancer
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: synapse-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "5"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.synapse.network
    secretName: synapse-tls
  rules:
  - host: api.synapse.network
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: synapse-backend
            port:
              number: 3000

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: synapse-backend
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
spec:
  type: LoadBalancer
  selector:
    app: synapse-backend
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  sessionAffinity: None
  externalTrafficPolicy: Local
  
---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: synapse-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: synapse-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

## Performance Monitoring Endpoints

```typescript
// src/routes/health.ts
import { Router } from 'express';
import { getPoolStatus } from '@/db/pool';
import { redis } from '@/cache/redis';

const router = Router();

// Health check
router.get('/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// Readiness check
router.get('/ready', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis
    await redis.ping();
    
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Detailed metrics
router.get('/metrics', async (req, res) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
    },
    database: getPoolStatus(),
    redis: {
      connected: redis.status === 'ready'
    },
    eventLoop: {
      lag: await measureEventLoopLag()
    }
  });
});

async function measureEventLoopLag() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      resolve(lag);
    });
  });
}

export default router;
```
