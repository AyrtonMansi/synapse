import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createApiKey, validateApiKey } from './db/apiKeys.js';
import { createUsageEvent } from './db/usage.js';
import { dispatchJob } from './router/client.js';
import { randomUUID } from 'crypto';

const app = Fastify({
  logger: true
});

// Enable CORS
await app.register(cors, {
  origin: true,
  credentials: true
});

// Models configuration
const MODELS = [
  { id: 'deepseek-v3', object: 'model', owned_by: 'deepseek' },
  { id: 'echo-stub', object: 'model', owned_by: 'synapse' }
];

// Auth middleware
app.addHook('onRequest', async (request, reply) => {
  // Skip auth for specific routes
  const publicRoutes = ['/health', '/auth/api-key', '/v1/models'];
  if (publicRoutes.includes(request.url)) return;
  
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing authorization header' });
    return;
  }
  
  const key = authHeader.slice(7);
  const apiKey = validateApiKey(key);
  
  if (!apiKey) {
    reply.code(401).send({ error: 'Invalid API key' });
    return;
  }
  
  // Attach key info to request
  request.apiKey = apiKey;
});

// Health check
app.get('/health', async () => ({ status: 'ok', service: 'gateway-api' }));

// Generate API key
app.post('/auth/api-key', async (request, reply) => {
  const { email, wallet } = request.body as { email?: string; wallet?: string };
  
  if (!email && !wallet) {
    reply.code(400).send({ error: 'Email or wallet required' });
    return;
  }
  
  const result = createApiKey({ email, wallet });
  
  return {
    api_key: result.key,
    id: result.id,
    created_at: Date.now()
  };
});

// List models (OpenAI compatible)
app.get('/v1/models', async () => ({
  object: 'list',
  data: MODELS
}));

// Chat completions (OpenAI compatible)
app.post('/v1/chat/completions', async (request, reply) => {
  const startTime = Date.now();
  const body = request.body as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
  };
  
  const { model, messages } = body;
  
  if (!model || !messages?.length) {
    reply.code(400).send({ error: 'Model and messages required' });
    return;
  }
  
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
    
    // Estimate tokens (simple heuristic for MVP)
    const tokensIn = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const tokensOut = Math.ceil(result.content.length / 4);
    const costEstimate = (tokensIn + tokensOut) * 0.0015 / 1000;
    
    // Log usage
    if (request.apiKey) {
      createUsageEvent({
        key_id: request.apiKey.id,
        node_id: result.node_id,
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: latencyMs,
        cost_estimate: costEstimate,
        status: 'success'
      });
    }
    
    // Return OpenAI-compatible response
    return {
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
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