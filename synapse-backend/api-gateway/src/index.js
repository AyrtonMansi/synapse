require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const winston = require('winston');
const promClient = require('prom-client');

// Import security middleware
const { requireJwtSecret, securityHeaders } = require('./middleware/require-jwt-secret');
const { inputValidator, validateJobRequest, validateWalletAddress } = require('./middleware/inputValidator');
const { ddosProtection } = require('./middleware/ddosProtection');
const { auditLogger } = require('./middleware/auditLogger');

// Import routes
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const nodeRoutes = require('./routes/nodes');
const reputationRoutes = require('./routes/reputation');
const healthRoutes = require('./routes/health');

// Import middleware
const { verifyApiKey } = require('./middleware/apiKey');
const { errorHandler } = require('./middleware/errorHandler');

// Validate JWT secret on startup
requireJwtSecret();

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'synapse-api-gateway' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (needed for rate limiting behind load balancer)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(securityHeaders);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Body parsing with limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prevent parameter pollution
app.use(hpp());

// Sanitize MongoDB queries
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Sanitized key: ${key} from ${req.ip}`);
  }
}));

// DDoS Protection
app.use(ddosProtection);

// Audit logging
app.use(auditLogger);

// Metrics endpoint (before rate limiting for monitoring)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Rate limiting tiers
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for sensitive endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    error: 'Too many requests', 
    retryAfter: Math.ceil(60) 
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
    res.status(options.statusCode).json(options.message);
  }
});

const standardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

const generousLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

// Speed limiting (slow down after threshold)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // Allow 100 requests at full speed
  delayMs: 500 // Add 500ms delay per request after threshold
});

app.use(speedLimiter);
app.use(standardLimiter);

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
    
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
  });
  
  next();
});

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || 
           `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Health check (no auth required)
app.use('/health', healthRoutes);

// Public auth routes (strict rate limiting)
app.use('/auth', strictLimiter, authRoutes);

// Input validation middleware
app.use(inputValidator);

// Protected routes (require API key)
app.use(verifyApiKey);

// Apply stricter rate limiting to sensitive endpoints
app.use('/jobs', validateJobRequest, jobRoutes);
app.use('/nodes', validateWalletAddress, nodeRoutes);
app.use('/reputation', reputationRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  logger.warn(`404: ${req.method} ${req.path} from ${req.ip}`);
  res.status(404).json({ 
    error: 'Endpoint not found',
    requestId: req.id
  });
});

// Graceful shutdown handling
const server = app.listen(PORT, () => {
  logger.info(`Synapse API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`JWT Secret validated: ✅`);
  logger.info(`Rate limiting: Enabled`);
  logger.info(`DDoS protection: Enabled`);
  logger.info(`Input validation: Enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Unhandled error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
