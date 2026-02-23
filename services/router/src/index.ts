import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { randomUUID, createPublicKey, verify } from 'crypto';

const app = Fastify({ 
  logger: true,
  bodyLimit: 1024 * 1024, // 1MB max body
});

// Configuration
const ROUTER_SECRET = process.env.ROUTER_SECRET;
const ENABLE_DISPATCH_AUTH = process.env.ENABLE_DISPATCH_AUTH === 'true';

// Security headers
await app.register(helmet, {
  contentSecurityPolicy: false,
});

// Register plugins
await app.register(cors, { 
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001']
    : true 
});
await app.register(websocket);

// Auth hook for dispatch endpoint
app.addHook('onRequest', async (request, reply) => {
  // Only protect dispatch endpoint
  if (request.url !== '/dispatch') return;
  if (!ENABLE_DISPATCH_AUTH || !ROUTER_SECRET) return;
  
  const authHeader = request.headers['x-router-secret'];
  if (authHeader !== ROUTER_SECRET) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
});

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
  
  // P0 TASK 2: Store node's public key for verification
  publicKey?: string;
  fingerprint?: string;
  receiptVersion?: string;
  
  // P1.3: Benchmark and telemetry data
  tok_per_sec?: number;
  utilization?: number;  // percentage (0-100)
  jobs_completed?: number;
  jobs_per_hour?: number;
  
  // Reliability tracking
  successRate: number;        // 0-1, rolling window
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  timeouts: number;
  lastError?: string;
  lastErrorAt?: number;
  avgLatencyMs: number;       // Rolling average
  latencyHistory: number[];   // Last 50 latencies for p50 calculation
}

const nodes = new Map<string, Node>();
const pendingJobs = new Map<string, { 
  resolve: Function; 
  reject: Function; 
  timeout: any;
  nodeId?: string;
  startedAt: number;
} >();

// P1.3: Track daily stats
let jobsToday = 0;
let lastDate = new Date().toDateString();

// P1.3: Track served model distribution
const servedModelCounts: Record<string, number> = {};

// Health check
app.get('/health', async () => ({ 
  status: 'ok', 
  service: 'router',
  nodes: nodes.size 
}));

// P1.3: Calculate p50 latency from history
function calculateP50(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// P1.3: Get enhanced stats with utilization, model distribution, queue depth
app.get('/stats', async () => {
  // Reset daily counter if date changed
  const today = new Date().toDateString();
  if (today !== lastDate) {
    jobsToday = 0;
    lastDate = today;
    // Reset model counts
    Object.keys(servedModelCounts).forEach(k => delete servedModelCounts[k]);
  }
  
  const nodeList = Array.from(nodes.values());
  
  // Calculate aggregate stats
  const totalJobs = nodeList.reduce((sum, n) => sum + n.totalJobs, 0);
  const avgSuccessRate = nodeList.length > 0
    ? nodeList.reduce((sum, n) => sum + n.successRate, 0) / nodeList.length
    : 0;
  
  // Collect all latencies for aggregate p50
  const allLatencies: number[] = [];
  nodeList.forEach(n => allLatencies.push(...n.latencyHistory));
  const aggregateP50 = calculateP50(allLatencies);
  
  // P1.3: Build served model distribution
  const modelDistribution: Record<string, number> = { ...servedModelCounts };
  
  return {
    // P1.3: Enhanced stats
    nodes_online: nodes.size,
    jobs_today: jobsToday,
    jobs_total: totalJobs,
    avg_latency_ms: aggregateP50,
    served_model_counts: modelDistribution,
    queue_depth: pendingJobs.size,
    
    // Detailed node info
    nodeDetails: nodeList.map(n => ({
      id: n.id,
      models: n.models,
      pricePer1m: n.pricePer1m,
      healthScore: Math.round(n.healthScore * 100) / 100,
      successRate: Math.round(n.successRate * 100) / 100,
      avgLatencyMs: Math.round(n.avgLatencyMs),
      p50LatencyMs: calculateP50(n.latencyHistory),
      totalJobs: n.totalJobs,
      successfulJobs: n.successfulJobs,
      failedJobs: n.failedJobs,
      timeouts: n.timeouts,
      lastError: n.lastError,
      load: n.load,
      lastSeen: n.lastSeen,
      fingerprint: n.fingerprint,
      // P1.3: Telemetry fields
      tok_per_sec: n.tok_per_sec || 0,
      utilization: n.utilization || 0,
      jobs_per_hour: n.jobs_per_hour || 0,
      hardware: n.hardware
    }))
  };
});

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
    // P0 TASK 3: Explicit fallback tracking
    const stubNode = Array.from(nodes.values())
      .find(n => n.models.includes('echo-stub') && n.healthScore > 0.1);
    
    if (stubNode) {
      console.log(`Fallback to echo-stub for model ${model} (no primary nodes available)`);
      const result = await dispatchToNode(stubNode, body);
      
      // P1.3: Track served model
      servedModelCounts['echo-stub'] = (servedModelCounts['echo-stub'] || 0) + 1;
      
      // P1.3: Mark as fallback
      return {
        ...result,
        fallback: true,
        requestedModel: model
      };
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
      
      // P1.3: Track served model
      const servedModel = result.served_model || model;
      servedModelCounts[servedModel] = (servedModelCounts[servedModel] || 0) + 1;
      
      // P1.3: Increment jobs today
      jobsToday++;
      
      // P0 TASK 3: Include served model info
      return {
        ...result,
        fallback: false,
        requestedModel: model
      };
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

/**
 * P0 TASK 2: Verify receipt signature using node's public key
 */
function verifyReceipt(node: Node, data: any): { valid: boolean; reason?: string } {
  // Backward compatibility: nodes without signatures are allowed (soft warning)
  if (!data.signature) {
    return { valid: true, reason: 'unsigned' };
  }
  
  // If node has no public key registered, we can't verify
  if (!node.publicKey) {
    console.warn(`Node ${node.id} sent signed receipt but has no public key registered`);
    return { valid: true, reason: 'no_pubkey' };
  }
  
  try {
    // Reconstruct receipt data (must match exactly what node signed)
    const receipt = {
      version: data.receiptVersion || '1.0',
      jobId: data.jobId,
      nodeId: data.nodeId,
      model: data.model,
      servedModel: data.servedModel,
      nonce: data.nonce,
      ts: data.ts,
      promptHash: data.promptHash,
      outputHash: data.outputHash,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      tokensInReported: data.tokensInReported,
      tokensOutReported: data.tokensOutReported,
      usageSource: data.usageSource
    };
    
    const receiptData = JSON.stringify(receipt);
    const signature = Buffer.from(data.signature, 'base64');
    
    // Create public key object from PEM
    const publicKey = createPublicKey(node.publicKey);
    
    // Verify signature
    const isValid = verify(null, Buffer.from(receiptData), publicKey, signature);
    
    if (isValid) {
      return { valid: true };
    } else {
      return { valid: false, reason: 'invalid_signature' };
    }
  } catch (err) {
    console.error(`Signature verification error for node ${node.id}:`, err);
    return { valid: false, reason: 'verification_error' };
  }
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
              
              // P0 TASK 2: Store node's public key
              publicKey: data.publicKey,
              fingerprint: data.fingerprint,
              receiptVersion: data.receiptVersion,
              
              // P1.3: Store benchmark data from registration
              tok_per_sec: data.benchmark?.tok_per_sec,
              hardware: data.benchmark?.hardware || data.hardware || 'unknown',
              
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
            console.log(`Node registered: ${nodeId} (models: ${node.models.join(', ')}, fingerprint: ${node.fingerprint || 'none'}, tok/sec: ${node.tok_per_sec || 'N/A'})`);
            break;
            
          case 'HEARTBEAT':
            if (nodeId && nodes.has(nodeId)) {
              const node = nodes.get(nodeId)!;
              node.lastSeen = Date.now();
              node.load = data.load || 0;
              node.latency = data.latency || 0;
              
              // P1.3: Store telemetry from heartbeat
              if (data.tok_per_sec !== undefined) {
                node.tok_per_sec = data.tok_per_sec;
              }
              if (data.utilization !== undefined) {
                node.utilization = data.utilization;
              }
              if (data.jobs_per_hour !== undefined) {
                node.jobs_per_hour = data.jobs_per_hour;
              }
              if (data.jobs_completed !== undefined) {
                node.jobs_completed = data.jobs_completed;
              }
              
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
                // Keep last 50 latencies for p50 calculation
                if (node.latencyHistory.length > 50) {
                  node.latencyHistory.shift();
                }
                // Update rolling average
                node.avgLatencyMs = node.latencyHistory.reduce((a, b) => a + b, 0) / node.latencyHistory.length;
              }
              
              // P0 TASK 2: Verify receipt signature
              let verificationStatus = 'unsigned';
              if (nodeId && nodes.has(nodeId)) {
                const node = nodes.get(nodeId)!;
                
                if (data.signature) {
                  const verification = verifyReceipt(node, data);
                  
                  if (verification.valid && !verification.reason) {
                    verificationStatus = 'valid';
                    console.log(`Receipt verified for job ${data.jobId} from node ${nodeId}`);
                  } else if (verification.reason === 'unsigned' || verification.reason === 'no_pubkey') {
                    // Backward compatibility - soft warning
                    verificationStatus = verification.reason;
                    if (verification.reason === 'no_pubkey') {
                      console.warn(`Node ${nodeId} signed receipt but no pubkey registered (backward compat)`);
                    }
                  } else {
                    // Invalid signature - P0 TASK 2: Reject and penalize
                    verificationStatus = `invalid:${verification.reason}`;
                    console.error(`INVALID RECEIPT from node ${nodeId}: ${verification.reason}`);
                    
                    // Apply health penalty (0.5x)
                    node.healthScore *= 0.5;
                    node.failedJobs++;
                    node.totalJobs++;
                    node.successRate = node.successfulJobs / node.totalJobs;
                    node.lastError = `Invalid receipt signature: ${verification.reason}`;
                    node.lastErrorAt = Date.now();
                    
                    // Reject the result
                    pending.reject(new Error(`Invalid receipt signature: ${verification.reason}`));
                    return;
                  }
                }
              }
              
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve({
                  content: data.output,
                  node_id: nodeId,
                  model: data.model,
                  served_model: data.servedModel,  // P0 TASK 3: Return actual served model
                  job_id: data.jobId,
                  prompt_hash: data.promptHash,
                  output_hash: data.outputHash,
                  ts: data.ts,
                  receipt_verified: verificationStatus  // P0 TASK 2: Include verification status
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
  
  // Cleanup dead nodes (15 second timeout for faster failure detection)
  for (const [id, node] of nodes) {
    if (now - node.lastSeen > 15000) {
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
}, 3000);  // Check every 3 seconds for faster node removal

const PORT = parseInt(process.env.PORT || '3002');

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Router running on port ${PORT}`);
});
