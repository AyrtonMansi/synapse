import WebSocket from 'ws';
import { randomUUID, createHash, generateKeyPairSync, sign, KeyObject } from 'crypto';
import { config } from 'dotenv';

config();

// Receipt schema version
const RECEIPT_VERSION = '1.0';

// Node keypair for signing receipts (generate once and persist in production)
let nodePrivateKey: KeyObject;
let nodePublicKeyPem: string;

function initKeypair() {
  // Generate new keypair on each startup (MVP - in production, persist keys)
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  nodePrivateKey = privateKey as KeyObject;
  nodePublicKeyPem = publicKey as string;
  console.log('Generated new node keypair for receipt signing');
}

initKeypair();

const ROUTER_URL = process.env.ROUTER_URL || 'ws://localhost:3002/ws';
const NODE_WALLET = process.env.NODE_WALLET || randomUUID();
const MODEL_PROFILE = process.env.MODEL_PROFILE || 'echo-stub';
const NODE_ID = process.env.NODE_ID || randomUUID();
const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1';

interface Job {
  jobId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// Profile configuration
const PROFILE_MODELS: Record<string, string[]> = {
  'echo-stub': ['echo-stub'],  // CPU-only fallback
  'vllm': ['deepseek-v3'],     // GPU with vLLM
  'vllm-deepseek-v3': ['deepseek-v3']  // Legacy name
};

const isVLLMMode = MODEL_PROFILE === 'vllm' || MODEL_PROFILE === 'vllm-deepseek-v3';
const configuredModels = PROFILE_MODELS[MODEL_PROFILE] || ['echo-stub'];
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
    // Try vLLM health endpoint (vLLM provides /health)
    const healthUrl = VLLM_URL.replace('/v1', '') + '/health';
    const res = await fetch(healthUrl);
    return res.ok;
  } catch {
    return false;
  }
}

function registerNode() {
  // Determine models based on mode and availability
  let models: string[];

  if (isVLLMMode && vllmAvailable) {
    // Only advertise deepseek-v3 when vLLM is confirmed available
    models = ['deepseek-v3'];
  } else if (isVLLMMode && !vllmAvailable) {
    // vLLM configured but not available - cannot serve any models
    console.log('⚠️  vLLM mode but vLLM unavailable - not advertising deepseek-v3');
    models = [];
  } else {
    // echo-stub mode - only advertise echo-stub, NEVER deepseek-v3
    models = ['echo-stub'];
  }

  const registerMsg = {
    type: 'REGISTER',
    nodeId: NODE_ID,
    wallet: NODE_WALLET,
    models,
    pricePer1m: 0.0015,
    concurrency: 1,
    hardware: detectHardware(),
    receiptVersion: RECEIPT_VERSION,
    publicKey: nodePublicKeyPem
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
    let result: {
      output: string;
      tokensIn: number;
      tokensOut: number;
      tokensInReported?: number;
      tokensOutReported?: number;
      usageSource: 'reported' | 'estimated';
    };

    // Route to appropriate handler
    if (job.model === 'deepseek-v3' && vllmAvailable) {
      result = await callVLLM(job);
    } else if (job.model === 'echo-stub') {
      result = callEchoStub(job);
    } else {
      throw new Error(`Model ${job.model} not available on this node`);
    }

    const elapsedMs = Date.now() - startTime;
    const ts = Date.now();

    // Generate receipt fields (anti-fraud)
    const promptText = job.messages.map(m => m.content).join('\n');
    const promptHash = hashString(promptText);
    const outputHash = hashString(result.output);

    // Create nonce for replay protection
    const nonce = randomUUID();

    // Build receipt for signing
    const receipt = {
      version: RECEIPT_VERSION,
      jobId: job.jobId,
      nodeId: NODE_ID,
      model: job.model,
      nonce,
      ts,
      promptHash,
      outputHash,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      tokensInReported: result.tokensInReported,
      tokensOutReported: result.tokensOutReported,
      usageSource: result.usageSource
    };

    // Sign the receipt
    const signature = signReceipt(receipt);

    // Send signed result to router
    ws.send(JSON.stringify({
      type: 'RESULT',
      jobId: job.jobId,
      nodeId: NODE_ID,
      model: job.model,
      output: result.output,
      nonce,
      promptHash,
      outputHash,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      tokensInReported: result.tokensInReported,
      tokensOutReported: result.tokensOutReported,
      usageSource: result.usageSource,
      elapsedMs,
      ts,
      signature,
      receiptVersion: RECEIPT_VERSION
    }));

    console.log(`Job ${job.jobId} completed in ${elapsedMs}ms (${result.usageSource} tokens, signed)`);

  } catch (error) {
    console.error(`Job ${job.jobId} failed:`, error);

    ws.send(JSON.stringify({
      type: 'RESULT',
      jobId: job.jobId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}

async function callVLLM(job: Job): Promise<{
  output: string;
  tokensIn: number;
  tokensOut: number;
  tokensInReported?: number;
  tokensOutReported?: number;
  usageSource: 'reported' | 'estimated';
}> {
  const response = await fetch(`${VLLM_URL}/chat/completions`, {
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

  // Prefer reported tokens from vLLM, fallback to estimation
  const reportedTokensIn = data.usage?.prompt_tokens;
  const reportedTokensOut = data.usage?.completion_tokens;

  const tokensIn = reportedTokensIn ?? Math.ceil(job.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const tokensOut = reportedTokensOut ?? Math.ceil(output.length / 4);

  return {
    output,
    tokensIn,
    tokensOut,
    tokensInReported: reportedTokensIn,
    tokensOutReported: reportedTokensOut,
    usageSource: reportedTokensIn !== undefined ? 'reported' : 'estimated'
  };
}

function callEchoStub(job: Job): {
  output: string;
  tokensIn: number;
  tokensOut: number;
  tokensInReported?: number;
  tokensOutReported?: number;
  usageSource: 'reported' | 'estimated';
} {
  const lastMessage = job.messages[job.messages.length - 1];
  const output = `[Echo] ${lastMessage.content.slice(0, 200)}${lastMessage.content.length > 200 ? '...' : ''}`;
  const tokensIn = Math.ceil(job.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const tokensOut = Math.ceil(output.length / 4);

  return {
    output,
    tokensIn,
    tokensOut,
    usageSource: 'estimated'
  };
}

function hashString(str: string): string {
  // SHA-256 hash for receipt integrity
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function signReceipt(receiptData: object): string {
  // Sign receipt data with node private key
  const data = JSON.stringify(receiptData);
  const signature = sign(null, Buffer.from(data), nodePrivateKey);
  return signature.toString('base64');
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