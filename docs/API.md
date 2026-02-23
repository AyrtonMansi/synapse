# Synapse API Documentation

OpenAI-compatible REST API for decentralized AI inference.

## Base URL

```
Development: http://localhost:3001
Production:  https://api.synapse.network
```

## Authentication

All API endpoints (except `/health`, `/stats`, `/v1/models`, and `/auth/api-key`) require authentication via Bearer token.

```
Authorization: Bearer syn_live_xxxxxxxxxxxx
```

Generate an API key via the `/auth/api-key` endpoint.

---

## Endpoints

### Health Check

```http
GET /health
```

Returns service health status.

**Response:**
```json
{
  "status": "ok",
  "service": "gateway-api"
}
```

**Status Codes:**
- `200` - Service healthy

---

### Get Stats

```http
GET /stats
```

Returns network statistics. Cached for 5 seconds.

**Response:**
```json
{
  "nodes_online": 42,
  "jobs_today": 15234,
  "jobs_total": 892341,
  "avg_latency_ms": 245,
  "tokens_today": 4567890,
  "tokens_total": 234567890,
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| nodes_online | integer | Number of active inference nodes |
| jobs_today | integer | Jobs completed since midnight UTC |
| jobs_total | integer | Total jobs completed |
| avg_latency_ms | integer | Average inference latency |
| tokens_today | integer | Tokens processed today |
| tokens_total | integer | Total tokens processed |
| updated_at | string | ISO 8601 timestamp |

**Status Codes:**
- `200` - Success

---

### Generate API Key

```http
POST /auth/api-key
Content-Type: application/json
```

Create a new API key for accessing the inference API.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

or

```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | * | Valid email address |
| wallet | string | * | Ethereum wallet address (0x + 40 hex chars) |

*At least one of email or wallet is required

**Response:**
```json
{
  "api_key": "syn_live_abc123def456",
  "id": "uuid-of-key",
  "created_at": 1705312800000
}
```

**Status Codes:**
- `200` - Key created successfully
- `400` - Invalid input (missing email/wallet or invalid format)

---

### List Models

```http
GET /v1/models
```

List available AI models. OpenAI-compatible format.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "deepseek-v3",
      "object": "model",
      "owned_by": "deepseek"
    },
    {
      "id": "echo-stub",
      "object": "model",
      "owned_by": "synapse"
    }
  ]
}
```

**Status Codes:**
- `200` - Success

---

### Create Chat Completion

```http
POST /v1/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json
```

Create a chat completion (inference request). OpenAI-compatible.

**Request Body:**
```json
{
  "model": "deepseek-v3",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "temperature": 0.7,
  "max_tokens": 512,
  "stream": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| model | string | Yes | - | Model ID from `/v1/models` |
| messages | array | Yes | - | Array of message objects |
| messages[].role | string | Yes | - | `system`, `user`, `assistant`, or `tool` |
| messages[].content | string | Yes | - | Message text (1-32768 chars) |
| temperature | number | No | 0.7 | Sampling temperature (0-2) |
| max_tokens | integer | No | 512 | Max tokens to generate (1-8192) |
| stream | boolean | No | false | Enable streaming (not yet supported) |
| top_p | number | No | 1 | Nucleus sampling (0-1) |
| n | integer | No | 1 | Number of completions (1-10) |
| stop | string/array | No | - | Stop sequence(s) |
| presence_penalty | number | No | 0 | Presence penalty (-2 to 2) |
| frequency_penalty | number | No | 0 | Frequency penalty (-2 to 2) |
| user | string | No | - | End-user ID for tracking |

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1705312800,
  "model": "deepseek-v3",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you for asking! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 15,
    "total_tokens": 40
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request (validation error)
- `401` - Missing or invalid API key
- `429` - Rate limit exceeded
- `503` - No nodes available for model

---

### Get Usage Stats

```http
GET /usage
Authorization: Bearer {api_key}
```

Returns usage statistics for the authenticated API key.

**Response:**
```json
{
  "by_key": [
    {
      "id": "usage-event-id",
      "key_id": "key-uuid",
      "node_id": "node-uuid",
      "model": "deepseek-v3",
      "tokens_in": 25,
      "tokens_out": 15,
      "latency_ms": 245,
      "cost_estimate": 0.00006,
      "status": "success",
      "created_at": 1705312800000,
      "prompt_hash": "sha256-hash",
      "output_hash": "sha256-hash"
    }
  ],
  "stats": {
    "total_tokens": 234567,
    "total_jobs": 1234,
    "avg_latency": 245.5
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Missing or invalid API key

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable description"
}
```

For validation errors:

```json
{
  "error": "Validation error",
  "details": [
    {"path": "email", "message": "Invalid email format"},
    {"path": "model", "message": "Required"}
  ]
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid API key |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable - No nodes available |

---

## Rate Limits

- **General API**: 100 requests per minute per IP
- **Chat Completions**: 60 requests per minute per API key
- **Stats**: 30 requests per minute (cached internally)

Rate limit headers (when applicable):

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312860
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3001/v1',
  apiKey: 'syn_live_your_key_here',
});

const response = await client.chat.completions.create({
  model: 'deepseek-v3',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3001/v1",
    api_key="syn_live_your_key_here"
)

response = client.chat.completions.create(
    model="deepseek-v3",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

### cURL

```bash
# Generate API key
curl -X POST http://localhost:3001/auth/api-key \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Chat completion
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer syn_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## WebSocket (Router)

Nodes connect to the router via WebSocket for job distribution.

```
ws://router:3002/ws
```

### Node Registration

```json
{
  "type": "REGISTER",
  "nodeId": "unique-node-id",
  "wallet": "0x...",
  "models": ["deepseek-v3"],
  "pricePer1m": 0.0015,
  "concurrency": 4,
  "hardware": "A100-40GB"
}
```

### Heartbeat

```json
{
  "type": "HEARTBEAT",
  "load": 2,
  "latency": 150
}
```

### Job Result

```json
{
  "type": "RESULT",
  "jobId": "job-uuid",
  "output": "Generated text...",
  "promptHash": "sha256",
  "outputHash": "sha256",
  "tokensIn": 25,
  "tokensOut": 15,
  "elapsedMs": 245,
  "signature": "base64-signature"
}
```

---

## Version

API Version: 1.0.0
OpenAI Compatibility: 2024-01
