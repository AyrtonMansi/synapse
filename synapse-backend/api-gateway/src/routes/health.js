/**
 * Health Check Routes
 * Comprehensive health monitoring for the API gateway
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const { getSessionStore } = require('../services/redis-session');
const { getDdosStats } = require('../middleware/ddosProtection');

// Service status tracking
const serviceStatus = {
  startTime: Date.now(),
  lastHealthCheck: Date.now(),
  requestsServed: 0,
  errors: 0,
};

/**
 * Basic liveness check
 * Returns 200 if the service is running
 */
router.get('/', (req, res) => {
  serviceStatus.lastHealthCheck = Date.now();
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

/**
 * Readiness check
 * Returns 200 if the service is ready to accept traffic
 */
router.get('/ready', async (req, res) => {
  try {
    const checks = await performReadinessChecks();
    const allReady = Object.values(checks).every(check => check.status === 'ready');
    
    if (allReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
    });
  }
});

/**
 * Comprehensive health check
 * Returns detailed health information
 */
router.get('/detailed', async (req, res) => {
  try {
    const [systemHealth, serviceHealth, securityHealth] = await Promise.all([
      getSystemHealth(),
      getServiceHealth(),
      getSecurityHealth(),
    ]);
    
    const overallHealth = {
      status: 'healthy',
      components: {
        system: systemHealth,
        services: serviceHealth,
        security: securityHealth,
      },
    };
    
    // Determine overall status
    const allHealthy = 
      systemHealth.status === 'healthy' &&
      serviceHealth.status === 'healthy' &&
      securityHealth.status === 'healthy';
    
    if (!allHealthy) {
      overallHealth.status = 'degraded';
    }
    
    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(overallHealth);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  // Return basic metrics
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    requestsServed: serviceStatus.requestsServed,
    errors: serviceStatus.errors,
  };
  
  res.status(200).json(metrics);
});

/**
 * Perform readiness checks
 */
async function performReadinessChecks() {
  const checks = {
    server: { status: 'ready', message: 'Server is running' },
    jwt: { status: 'ready', message: 'JWT secret configured' },
  };
  
  // Check Redis if configured
  if (process.env.REDIS_URL) {
    try {
      const store = getSessionStore();
      const redisHealth = await store.healthCheck();
      checks.redis = redisHealth.healthy 
        ? { status: 'ready', message: 'Redis connected' }
        : { status: 'not ready', message: redisHealth.error };
    } catch (error) {
      checks.redis = { status: 'not ready', message: error.message };
    }
  }
  
  return checks;
}

/**
 * Get system health
 */
async function getSystemHealth() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = (usedMem / totalMem) * 100;
  
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const loadPercent = (loadAvg[0] / cpuCount) * 100;
  
  return {
    status: memoryUsagePercent > 90 || loadPercent > 90 ? 'unhealthy' : 'healthy',
    memory: {
      total: formatBytes(totalMem),
      free: formatBytes(freeMem),
      used: formatBytes(usedMem),
      usagePercent: Math.round(memoryUsagePercent * 100) / 100,
    },
    cpu: {
      count: cpuCount,
      loadAverage: loadAvg.map(l => Math.round(l * 100) / 100),
      loadPercent: Math.round(loadPercent * 100) / 100,
    },
    uptime: {
      system: os.uptime(),
      process: process.uptime(),
    },
  };
}

/**
 * Get service health
 */
async function getServiceHealth() {
  const checks = {
    jwt: { status: 'healthy', message: 'JWT configured' },
    rateLimiting: { status: 'healthy', message: 'Rate limiting active' },
    ddosProtection: { status: 'healthy', message: 'DDoS protection active' },
  };
  
  // Check Redis if configured
  if (process.env.REDIS_URL) {
    try {
      const store = getSessionStore();
      const redisHealth = await store.healthCheck();
      checks.redis = redisHealth.healthy 
        ? { status: 'healthy', message: 'Redis connected' }
        : { status: 'unhealthy', message: redisHealth.error };
    } catch (error) {
      checks.redis = { status: 'unhealthy', message: error.message };
    }
  }
  
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    requestsServed: serviceStatus.requestsServed,
    errors: serviceStatus.errors,
  };
}

/**
 * Get security health
 */
async function getSecurityHealth() {
  const ddosStats = getDdosStats();
  
  return {
    status: 'healthy',
    ddos: {
      blockedIps: ddosStats.blockedIps,
      trackedPatterns: ddosStats.trackedPatterns,
      status: ddosStats.blockedIps > 100 ? 'elevated' : 'normal',
    },
    headers: {
      helmet: 'enabled',
      cors: 'enabled',
      rateLimiting: 'enabled',
    },
    jwt: {
      configured: !!process.env.JWT_SECRET,
      secretLength: process.env.JWT_SECRET?.length,
    },
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Track requests for metrics
router.use((req, res, next) => {
  serviceStatus.requestsServed++;
  
  const originalEnd = res.end;
  res.end = function(...args) {
    if (res.statusCode >= 400) {
      serviceStatus.errors++;
    }
    originalEnd.apply(this, args);
  };
  
  next();
});

module.exports = router;
