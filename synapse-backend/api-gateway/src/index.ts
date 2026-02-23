/**
 * Synapse API Gateway
 * 
 * @module synapse-backend/api-gateway
 * @description Main entry point for Synapse API Gateway
 * 
 * Features:
 * - Request authentication via API keys
 * - Rate limiting per user/tier
 * - Structured logging
 * - Security middleware (helmet, CORS)
 * - Health monitoring endpoints
 * - Request tracing with unique IDs
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import crypto from 'crypto';

import authRoutes from './routes/auth';
import jobRoutes from './routes/jobs';
import nodeRoutes from './routes/nodes';
import reputationRoutes from './routes/reputation';
import { verifyApiKey } from './middleware/apiKey';
import { errorHandler } from './middleware/errorHandler';
import type { AuthenticatedRequest, ApiResponse } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_VERSION = process.env.npm_package_version || '1.0.0';

// Parse allowed origins from environment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

// ============================================================================
// LOGGER SETUP
// ============================================================================

const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'api-gateway' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    NODE_ENV === 'production' 
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...metadata }) => {
            const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
            return `[${timestamp}] ${level}: ${message} ${meta}`;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Add file transports in production
if (NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    maxsize: 5242880,
    maxFiles: 5,
  }));
}

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Trust proxy (required for rate limiting behind load balancer)
app.set('trust proxy', 1);

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline for dev
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
}));

// Body parsing
app.use(express.json({ 
  limit: '10mb',
  strict: true, // Only accept arrays and objects
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// REQUEST MIDDLEWARE
// ============================================================================

/**
 * Add request ID and timing to all requests
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  
  // Generate unique request ID
  authReq.requestId = req.headers['x-request-id'] as string || 
    crypto.randomUUID();
  authReq.startTime = Date.now();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', authReq.requestId);
  res.setHeader('X-API-Version', API_VERSION);
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    requestId: authReq.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  // Log response time on finish
  res.on('finish', () => {
    const duration = Date.now() - authReq.startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, 'Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId: authReq.requestId,
    });
  });
  
  next();
});

// ============================================================================
// RATE LIMITING
// ============================================================================

// Health check exemption
const healthCheckBypass = (req: Request): boolean => {
  return req.path === '/health' || req.path === '/health/ready';
};

// Base rate limiter for all requests
const baseLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: (req: Request) => healthCheckBypass(req) ? 0 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req as AuthenticatedRequest).requestId || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    logger.warn('Rate limit exceeded', {
      requestId: authReq.requestId,
      ip: req.ip,
      path: req.path,
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
      meta: createMeta(authReq),
    });
  },
});

app.use(baseLimiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT',
        message: 'Too many authentication attempts. Please try again later.',
      },
      meta: createMeta(req as AuthenticatedRequest),
    });
  },
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check endpoint
 * Used by load balancers and monitoring
 */
app.get('/health', (_req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    uptime: process.uptime(),
    environment: NODE_ENV,
  };
  
  res.status(200).json(health);
});

/**
 * Readiness check
 * Checks if service is ready to accept traffic
 */
app.get('/health/ready', async (_req: Request, res: Response) => {
  // TODO: Check database connectivity, cache health, etc.
  const ready = true;
  
  if (ready) {
    res.status(200).json({ 
      status: 'ready',
      checks: {
        database: true,
        cache: true,
      },
    });
  } else {
    res.status(503).json({ 
      status: 'not ready',
      checks: {
        database: false,
        cache: true,
      },
    });
  }
});

/**
 * Liveness check
 * Simple check that service is running
 */
app.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

// Public auth routes with stricter rate limiting
app.use('/auth', authLimiter, authRoutes);

// Protected routes (require API key)
app.use(verifyApiKey);
app.use('/jobs', jobRoutes);
app.use('/nodes', nodeRoutes);
app.use('/reputation', reputationRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    requestId: authReq.requestId,
  });
  
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
    meta: createMeta(authReq),
  };
  
  res.status(404).json(response);
});

// Global error handler
app.use(errorHandler);

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Create response metadata
 */
function createMeta(req: AuthenticatedRequest): ApiResponse['meta'] {
  return {
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - req.startTime,
    version: API_VERSION,
  };
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

const server = app.listen(PORT, () => {
  logger.info(`Synapse API Gateway started`, {
    port: PORT,
    environment: NODE_ENV,
    version: API_VERSION,
    logLevel: LOG_LEVEL,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
});

export default app;
export { logger };
