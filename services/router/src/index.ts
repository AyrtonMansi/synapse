import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';

const app = Fastify({ logger: true });

// Register plugins
await app.register(cors, { origin: true });
await app.register(websocket);

// In-memory node registry (will be replaced with DB in production)
interface Node {
  id: string;
  wallet: string;
  models: string[];
  pricePer1m: number;
  concurrency: number;
  hardware: string;
  socket: any;
  lastSeen: number;
  healthScore: number;
  load: number;
  latency: number;
}

const nodes = new Map<string, Node>();
const pendingJobs = new Map<string, { resolve: Function; reject: Function; timeout: any }>();

// Health check
app.get('/health', async () => ({ 
  status: 'ok', 
  service: 'router',
  nodes: nodes.size 
}));

// Get node stats
app.get('/stats', async () => ({
  nodes: nodes.size,
  nodeDetails: Array.from(nodes.values()).map(n => ({
    id: n.id,
    models: n.models,
    pricePer1m: n.pricePer1m,
    healthScore: n.healthScore,
    load: n.load,
    lastSeen: n.lastSeen
  }))
}));

// Job dispatch endpoint (called by gateway)
app.post('/dispatch', async (request, reply) => {
  const body = request.body as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
  };
  
  const { model } = body;
  
  // Find available nodes for this model
  const availableNodes = Array.from(nodes.values())
    .filter(n => 
      n.models.includes(model) && 
      n.healthScore > 0.5 &&
      n.load < n.concurrency
    )
    .sort((a, b) => {
      // Weighted scoring: health > price > latency
      const scoreA = a.healthScore * 100 - a.pricePer1m / 10 - a.latency / 100;
      const scoreB = b.healthScore * 100 - b.pricePer1m / 10 - b.latency / 100;
      return scoreB - scoreA;
    });
  
  if (availableNodes.length === 0) {
    // Fallback to echo-stub if available
    const stubNode = Array.from(nodes.values()).find(n => n.models.includes('echo-stub'));
    if (stubNode) {
      return dispatchToNode(stubNode, body);
    }
    
    reply.code(503).send({ 
      error: 'No nodes available for this model',
      model 
    });
    return;
  }
  
  // Try nodes in order until one succeeds
  for (const node of availableNodes) {
    try {
      const result = await dispatchToNode(node, body);
      return result;
    } catch (error) {
      console.error(`Node ${node.id} failed:`, error);
      node.healthScore *= 0.9; // Penalize failing node
    }
  }
  
  reply.code(503).send({ error: 'All nodes failed' });
});

function dispatchToNode(node: Node, job: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const jobId = randomUUID();
    const timeout = setTimeout(() => {
      pendingJobs.delete(jobId);
      reject(new Error('Job timeout'));
    }, 30000);
    
    pendingJobs.set(jobId, { resolve, reject, timeout });
    
    // Send job to node via WebSocket
    node.socket.send(JSON.stringify({
      type: 'JOB',
      jobId,
      ...job
    }));
  });
}

// WebSocket endpoint for nodes
app.register(async function (app) {
  app.get('/ws', { websocket: true }, (socket, req) => {
    let nodeId: string | null = null;
    
    console.log('Node connected');
    
    socket.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'REGISTER':
            nodeId = data.nodeId || randomUUID();
            const node: Node = {
              id: nodeId,
              wallet: data.wallet,
              models: data.models || ['echo-stub'],
              pricePer1m: data.pricePer1m || 0.0015,
              concurrency: data.concurrency || 1,
              hardware: data.hardware || 'unknown',
              socket,
              lastSeen: Date.now(),
              healthScore: 1.0,
              load: 0,
              latency: 0
            };
            nodes.set(nodeId, node);
            
            socket.send(JSON.stringify({
              type: 'REGISTERED',
              nodeId
            }));
            console.log(`Node registered: ${nodeId}`);
            break;
            
          case 'HEARTBEAT':
            if (nodeId && nodes.has(nodeId)) {
              const node = nodes.get(nodeId)!;
              node.lastSeen = Date.now();
              node.load = data.load || 0;
              node.latency = data.latency || 0;
              node.healthScore = Math.min(1.0, node.healthScore + 0.01);
            }
            break;
            
          case 'RESULT':
            const pending = pendingJobs.get(data.jobId);
            if (pending) {
              clearTimeout(pending.timeout);
              pendingJobs.delete(data.jobId);
              
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve({
                  content: data.output,
                  node_id: nodeId,
                  model: data.model
                });
              }
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    socket.on('close', () => {
      if (nodeId) {
        nodes.delete(nodeId);
        console.log(`Node disconnected: ${nodeId}`);
      }
    });
    
    // Send welcome message
    socket.send(JSON.stringify({ type: 'CONNECTED' }));
  });
});

// Cleanup dead nodes periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, node] of nodes) {
    if (now - node.lastSeen > 60000) { // 60 seconds timeout
      nodes.delete(id);
      console.log(`Node timeout: ${id}`);
    }
  }
}, 30000);

const PORT = parseInt(process.env.PORT || '3002');

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Router running on port ${PORT}`);
});