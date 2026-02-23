import WebSocket from 'ws';
import { randomUUID, createHash, generateKeyPairSync, sign, createPrivateKey } from 'crypto';
import { config } from 'dotenv';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

config();

// Receipt schema version
const RECEIPT_VERSION = '1.0';

// Key storage paths (Docker volume mounted at /app/keys)
const KEYS_DIR = '/app/keys';
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'node.key');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'node.pub');

// Node keypair for signing receipts (persisted to volume)
let nodePrivateKeyPem: string;
let nodePublicKeyPem: string;
let nodeFingerprint: string;

// P1.3: Benchmark results
interface BenchmarkResult {
  tok_per_sec: number;
  model: string;
  hardware: string;
  completed: boolean;
}
let benchmarkResult: BenchmarkResult | null = null;

/**
 * Initialize node keypair - load from volume or generate new
 * P0 TASK 1: Persist node keypair to volume
 */
function initKeypair(): void {
  // Ensure keys directory exists
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
    console.log(`Created keys directory: ${KEYS_DIR}`);
  }

  // Try to load existing keys from volume
  if (existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
    try {
      nodePrivateKeyPem = readFileSync(PRIVATE_KEY_PATH, 'utf-8');
      nodePublicKeyPem = readFileSync(PUBLIC_KEY_PATH, 'utf-8');
      
      // Generate fingerprint from public key (first 16 chars of base64 content)
      const pubKeyBase64 = nodePublicKeyPem
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '');
      nodeFingerprint = pubKeyBase64.slice(0, 16);
      
      console.log('Loaded existing node keypair from volume');
      console.log(`Node fingerprint: ${nodeFingerprint}`);
      return;
    } catch (err) {
      console.error('Failed to load existing keys, generating new ones:', err);
    }
  }

  // Generate new keypair if missing
  console.log('Generating new ed25519 keypair...');
  const kp = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  nodePrivateKeyPem = kp.privateKey as unknown as string;
  nodePublicKeyPem = kp.publicKey as unknown as string;
  
  // Persist keys to volume
  try {
    writeFileSync(PRIVATE_KEY_PATH, nodePrivateKeyPem, { mode: 0o600 }); // Restrictive permissions
    writeFileSync(PUBLIC_KEY_PATH, nodePublicKeyPem, { mode: 0o644 });
    console.log(`Persisted keypair to ${KEYS_DIR}`);
  } catch (err) {
    console.error('Failed to persist keys (continuing with memory-only):', err);
  }
  
  // Generate fingerprint
  const pubKeyBase64 = nodePublicKeyPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
  nodeFingerprint = pubKeyBase64.slice(0, 16);
  
  console.log('Generated new node keypair for receipt signing');
  console.log(`Node fingerprint: ${nodeFingerprint}`);
}

initKeypair();

const ROUTER_URL = process.env.ROUTER_URL || 'ws://localhost:3002/ws';
const NODE_WALLET = process.env.NODE_WALLET || randomUUID();
const MODEL_PROFILE = process.env.MODEL_PROFILE || 'echo-stub';
const NODE_ID = process.env.NODE_ID || randomUUID();
const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1';
const PAYOUT_RATE_PER_1M = parseFloat(process.env.PAYOUT_RATE_PER_1M || '0.0015');

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

// P1.3: Track node utilization metrics
let busyMsTotal = 0;
let wallMsStart = Date.now();
let currentJobStartMs: number | null = null;
let jobsCompleted = 0;

/**
 * P1.3: Run benchmark at startup
 * - Warmup: 1 inference
 * - Run: 5 inferences
 * - Compute tokens/sec from output
 */
async function runBenchmark(): Promise<BenchmarkResult> {
  console.log('P1.3: Starting benchmark...');
  
  const hardware = detectHardware();
  const model = isVLLMMode ? 'deepseek-v3' : 'echo-stub';
  
  // Skip benchmark for echo-stub (not meaningful)
  if (!isVLLMMode || !vllmAvailable) {
    console.log('P1.3: Skipping benchmark (echo-stub mode)');
    return {
      tok_per_sec: 0,
      model,
      hardware,
      completed: false
    };
  }
  
  const benchmarkPrompt = 'Explain quantum computing in simple terms.';
  let totalTokens = 0;
  let totalMs = 0;
  
  try {
    // Warmup: 1 inference
    console.log('P1.3: Warmup inference...');
    await runInference(benchmarkPrompt, 100);
    await new Promise(r => setTimeout(r, 100)); // Brief pause
    
    // Run: 5 inferences
    console.log('P1.3: Running 5 benchmark inferences...');
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const result = await runInference(benchmarkPrompt, 100);
      const elapsed = Date.now() - start;
      
      // Estimate tokens from output
      const outputTokens = Math.ceil(result.length / 4);
      totalTokens += outputTokens;
      totalMs += elapsed;
      
      console.log(`P1.3: Run ${i + 1}/5: ${outputTokens} tokens in ${elapsed}ms`);
    }
    
    const tokPerSec = totalTokens / (totalMs / 1000);
    console.log(`P1.3: Benchmark complete - ${tokPerSec.toFixed(2)} tok/sec`);
    
    return {
      tok_per_sec: Math.round(tokPerSec * 100) / 100,
      model,
      hardware,
      completed: true
    };
  } catch (err) {
    console.error('P1.3: Benchmark failed:', err);
    return {
      tok_per_sec: 0,
      model,
      hardware,
      completed: false
    };
  }
}

/**
 * P1.3: Helper to run a single inference for benchmarking
 */
async function runInference(prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch(`${VLLM_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-ai/DeepSeek-V3',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens
    })
  });
  
  if (!response.ok) {
    throw new Error(`Inference failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// Connect to router
const ws = new WebSocket(ROUTER_URL);

ws.on('open', async () => {
  console.log('Connected to router');
  
  // Check vLLM availability if in vLLM mode
  if (isVLLMMode) {
    const available = await checkVLLM();
    vllmAvailable = available;
    if (!available) {
      console.log('⚠️  vLLM not available, falling back to echo-stub');
    }
  }
  
  // P1.3: Run benchmark before registering
  benchmarkResult = await runBenchmark();
  
  registerNode();
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
    pricePer1m: PAYOUT_RATE_PER_1M,
    concurrency: 1,
    hardware: detectHardware(),
    receiptVersion: RECEIPT_VERSION,
    publicKey: nodePublicKeyPem,
    fingerprint: nodeFingerprint,
    // P1.3: Include benchmark results in registration
    benchmark: benchmarkResult
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
        // P1.3: Log benchmark info on registration
        if (benchmarkResult?.completed) {
          console.log(`Benchmark: ${benchmarkResult.tok_per_sec} tok/sec (${benchmarkResult.model})`);
        }
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
    // P1.3: Calculate utilization
    const now = Date.now();
    const wallMs = now - wallMsStart;
    const utilization = wallMs > 0 ? Math.round((busyMsTotal / wallMs) * 1000) / 10 : 0;
    
    // P1.3: Calculate jobs per hour
    const hoursRunning = wallMs / (1000 * 60 * 60);
    const jobsPerHour = hoursRunning > 0 ? Math.round((jobsCompleted / hoursRunning) * 10) / 10 : 0;
    
    ws.send(JSON.stringify({
      type: 'HEARTBEAT',
      load: currentJobStartMs ? 1 : 0, // Current load (1 if busy, 0 if idle)
      latency: 0,
      timestamp: Date.now(),
      // P1.3: Include benchmark metrics in heartbeat
      tok_per_sec: benchmarkResult?.tok_per_sec || 0,
      model: benchmarkResult?.model || MODEL_PROFILE,
      hardware: benchmarkResult?.hardware || detectHardware(),
      // P1.3: Include utilization metrics
      utilization,
      jobs_completed: jobsCompleted,
      jobs_per_hour: jobsPerHour
    }));
  }
}, 10000);

async function handleJob(job: Job) {
  console.log(`Processing job ${job.jobId} for model ${job.model}`);
  
  // P1.3: Track job start for utilization
  currentJobStartMs = Date.now();

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
    
    let servedModel: string;

    // Route to appropriate handler
    if (isVLLMMode && vllmAvailable && job.model === 'deepseek-v3') {
      result = await callVLLM(job);
      servedModel = 'deepseek-v3';
    } else {
      result = callEchoStub(job);
      servedModel = 'echo-stub';
    }

    const elapsedMs = Date.now() - startTime;
    const ts = Date.now();
    
    // P1.3: Update utilization tracking
    busyMsTotal += elapsedMs;
    jobsCompleted++;
    currentJobStartMs = null;

    const promptText = job.messages.map(m => m.content).join('\n');
    const promptHash = hashString(promptText);
    const outputHash = hashString(result.output);
    const nonce = randomUUID();

    const receipt = {
      version: RECEIPT_VERSION,
      jobId: job.jobId,
      nodeId: NODE_ID,
      model: job.model,
      servedModel,
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

    const signature = signReceipt(receipt);

    ws.send(JSON.stringify({
      type: 'RESULT',
      jobId: job.jobId,
      nodeId: NODE_ID,
      model: job.model,
      servedModel,
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

    console.log(`Job ${job.jobId} completed in ${elapsedMs}ms (${result.usageSource} tokens, signed, served: ${servedModel})`);

  } catch (error) {
    console.error(`Job ${job.jobId} failed:`, error);
    currentJobStartMs = null;

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
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function signReceipt(receiptData: object): string {
  const data = JSON.stringify(receiptData);
  const privateKey = createPrivateKey(nodePrivateKeyPem);
  const signature = sign(null, Buffer.from(data), privateKey);
  return signature.toString('base64');
}

function detectHardware(): string {
  const gpu = process.env.GPU_INFO || process.env.HARDWARE;
  if (gpu && gpu !== 'CPU-only') {
    return gpu;
  }
  return 'CPU-only';
}

console.log('Node Agent starting...');
console.log(`Node ID: ${NODE_ID}`);
console.log(`Wallet: ${NODE_WALLET}`);
console.log(`Profile: ${MODEL_PROFILE}`);
console.log(`vLLM URL: ${VLLM_URL}`);
console.log(`Router: ${ROUTER_URL}`);
