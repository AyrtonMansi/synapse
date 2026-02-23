# Synapse API Reference

## Base URLs

| Environment | URL | Rate Limit |
|-------------|-----|------------|
| Production | `https://api.synapse.io/v1` | 1000 req/min |
| Staging | `https://api.staging.synapse.io/v1` | 100 req/min |
| Development | `https://api.dev.synapse.io/v1` | Unlimited |

## Authentication

All API requests require authentication using an API key passed in the header:

```http
Authorization: Bearer {your_api_key}
```

### API Key Tiers

| Tier | Rate Limit | Concurrent Tasks | Price |
|------|------------|------------------|-------|
| Free | 100/min | 1 | $0 |
| Developer | 1000/min | 10 | $49/mo |
| Professional | 10000/min | 100 | $199/mo |
| Enterprise | Custom | Unlimited | Custom |

## Common Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-02-23T02:13:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request payload is malformed",
    "details": { ... }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-02-23T02:13:00Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMITED` | 429 | Too many requests |
| `INVALID_REQUEST` | 400 | Malformed request |
| `TASK_NOT_FOUND` | 404 | Task ID does not exist |
| `INSUFFICIENT_FUNDS` | 402 | Account balance too low |
| `COMPUTE_ERROR` | 500 | Node execution failed |
| `TIMEOUT` | 504 | Task exceeded deadline |

---

## Tasks

### Submit Task

Submit a computation task to the network.

```http
POST /tasks
```

**Request Body:**

```json
{
  "type": "inference",
  "model": "meta-llama/Llama-2-70b",
  "input": {
    "prompt": "Explain quantum computing",
    "max_tokens": 500,
    "temperature": 0.7
  },
  "requirements": {
    "min_gpu_vram": "40GB",
    "tee_required": true,
    "max_latency_ms": 5000
  },
  "payment": {
    "max_price": "10.00",
    "currency": "SYN"
  },
  "timeout": 300
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "task_id": "task_abc123xyz",
    "status": "pending",
    "estimated_cost": "2.50",
    "estimated_duration": 45,
    "submitted_at": "2026-02-23T02:13:00Z"
  }
}
```

### Get Task Status

Retrieve the current status of a task.

```http
GET /tasks/{task_id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "task_id": "task_abc123xyz",
    "status": "completed",
    "progress": 100,
    "node_id": "node_def456",
    "started_at": "2026-02-23T02:13:05Z",
    "completed_at": "2026-02-23T02:13:48Z",
    "cost": "2.35",
    "result": {
      "output": "Quantum computing leverages quantum mechanics...",
      "tokens_generated": 487
    }
  }
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `pending` | Task queued, awaiting node assignment |
| `assigned` | Node assigned, preparing execution |
| `running` | Task actively executing |
| `completed` | Task finished successfully |
| `failed` | Task execution failed |
| `cancelled` | Task cancelled by user |

### List Tasks

Retrieve a list of tasks with optional filtering.

```http
GET /tasks?status=completed&limit=50&cursor=xyz789
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `type` | string | Filter by task type |
| `from` | ISO8601 | Start date filter |
| `to` | ISO8601 | End date filter |
| `limit` | integer | Results per page (max 100) |
| `cursor` | string | Pagination cursor |

**Response:**

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "task_id": "task_abc123",
        "status": "completed",
        "type": "inference",
        "cost": "2.35",
        "created_at": "2026-02-23T01:00:00Z"
      }
    ],
    "pagination": {
      "has_more": true,
      "next_cursor": "abc789",
      "total_count": 156
    }
  }
}
```

### Cancel Task

Cancel a pending or running task.

```http
POST /tasks/{task_id}/cancel
```

**Response:**

```json
{
  "success": true,
  "data": {
    "task_id": "task_abc123xyz",
    "status": "cancelled",
    "refund_amount": "1.20"
  }
}
```

---

## Models

### List Available Models

Get a list of AI models available on the network.

```http
GET /models
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `capability` | string | Filter by capability (text, image, audio) |
| `min_vram` | string | Minimum GPU VRAM required |
| `provider` | string | Filter by model provider |

**Response:**

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "meta-llama/Llama-2-70b",
        "name": "Llama 2 70B",
        "provider": "Meta",
        "capabilities": ["text-generation", "chat"],
        "requirements": {
          "min_vram": "40GB",
          "recommended_vram": "80GB"
        },
        "pricing": {
          "per_1k_tokens": "0.002",
          "currency": "SYN"
        }
      }
    ]
  }
}
```

### Get Model Details

```http
GET /models/{model_id}
```

### Upload Custom Model

Upload a custom model to the network.

```http
POST /models
Content-Type: multipart/form-data
```

**Request:**

```http
model_file: <binary>
config: {
  "name": "my-custom-model",
  "description": "Custom fine-tuned model",
  "capabilities": ["text-generation"],
  "requirements": {
    "min_vram": "24GB"
  },
  "visibility": "private"
}
```

---

## Account

### Get Account Info

```http
GET /account
```

**Response:**

```json
{
  "success": true,
  "data": {
    "account_id": "acc_xyz789",
    "tier": "professional",
    "balances": {
      "SYN": "15000.50",
      "ETH": "2.5"
    },
    "usage": {
      "tasks_this_month": 1250,
      "compute_hours": 450.5,
      "cost_this_month": "450.25"
    },
    "limits": {
      "rate_limit": 10000,
      "concurrent_tasks": 100,
      "monthly_budget": "1000.00"
    }
  }
}
```

### Get Usage Statistics

```http
GET /account/usage?period=30d
```

**Response:**

```json
{
  "success": true,
  "data": {
    "period": "30d",
    "total_tasks": 4523,
    "total_cost": "1250.50",
    "breakdown": {
      "inference": {"tasks": 4000, "cost": "800.00"},
      "training": {"tasks": 50, "cost": "400.00"},
      "data_processing": {"tasks": 473, "cost": "50.50"}
    }
  }
}
```

---

## Nodes (Node Operators)

### Register Node

```http
POST /nodes
```

**Request:**

```json
{
  "stake_amount": "50000",
  "hardware_specs": {
    "cpu_cores": 32,
    "ram_gb": 128,
    "gpu": "NVIDIA RTX 4090",
    "vram_gb": 24,
    "storage_gb": 2000,
    "network_mbps": 1000
  },
  "tee_type": "intel_sgx",
  "location": {
    "country": "US",
    "region": "us-east-1"
  }
}
```

### Get Node Status

```http
GET /nodes/{node_id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "node_id": "node_abc123",
    "status": "active",
    "stake": "50000",
    "reputation_score": 98.5,
    "uptime_percentage": 99.9,
    "earnings": {
      "total": "2500.50",
      "this_epoch": "45.25",
      "projected_monthly": "1350.00"
    },
    "stats": {
      "tasks_completed": 15234,
      "tasks_failed": 12,
      "avg_task_duration": 45.2
    }
  }
}
```

### List Node Tasks

```http
GET /nodes/{node_id}/tasks
```

---

## WebSocket API

For real-time updates, connect to the WebSocket endpoint:

```
wss://api.synapse.io/v1/ws
```

### Authentication

Include your API key as a query parameter:

```
wss://api.synapse.io/v1/ws?token={your_api_key}
```

### Subscribe to Events

```json
{
  "action": "subscribe",
  "events": ["task.update", "task.completed", "account.balance"]
}
```

### Event Types

| Event | Description |
|-------|-------------|
| `task.pending` | Task submitted and queued |
| `task.assigned` | Task assigned to node |
| `task.running` | Task execution started |
| `task.progress` | Progress update (0-100%) |
| `task.completed` | Task finished successfully |
| `task.failed` | Task execution failed |
| `account.balance` | Balance change notification |

### Example: Listen for Task Completion

```javascript
const ws = new WebSocket('wss://api.synapse.io/v1/ws?token=YOUR_API_KEY');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    events: ['task.completed', 'task.failed']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'task.completed') {
    console.log('Task completed:', data.task_id);
    console.log('Result:', data.result);
  }
};
```

---

## SDK Examples

### Python SDK

```python
from synapse import SynapseClient

# Initialize client
client = SynapseClient(api_key="your_api_key")

# Submit inference task
result = client.inference(
    model="meta-llama/Llama-2-70b",
    prompt="Explain quantum computing",
    max_tokens=500
)

print(result.output)
```

### JavaScript/TypeScript SDK

```typescript
import { SynapseClient } from '@synapse/sdk';

const client = new SynapseClient({ apiKey: 'your_api_key' });

// Submit task and wait for completion
const result = await client.inference({
  model: 'meta-llama/Llama-2-70b',
  prompt: 'Explain quantum computing',
  maxTokens: 500
});

console.log(result.output);
```

### cURL Examples

```bash
# Submit task
curl -X POST https://api.synapse.io/v1/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "inference",
    "model": "meta-llama/Llama-2-70b",
    "input": {
      "prompt": "Hello, world!",
      "max_tokens": 100
    }
  }'

# Check task status
curl https://api.synapse.io/v1/tasks/task_abc123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

*For detailed SDK documentation, visit https://docs.synapse.io/sdks*
