/**
 * Synapse Payment Service - Main Entry Point
 * 
 * @module synapse-payments
 * @description Hybrid fiat/crypto payment system for Synapse Network
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Routes
import paymentRoutes from './routes/payments';
import stripeRoutes from './routes/stripe';
import cryptoRoutes from './routes/crypto';
import subscriptionRoutes from './routes/subscriptions';
import creditRoutes from './routes/credits';
import kycRoutes from './routes/kyc';
import receiptRoutes from './routes/receipts';
import adminRoutes from './routes/admin';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';

// Services
import { StripeService } from './services/stripe';
import { CryptoPaymentService } from './services/cryptoPayment';
import { CreditService } from './services/credit';
import { KycService } from './services/kyc';
import { ReceiptService } from './services/receipt';
import { TreasuryService } from './services/treasury';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_VERSION = process.env.npm_package_version || '1.0.0';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'];

// ============================================================================
// LOGGER SETUP
// ============================================================================

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'synapse-payments' },
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

// ============================================================================
// DATABASE & CACHE SETUP
// ============================================================================

export const prisma = new PrismaClient({
  log: NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
});

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

export let stripeService: StripeService;
export let cryptoPaymentService: CryptoPaymentService;
export let creditService: CreditService;
export let kycService: KycService;
export let receiptService: ReceiptService;
export let treasuryService: TreasuryService;

async function initializeServices(): Promise<void> {
  try {
    // Initialize Treasury Service first (manages HSK)
    treasuryService = new TreasuryService({
      rpcUrl: process.env.RPC_URL || 'https://rpc.sepolia.org',
      chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
      treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY!,
      hskTokenAddress: process.env.HSK_TOKEN_ADDRESS!,
      minTreasuryBalance: process.env.MIN_TREASURY_BALANCE || '1000000000000000000000000', // 1M HSK
    });
    await treasuryService.initialize();
    logger.info('Treasury service initialized');

    // Initialize Stripe Service
    stripeService = new StripeService({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    }, prisma, treasuryService);
    logger.info('Stripe service initialized');

    // Initialize Crypto Payment Service
    cryptoPaymentService = new CryptoPaymentService({
      rpcUrls: {
        1: process.env.ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
        137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
        11155111: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
      },
      treasuryAddress: process.env.TREASURY_ADDRESS!,
      hskTokenAddress: process.env.HSK_TOKEN_ADDRESS!,
      paymentTimeoutMinutes: 30,
    }, prisma, treasuryService);
    logger.info('Crypto payment service initialized');

    // Initialize Credit Service
    creditService = new CreditService({
      creditsPerUsd: 1000, // 1000 credits per $1
      kycThreshold: 1000, // $1000 requires KYC
      maxPurchaseWithoutKyc: 500, // $500 max without KYC
    }, prisma, redis);
    logger.info('Credit service initialized');

    // Initialize KYC Service
    kycService = new KycService({
      provider: (process.env.KYC_PROVIDER as any) || 'stripe',
      apiKey: process.env.KYC_API_KEY!,
      secretKey: process.env.KYC_SECRET_KEY!,
      webhookSecret: process.env.KYC_WEBHOOK_SECRET!,
    }, prisma);
    logger.info('KYC service initialized');

    // Initialize Receipt Service
    receiptService = new ReceiptService({
      companyName: process.env.COMPANY_NAME || 'Synapse Network Inc.',
      companyAddress: process.env.COMPANY_ADDRESS || '123 Blockchain St, Crypto City',
      taxId: process.env.COMPANY_TAX_ID || '12-3456789',
      receiptBucket: process.env.RECEIPT_S3_BUCKET || 'synapse-receipts',
    }, prisma);
    logger.info('Receipt service initialized');

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'https:', 'https://*.stripe.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://*.stripe.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ["'self'", 'https://*.stripe.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin) || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'Stripe-Signature'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Raw body for Stripe webhooks
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Request logging
app.use(requestLogger);

// ============================================================================
// RATE LIMITING
// ============================================================================

const baseLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    });
  },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
});

app.use(baseLimiter);

// ============================================================================
// HEALTH CHECKS
// ============================================================================

app.get('/health', async (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    uptime: process.uptime(),
    environment: NODE_ENV,
    services: {
      database: await checkDatabase(),
      redis: redis.status === 'ready',
      stripe: !!stripeService,
      treasury: !!treasuryService,
    },
  };
  
  const isHealthy = Object.values(health.services).every(Boolean);
  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

app.get('/health/ready', async (_req, res) => {
  const ready = await checkDatabase() && redis.status === 'ready';
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not ready' });
});

// ============================================================================
// ROUTES
// ============================================================================

// Public routes
app.use('/stripe', stripeRoutes);
app.use('/crypto', cryptoRoutes);

// Protected routes (require authentication)
app.use(authMiddleware);
app.use('/payments', paymentRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/credits', creditRoutes);
app.use('/kyc', kycRoutes);
app.use('/receipts', receiptRoutes);
app.use('/admin', adminRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
  });
});

// Global error handler
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer(): Promise<void> {
  try {
    // Initialize services
    await initializeServices();
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Synapse Payment Service started`, {
        port: PORT,
        environment: NODE_ENV,
        version: API_VERSION,
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await prisma.$disconnect();
        await redis.quit();
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(async () => {
        await prisma.$disconnect();
        await redis.quit();
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
});

// Start the server
startServer();

export default app;