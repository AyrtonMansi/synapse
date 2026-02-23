import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { createApiKey, validateApiKey } from './db/apiKeys.js';
import { createUsageEvent } from './db/usage.js';
import { dispatchJob } from './router/client.js';
import { randomUUID } from 'crypto';
import { 
  createApiKeySchema, 
  chatCompletionSchema,
  type CreateApiKeyInput,
  type ChatCompletionInput 
} from './schemas.js';

const app = Fastify({
  logger: true,
  // Request size limits to prevent DoS
  bodyLimit: 1024 * 1024, // 1MB max body size
});

// Security headers
await app.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
});

// Enable CORS with restricted origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip || 'unknown',
  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${context.after}`,
    retryAfter: context.after,
  }),
});

// Models configuration
const MODELS = [
  { id: 'deepseek-v3', object: 'model', owned_by: 'deepseek' },
  { id: 'echo-stub', object: 'model', owned_by: 'synapse' }
];

// Auth middleware
app.addHook('onRequest', async (request, reply) => {
  // Skip auth for specific routes
  const publicRoutes = ['/health', '/auth/api-key', '/v1/models', '/stats'];
  const url = new URL(request.url, `http://${request.host}`);
  if (publicRoutes.includes(url.pathname)) return;
  
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing authorization header' });
    return;
  }
  
  const key = authHeader.slice(7);
  
  // P1.2: Validate new key format before DB lookup
  // Format: syn_live_<16-char-keyId>_<32-char-secret>
  const keyRegex = /^syn_live_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$/;
  if (!keyRegex.test(key)) {
    reply.code(401).send({ 
      error: 'Invalid API key format',
      expected: 'syn_live_<16-char-keyId>_<32-char-secret>'
    });
    return;
  }
  
  const apiKey = await validateApiKey(key);
  
  if (!apiKey) {
    reply.code(401).send({ error: 'Invalid API key' });
    return;
  }
  
  // Attach key info to request
  request.apiKey = apiKey;
});

// Health check
app.get('/health', async () => ({ status: 'ok', service: 'gateway-api' }));

// Stats endpoint (public, used by web UI)
let cachedStats: any = null;
let statsCacheTime = 0;
const STATS_CACHE_TTL = parseInt(process.env.STATS_CACHE_TTL || '5000'); // 5 seconds default

app.get('/stats', async () => {
  const now = Date.now();
  
  // Return cached stats if fresh
  if (cachedStats && now - statsCacheTime < STATS_CACHE_TTL) {
    return cachedStats;
  }
  
  try {
    // Fetch router stats
    const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3002';
    const routerRes = await fetch(`${ROUTER_URL}/stats`);
    const routerStats = routerRes.ok ? await routerRes.json() : { nodes: 0 };
    
    // Fetch local usage stats
    const { getUsageStats, getJobsToday, getTokensToday } = await import('./db/usage.js');
    const usageStats = getUsageStats();
    const jobsToday = getJobsToday();
    const tokensToday = getTokensToday();
    
    cachedStats = {
      nodes_online: routerStats.nodes || 0,
      jobs_today: jobsToday,
      jobs_total: usageStats.total_jobs,
      avg_latency_ms: Math.round(usageStats.avg_latency) || 0,
      tokens_today: tokensToday,
      tokens_total: usageStats.total_tokens,
      // PHASE 5: Observability - enriched stats from router
      served_model_counts: routerStats.served_model_counts || {},
      queue_depth: routerStats.queue_depth || 0,
      nodeDetails: routerStats.nodeDetails || [],
      updated_at: new Date(now).toISOString()
    };
    
    statsCacheTime = now;
    return cachedStats;
  } catch (error) {
    // Return cached or fallback
    return cachedStats || {
      nodes_online: 0,
      jobs_today: 0,
      jobs_total: 0,
      avg_latency_ms: 0,
      tokens_today: 0,
      tokens_total: 0,
      updated_at: new Date(now).toISOString()
    };
  }
});

// Generate API key
app.post('/auth/api-key', async (request, reply) => {
  try {
    const body = createApiKeySchema.parse(request.body);
    
    const result = createApiKey(body);
    
    return {
      api_key: result.key,
      id: result.id,
      created_at: Date.now()
    };
  } catch (error) {
    if (error instanceof ZodError) {
      reply.code(400).send({ 
        error: 'Validation error', 
        details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
      });
      return;
    }
    throw error;
  }
});

// List models (OpenAI compatible)
app.get('/v1/models', async () => ({
  object: 'list',
  data: MODELS
}));

// Chat completions (OpenAI compatible)
app.post('/v1/chat/completions', async (request, reply) => {
  const startTime = Date.now();
  
  let body: ChatCompletionInput;
  try {
    body = chatCompletionSchema.parse(request.body);
  } catch (error) {
    if (error instanceof ZodError) {
      reply.code(400).send({ 
        error: 'Validation error', 
        details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
      });
      return;
    }
    throw error;
  }
  
  const { model, messages } = body;
  
  // Check if model exists
  if (!MODELS.find(m => m.id === model)) {
    reply.code(400).send({ error: 'Model not found' });
    return;
  }
  
  try {
    // Dispatch to router/node
    const result = await dispatchJob({
      model,
      messages,
      stream: body.stream || false,
      temperature: body.temperature,
      max_tokens: body.max_tokens
    });
    
    const latencyMs = Date.now() - startTime;
    
    // P0 TASK 3: Determine actual served model (fallback detection)
    const servedModel = result.served_model || result.model || model;
    const isFallback = result.fallback === true || servedModel === 'echo-stub' && model !== 'echo-stub';
    
    // Estimate tokens (simple heuristic for MVP)
    const tokensIn = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const tokensOut = Math.ceil(result.content.length / 4);
    const costEstimate = (tokensIn + tokensOut) * 0.0015 / 1000;
    
    // Log usage with receipt
    if (request.apiKey) {
      const receiptJson = JSON.stringify({
        job_id: result.job_id,
        prompt_hash: result.prompt_hash,
        output_hash: result.output_hash,
        ts: result.ts,
        // P0 TASK 2: Store verification status
        receipt_verified: result.receipt_verified || 'unsigned',
        // P0 TASK 3: Store fallback info
        served_model: servedModel,
        is_fallback: isFallback
      });
      
      createUsageEvent({
        key_id: request.apiKey.id,
        node_id: result.node_id,
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: latencyMs,
        cost_estimate: costEstimate,
        status: isFallback ? 'fallback' : 'success',
        prompt_hash: result.prompt_hash,
        output_hash: result.output_hash,
        receipt_json: receiptJson
      });
    }
    
    // P0 TASK 3: Add header for served model transparency
    reply.header('x-synapse-model-served', servedModel);
    reply.header('x-synapse-model-requested', model);
    if (isFallback) {
      reply.header('x-synapse-fallback', 'true');
    }
    
    // Return OpenAI-compatible response
    // P0 TASK 3: Include served model info in response body
    return {
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: servedModel,  // Return actual served model, not requested
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: result.content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: tokensIn,
        completion_tokens: tokensOut,
        total_tokens: tokensIn + tokensOut
      },
      // P0 TASK 3: Additional transparency fields
      synapse_meta: {
        requested_model: model,
        served_model: servedModel,
        fallback: isFallback,
        node_id: result.node_id,
        receipt_verified: result.receipt_verified || 'unsigned'
      }
    };
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    if (request.apiKey) {
      createUsageEvent({
        key_id: request.apiKey.id,
        node_id: 'error',
        model,
        tokens_in: 0,
        tokens_out: 0,
        latency_ms: latencyMs,
        cost_estimate: 0,
        status: 'error'
      });
    }
    
    reply.code(500).send({ 
      error: 'Inference failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get usage stats
app.get('/usage', async (request) => {
  if (!request.apiKey) {
    return { error: 'Unauthorized' };
  }
  
  const { getUsageByKey, getUsageStats } = await import('./db/usage.js');
  
  return {
    by_key: getUsageByKey(request.apiKey.id),
    stats: getUsageStats()
  };
});

// P1.4: Yield estimate endpoint for miners
// Formula: tok/s × utilisation × 86400 × (rate_per_1m/1e6)
app.get('/yield-estimate', async () => {
  try {
    // Fetch router stats with node details
    const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3002';
    const routerRes = await fetch(`${ROUTER_URL}/stats`);
    
    if (!routerRes.ok) {
      return { error: 'Router unavailable' };
    }
    
    const routerStats = await routerRes.json();
    const nodeDetails = routerStats.nodeDetails || [];
    
    // Calculate yield estimates for each node
    const estimates = nodeDetails.map((node: any) => {
      const tokPerSec = node.tok_per_sec || 0;
      const utilization = (node.utilization || 0) / 100; // Convert percentage to decimal
      const ratePer1M = node.pricePer1m || 0.0015;
      const jobsPerHour = node.jobs_per_hour || 0;
      
      // Formula: tok/s × utilisation × 86400 seconds/day × (rate_per_1m/1e6 tokens)
      const dailyTokens = tokPerSec * utilization * 86400;
      const dailyRevenue = dailyTokens * (ratePer1M / 1e6);
      
      return {
        fingerprint: node.fingerprint || 'unknown',
        model: node.models?.[0] || 'unknown',
        hardware: node.hardware || 'unknown',
        tok_per_sec: tokPerSec,
        utilization_percent: node.utilization || 0,
        jobs_per_hour: jobsPerHour,
        rate_per_1m_tokens: ratePer1M,
        // P1.4: Revenue band estimate (label as "estimate")
        estimated_revenue_per_day: {
          low: Math.round(dailyRevenue * 0.7 * 100) / 100,   // -30%
          expected: Math.round(dailyRevenue * 100) / 100,     // baseline
          high: Math.round(dailyRevenue * 1.3 * 100) / 100    // +30%
        },
        health_score: node.healthScore,
        success_rate: node.successRate
      };
    });
    
    return {
      nodes_online: routerStats.nodes_online || 0,
      estimates,
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Yield estimate error:', error);
    return { error: 'Failed to calculate estimates' };
  }
});

const PORT = parseInt(process.env.PORT || '3001');

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Gateway API running on port ${PORT}`);
});

// Type augmentation for request
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: {
      id: string;
      key_hash: string;
      owner_email?: string;
      owner_wallet?: string;
      created_at: number;
    };
  }
}
