import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';

const app = Fastify({ logger: true });

// Register plugins
await app.register(cors, { origin: true });
await app.register(websocket);

// Enhanced node interface with reliability tracking
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
  
  // Reliability tracking
  successRate: number;        // 0-1, rolling window
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  timeouts: number;
  lastError?: string;
  lastErrorAt?: number;
  avgLatencyMs: number;       // Rolling average
  latencyHistory: number[];   // Last 10 latencies
}

const nodes = new Map<string, Node>();
const pendingJobs = new Map<string, { 
  resolve: Function; 
  reject: Function; 
  timeout: any;
  nodeId?: string;
  startedAt: number;
}>();

// Health check
app.get('/health', async () => ({ 
  status: 'ok', 
  service: 'router',
  nodes: nodes.size 
}));

// Get node stats with reliability metrics
app.get('/stats', async () => ({
  nodes: nodes.size,
  nodeDetails: Array.from(nodes.values()).map(n => ({
    id: n.id,
    models: n.models,
    pricePer1m: n.pricePer1m,
    healthScore: Math.round(n.healthScore * 100) / 100,
    successRate: Math.round(n.successRate * 100) / 100,
    avgLatencyMs: Math.round(n.avgLatencyMs),
    totalJobs: n.totalJobs,
    successfulJobs: n.successfulJobs,
    failedJobs: n.failedJobs,
    timeouts: n.timeouts,
    lastError: n.lastError,
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
  
  // Find available nodes for this model with improved scoring
  const availableNodes = Array.from(nodes.values())
    .filter(n => 
      n.models.includes(model) && 
      n.healthScore > 0.3 &&           // Lower threshold but weighted heavily
      n.successRate > 0.5 &&           // Require >50% success rate
      n.load < n.concurrency
    )
    .sort((a, b) => {
      // Routing weight = success_rate * health / (1 + latency_penalty) / price_factor
      // Higher score = better node
      const latencyPenaltyA = Math.min(a.avgLatencyMs / 1000, 10); // Cap at 10x
      const latencyPenaltyB = Math.min(b.avgLatencyMs / 1000, 10);
      const priceFactorA = 1 + (a.pricePer1m / 0.01); // Normalize to ~1-2 range
      const priceFactorB = 1 + (b.pricePer1m / 0.01);
      
      const scoreA = (a.successRate * a.healthScore * 100) 
        / (1 + latencyPenaltyA) 
        / priceFactorA;
      const scoreB = (b.successRate * b.healthScore * 100) 
        / (1 + latencyPenaltyB) 
        / priceFactorB;
      
      return scoreB - scoreA;
    });
  
  if (availableNodes.length === 0) {
    // Fallback to echo-stub if available
    const stubNode = Array.from(nodes.values())
      .find(n => n.models.includes('echo-stub') && n.healthScore > 0.1);
    
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
      
      // Update success stats
      node.totalJobs++;
      node.successfulJobs++;
      node.successRate = node.successfulJobs / node.totalJobs;
      node.healthScore = Math.min(1.0, node.healthScore + 0.05);
      
      return result;
    } catch (error) {
      console.error(`Node ${node.id} failed:`, error);
      
      // Update failure stats - aggressive penalty
      node.totalJobs++;
      node.failedJobs++;
      node.successRate = node.successfulJobs / node.totalJobs;
      
      // Very aggressive penalty: 0.5x on failure, 0.3x on timeout/disconnect
      const isTimeout = error instanceof Error && 
        (error.message === 'Job timeout' || error.message === 'Node disconnected' || error.message === 'Node timeout');
      node.healthScore *= isTimeout ? 0.3 : 0.5;
      
      if (isTimeout) node.timeouts++;
      
      node.lastError = error instanceof Error ? error.message : 'Unknown error';
      node.lastErrorAt = Date.now();
    }
  }
  
  reply.code(503).send({ error: 'All nodes failed' });
});

function dispatchToNode(node: Node, job: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const jobId = randomUUID();
    const startedAt = Date.now();
    
    const timeout = setTimeout(() => {
      const pending = pendingJobs.get(jobId);
      if (pending) {
        pendingJobs.delete(jobId);
        reject(new Error('Job timeout'));
      }
    }, 30000);
    
    pendingJobs.set(jobId, { 
      resolve, 
      reject, 
      timeout,
      nodeId: node.id,
      startedAt
    });
    
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
  app.get('/ws', { websocket: true }, (connection: any, req) => {
    const socket = connection.socket;
    let nodeId: string | null = null;
    
    console.log('Node connected');
    
    socket.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'REGISTER':
            nodeId = (data.nodeId || randomUUID()) as string;
            const now = Date.now();
            
            // Check if node re-registering (preserve stats)
            const existingNode = nodes.get(nodeId);
            
            const node: Node = {
              id: nodeId,
              wallet: data.wallet,
              models: data.models || ['echo-stub'],
              pricePer1m: data.pricePer1m || 0.0015,
              concurrency: data.concurrency || 1,
              hardware: data.hardware || 'unknown',
              socket,
              lastSeen: now,
              healthScore: existingNode?.healthScore || 1.0,
              load: 0,
              latency: 0,
              
              // Reliability tracking
              successRate: existingNode?.successRate || 1.0,
              totalJobs: existingNode?.totalJobs || 0,
              successfulJobs: existingNode?.successfulJobs || 0,
              failedJobs: existingNode?.failedJobs || 0,
              timeouts: existingNode?.timeouts || 0,
              lastError: existingNode?.lastError,
              lastErrorAt: existingNode?.lastErrorAt,
              avgLatencyMs: existingNode?.avgLatencyMs || 0,
              latencyHistory: existingNode?.latencyHistory || []
            };
            
            nodes.set(nodeId, node);
            
            socket.send(JSON.stringify({
              type: 'REGISTERED',
              nodeId,
              models: node.models
            }));
            console.log(`Node registered: ${nodeId} (models: ${node.models.join(', ')})`);
            break;
            
          case 'HEARTBEAT':
            if (nodeId && nodes.has(nodeId)) {
              const node = nodes.get(nodeId)!;
              node.lastSeen = Date.now();
              node.load = data.load || 0;
              node.latency = data.latency || 0;
              
              // Gradual health recovery on heartbeat
              if (node.healthScore < 1.0) {
                node.healthScore = Math.min(1.0, node.healthScore + 0.02);
              }
            }
            break;
            
          case 'RESULT':
            const pending = pendingJobs.get(data.jobId);
            if (pending) {
              clearTimeout(pending.timeout);
              pendingJobs.delete(data.jobId);
              
              // Update latency tracking
              if (nodeId && nodes.has(nodeId) && data.elapsedMs) {
                const node = nodes.get(nodeId)!;
                node.latencyHistory.push(data.elapsedMs);
                if (node.latencyHistory.length > 10) {
                  node.latencyHistory.shift();
                }
                node.avgLatencyMs = node.latencyHistory.reduce((a, b) => a + b, 0) / node.latencyHistory.length;
              }
              
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve({
                  content: data.output,
                  node_id: nodeId,
                  model: data.model,
                  job_id: data.jobId,
                  prompt_hash: data.promptHash,
                  output_hash: data.outputHash,
                  ts: data.ts
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
      console.log(`Socket closed for node: ${nodeId || 'unknown'}`);
      
      // Clean up pending jobs for this node
      if (nodeId) {
        for (const [jobId, pending] of pendingJobs) {
          if (pending.nodeId === nodeId) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Node disconnected'));
            pendingJobs.delete(jobId);
          }
        }
        
        // Don't delete node immediately, mark for cleanup
        const node = nodes.get(nodeId);
        if (node) {
          node.lastSeen = Date.now() - 30000; // Mark as stale
        }
      }
    });
    
    // Send welcome message
    socket.send(JSON.stringify({ type: 'CONNECTED' }));
  });
});

// Cleanup dead nodes and stale pending jobs periodically
setInterval(() => {
  const now = Date.now();
  
  // Cleanup dead nodes (60 second timeout)
  for (const [id, node] of nodes) {
    if (now - node.lastSeen > 60000) {
      console.log(`Node timeout cleanup: ${id}`);
      
      // Reject any pending jobs for this node
      for (const [jobId, pending] of pendingJobs) {
        if (pending.nodeId === id) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Node timeout'));
          pendingJobs.delete(jobId);
        }
      }
      
      nodes.delete(id);
    }
  }
  
  // Cleanup stale pending jobs (>35 seconds)
  for (const [jobId, pending] of pendingJobs) {
    if (now - pending.startedAt > 35000) {
      console.log(`Stale job cleanup: ${jobId}`);
      clearTimeout(pending.timeout);
      pending.reject(new Error('Job stale'));
      pendingJobs.delete(jobId);
    }
  }
}, 10000);

const PORT = parseInt(process.env.PORT || '3002');

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Router running on port ${PORT}`);
});