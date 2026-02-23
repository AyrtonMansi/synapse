import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const ROUTER_URL = process.env.ROUTER_URL || 'ws://localhost:3002/ws';
const NODE_WALLET = process.env.NODE_WALLET || randomUUID();
const MODEL_PROFILE = process.env.MODEL_PROFILE || 'echo-stub';
const NODE_ID = process.env.NODE_ID || randomUUID();

interface Job {
  jobId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// Connect to router
const ws = new WebSocket(ROUTER_URL);

ws.on('open', () => {
  console.log('Connected to router');
  
  // Register with router
  const registerMsg = {
    type: 'REGISTER',
    nodeId: NODE_ID,
    wallet: NODE_WALLET,
    models: [MODEL_PROFILE, 'echo-stub'],
    pricePer1m: 0.0015,
    concurrency: 1,
    hardware: detectHardware()
  };
  
  ws.send(JSON.stringify(registerMsg));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    
    switch (msg.type) {
      case 'CONNECTED':
        console.log('WebSocket connection established');
        break;
        
      case 'REGISTERED':
        console.log(`Registered as node: ${msg.nodeId}`);
        console.log(`Status URL: http://localhost:3002/stats`);
        break;
        
      case 'JOB':
        handleJob(msg);
        break;
    }
  } catch (error) {
    console.error('Message error:', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Connection closed, retrying in 5s...');
  setTimeout(() => {
    process.exit(1); // Let Docker restart us
  }, 5000);
});

// Send heartbeats
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'HEARTBEAT',
      load: 0,
      latency: 0,
      timestamp: Date.now()
    }));
  }
}, 10000);

async function handleJob(job: Job) {
  console.log(`Processing job ${job.jobId} for model ${job.model}`);
  
  try {
    const startTime = Date.now();
    
    // Execute based on model
    let output: string;
    
    if (job.model === 'echo-stub') {
      output = generateEchoResponse(job.messages);
    } else if (job.model === 'deepseek-v3') {
      // For MVP, echo with DeepSeek branding
      output = generateEchoResponse(job.messages, 'DeepSeek V3');
    } else {
      output = generateEchoResponse(job.messages);
    }
    
    const elapsedMs = Date.now() - startTime;
    
    // Send result
    ws.send(JSON.stringify({
      type: 'RESULT',
      jobId: job.jobId,
      output,
      model: job.model,
      tokensIn: Math.ceil(job.messages.reduce((sum, m) => sum + m.content.length, 0) / 4),
      tokensOut: Math.ceil(output.length / 4),
      elapsedMs
    }));
    
    console.log(`Job ${job.jobId} completed in ${elapsedMs}ms`);
    
  } catch (error) {
    console.error(`Job ${job.jobId} failed:`, error);
    
    ws.send(JSON.stringify({
      type: 'RESULT',
      jobId: job.jobId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}

function generateEchoResponse(messages: Array<{ role: string; content: string }>, model?: string): string {
  const lastMessage = messages[messages.length - 1];
  
  if (model) {
    return `[${model}] This is a stub response. Your message was: "${lastMessage.content.slice(0, 100)}${lastMessage.content.length > 100 ? '...' : ''}"`;
  }
  
  return `Echo: ${lastMessage.content}`;
}

function detectHardware(): string {
  // For MVP, return generic hardware info
  // In production, detect GPU, RAM, etc.
  return process.env.HARDWARE || 'CPU-only';
}

console.log('Node Agent starting...');
console.log(`Node ID: ${NODE_ID}`);
console.log(`Wallet: ${NODE_WALLET}`);
console.log(`Model: ${MODEL_PROFILE}`);
console.log(`Router: ${ROUTER_URL}`);