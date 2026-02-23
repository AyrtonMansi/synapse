import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const ROUTER_URL = process.env.ROUTER_URL || 'ws://localhost:3002/ws';
const NODE_WALLET = process.env.NODE_WALLET || randomUUID();
const MODEL_PROFILE = process.env.MODEL_PROFILE || 'echo-stub';
const NODE_ID = process.env.NODE_ID || randomUUID();
const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000';

interface Job {
  jobId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// Determine execution mode
const isVLLMMode = MODEL_PROFILE === 'vllm-deepseek-v3';
let vllmAvailable = false;

// Connect to router
const ws = new WebSocket(ROUTER_URL);

ws.on('open', () => {
  console.log('Connected to router');
  
  // Check vLLM availability if in vLLM mode
  if (isVLLMMode) {
    checkVLLM().then(available => {
      vllmAvailable = available;
      if (!available) {
        console.log('⚠️  vLLM not available, falling back to echo-stub');
      }
      registerNode();
    });
  } else {
    registerNode();
  }
});

async function checkVLLM(): Promise<boolean> {
  try {
    const res = await fetch(`${VLLM_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

function registerNode() {
  // Determine models based on mode and availability
  let models: string[];
  
  if (isVLLMMode && vllmAvailable) {
    models = ['deepseek-v3'];  // Only advertise deepseek-v3 when vLLM is ready
  } else {
    models = ['echo-stub'];    // Fallback to echo-stub
  }
  
  const registerMsg = {
    type: 'REGISTER',
    nodeId: NODE_ID,
    wallet: NODE_WALLET,
    models,
    pricePer1m: 0.0015,
    concurrency: 1,
    hardware: detectHardware()
  };
  
  ws.send(JSON.stringify(registerMsg));
}

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    
    switch (msg.type) {
      case 'CONNECTED':
        console.log('WebSocket connection established');
        break;
        
      case 'REGISTERED':
        console.log(`Registered as node: ${msg.nodeId}`);
        console.log(`Models: ${msg.models?.join(', ') || 'none'}`);
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
    process.exit(1);
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
    let result: { output: string; tokensIn: number; tokensOut: number };
    
    // Route to appropriate handler
    if (job.model === 'deepseek-v3' && vllmAvailable) {
      result = await callVLLM(job);
    } else {
      result = callEchoStub(job);
    }
    
    const elapsedMs = Date.now() - startTime;
    
    ws.send(JSON.stringify({
      type: 'RESULT',
      jobId: job.jobId,
      output: result.output,
      model: job.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
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

async function callVLLM(job: Job): Promise<{ output: string; tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${VLLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-ai/DeepSeek-V3',
      messages: job.messages,
      temperature: job.temperature ?? 0.7,
      max_tokens: job.max_tokens ?? 512
    })
  });
  
  if (!response.ok) {
    throw new Error(`vLLM error: ${response.status} ${await response.text()}`);
  }
  
  const data = await response.json();
  const output = data.choices[0]?.message?.content || '';
  const tokensIn = data.usage?.prompt_tokens || Math.ceil(job.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const tokensOut = data.usage?.completion_tokens || Math.ceil(output.length / 4);
  
  return { output, tokensIn, tokensOut };
}

function callEchoStub(job: Job): { output: string; tokensIn: number; tokensOut: number } {
  const lastMessage = job.messages[job.messages.length - 1];
  const output = `[${job.model === 'deepseek-v3' ? 'DeepSeek-V3 (stub)' : 'Echo'}] ${lastMessage.content.slice(0, 200)}${lastMessage.content.length > 200 ? '...' : ''}`;
  const tokensIn = Math.ceil(job.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const tokensOut = Math.ceil(output.length / 4);
  
  return { output, tokensIn, tokensOut };
}

function detectHardware(): string {
  const gpu = process.env.GPU_INFO || process.env.HARDWARE;
  if (gpu && gpu !== 'CPU-only') {
    return gpu;
  }
  
  // Try to detect GPU
  try {
    // This would need nvidia-smi or similar in real implementation
    return 'CPU-only';
  } catch {
    return 'CPU-only';
  }
}

console.log('Node Agent starting...');
console.log(`Node ID: ${NODE_ID}`);
console.log(`Wallet: ${NODE_WALLET}`);
console.log(`Profile: ${MODEL_PROFILE}`);
console.log(`vLLM URL: ${VLLM_URL}`);
console.log(`Router: ${ROUTER_URL}`);