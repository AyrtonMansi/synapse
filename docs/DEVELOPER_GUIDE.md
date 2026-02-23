# Synapse Developer Guide

## Quick Start

### 1. Get API Key

```bash
curl -X POST https://api.synapse.sh/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"wallet": "0x..."}'
```

### 2. Make First Request

```bash
curl https://api.synapse.sh/v1/chat/completions \
  -H "Authorization: Bearer syn_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 3. JavaScript SDK

```bash
npm install @synapse/sdk
```

```javascript
import { Synapse } from '@synapse/sdk';

const synapse = new Synapse({
  apiKey: 'syn_live_...'
});

const response = await synapse.chat.completions.create({
  model: 'deepseek-v3',
  messages: [{ role: 'user', content: 'Explain quantum computing' }]
});

console.log(response.choices[0].message.content);
```

## Pricing

| Model | Price per 1M tokens |
|-------|---------------------|
| deepseek-v3 | $2.00 |
| llama-3-70b | $1.80 |
| llama-3-8b | $0.50 |

Pricing is **USD-stable** - costs remain constant regardless of HSK token price.

## Rate Limits

- **Per key**: 100 requests/minute
- **Concurrent**: 10 requests per key
- **Daily quota**: Configurable per API key

## High-Throughput Agents

For processing thousands of tasks:

```javascript
import { SynapseAgentOrchestrator } from '@synapse/sdk/orchestrator';

const orchestrator = new SynapseAgentOrchestrator({
  synapseApiKey: 'syn_live_...',
  redisUrl: 'redis://localhost:6379',
  concurrency: 50
});

// Submit 1000 tasks
const tasks = prompts.map(p => ({
  prompt: p,
  model: 'deepseek-v3',
  maxTokens: 500,
  priority: 5
}));

const taskIds = await orchestrator.submitBatch(tasks);
await orchestrator.waitForCompletion(taskIds);
```

## Models

```bash
curl https://api.synapse.sh/v1/models \
  -H "Authorization: Bearer syn_live_..."
```

## Error Handling

| Code | Meaning | Action |
|------|---------|--------|
| 429 | Rate limited | Backoff and retry |
| 429 | Quota exceeded | Check x-quota headers |
| 503 | No capacity | Retry with exponential backoff |

## Response Headers

```
x-synapse-model-served: deepseek-v3
x-synapse-model-requested: deepseek-v3
x-quota-tokens-used: 1500
x-quota-tokens-remaining: 98500
x-quota-reset-at: 2026-02-24T00:00:00Z
```

## Run a Node (Earn HSK)

```bash
curl -sSL https://synapse.sh/install | bash
```

Requirements:
- NVIDIA GPU with 24GB+ VRAM
- CUDA 12.0+
- 10000 HSK stake

## Support

- Discord: https://discord.gg/synapse
- Docs: https://docs.synapse.sh
- Status: https://status.synapse.sh
