import Fastify from 'fastify';
import cors from '@fastify/cors';
import { FederationCoordinator, RegionalRouter } from './federation.js';

const app = Fastify({ logger: true });

// Coordinator instance
const coordinator = new FederationCoordinator(
  process.env.COORDINATOR_ID || 'global-1',
  parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000')
);

// Enable CORS
await app.register(cors, {
  origin: true,
  credentials: true
});

// Middleware: Verify router auth
app.addHook('onRequest', async (request, reply) => {
  const authHeader = request.headers.authorization;
  
  // Skip health check
  if (request.url === '/health') return;
  
  // Verify bearer token (router auth)
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  
  const token = authHeader.slice(7);
  const expectedToken = process.env.ROUTER_AUTH_TOKEN || 'dev-token';
  
  if (token !== expectedToken) {
    reply.code(401).send({ error: 'Invalid token' });
    return;
  }
});

// Health check
app.get('/health', async () => ({
  status: 'ok',
  service: 'federation-coordinator',
  routers: coordinator.getGlobalView().routerCount
}));

// Register regional router
app.post('/federation/register', async (request, reply) => {
  const body = request.body as RegionalRouter;
  
  if (!body.id || !body.region || !body.endpoint) {
    reply.code(400).send({ error: 'Missing required fields' });
    return;
  }
  
  coordinator.registerRouter(body);
  
  return {
    registered: true,
    coordinatorId: process.env.COORDINATOR_ID || 'global-1'
  };
});

// Unregister router
app.post('/federation/unregister', async (request, reply) => {
  const { routerId } = request.body as { routerId: string };
  
  if (!routerId) {
    reply.code(400).send({ error: 'routerId required' });
    return;
  }
  
  coordinator.unregisterRouter(routerId);
  return { unregistered: true };
});

// Update router metrics
app.post('/federation/metrics', async (request, reply) => {
  const body = request.body as {
    routerId: string;
    load: number;
    capacity: number;
    nodeCount: number;
  };
  
  // Coordinator updates internal state
  // Full implementation would track these metrics
  
  return { received: true };
});

// Get routing decision
app.post('/federation/route', async (request, reply) => {
  const body = request.body as {
    preferredRegion?: string;
    model?: string;
    maxLatency?: number;
  };
  
  const decision = coordinator.routeRequest(body);
  
  if (!decision) {
    reply.code(503).send({
      error: 'No healthy routers available',
      retryAfter: 5
    });
    return;
  }
  
  return decision;
});

// Get global view
app.get('/federation/global-view', async () => {
  return coordinator.getGlobalView();
});

// Get node registry snapshot
app.get('/federation/nodes', async () => {
  const view = coordinator.getGlobalView();
  return {
    nodeCount: view.totalNodeCount,
    nodesByRegion: view.nodesByRegion,
    avgLatencyByRegion: view.avgLatencyByRegion
  };
});

// Start coordinator
coordinator.initialize();

// Start server
const PORT = parseInt(process.env.PORT || '3003');
const HOST = process.env.HOST || '0.0.0.0';

await app.listen({ port: PORT, host: HOST });
console.log(`[Coordinator] Listening on ${HOST}:${PORT}`);
