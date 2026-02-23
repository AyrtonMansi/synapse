# Synapse JavaScript/TypeScript SDK

Official JavaScript/TypeScript SDK for the Synapse AI API. Build powerful AI applications with streaming support, comprehensive error handling, and full TypeScript definitions.

## Installation

```bash
npm install @synapse-ai/sdk
# or
yarn add @synapse-ai/sdk
# or
pnpm add @synapse-ai/sdk
```

## Quick Start

```typescript
import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({
  apiKey: 'your-api-key',
});

// Simple completion
const response = await sdk.chatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## Features

- 🚀 **Full API Coverage** - Chat completions, embeddings, function calling, and more
- 📡 **Streaming Support** - Real-time response streaming with async generators
- 🛡️ **Robust Error Handling** - Specific error classes with retry logic
- 📦 **TypeScript First** - Complete type definitions included
- ⚡ **Batch Processing** - Efficient batch operations with concurrency control
- 🔧 **Configurable** - Customizable timeouts, retries, and base URL

## Usage

### Chat Completions

```typescript
const response = await sdk.chatCompletion({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
  ],
  temperature: 0.7,
  maxTokens: 500,
});
```

### Streaming

```typescript
const stream = sdk.streamChatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

### Function Calling

```typescript
const response = await sdk.chatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Weather in Paris?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: { /* JSON schema */ },
    },
  }],
});
```

### Embeddings

```typescript
// Single embedding
const result = await sdk.createEmbedding({
  model: 'text-embedding-3-small',
  input: 'Hello world',
});

// Batch embeddings
const results = await sdk.createEmbeddingsBatch(
  ['Text 1', 'Text 2', 'Text 3'],
  'text-embedding-3-small'
);
```

### Batch Processing

```typescript
const requests = [
  { model: 'gpt-4', messages: [{ role: 'user', content: 'Q1' }] },
  { model: 'gpt-4', messages: [{ role: 'user', content: 'Q2' }] },
];

const results = await sdk.batchCompletions(requests, 3); // concurrency of 3
```

### Error Handling

```typescript
import { 
  SynapseSDK, 
  AuthenticationError, 
  RateLimitError, 
  ValidationError 
} from '@synapse-ai/sdk';

try {
  await sdk.chatCompletion({ model: 'gpt-4', messages: [] });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Retry after:', error.retryAfter);
  } else if (error instanceof ValidationError) {
    console.log('Field errors:', error.fieldErrors);
  }
}
```

## API Reference

### `SynapseSDK`

Main SDK class for interacting with the Synapse API.

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | Required | Your Synapse API key |
| `baseUrl` | `string` | `https://api.synapse.ai/v1` | API base URL |
| `timeout` | `number` | `60000` | Request timeout in ms |
| `retries` | `number` | `3` | Number of retry attempts |
| `version` | `string` | `'v1'` | API version |

#### Methods

- `chatCompletion(request)` - Create a chat completion
- `streamChatCompletion(request)` - Stream a completion (returns async generator)
- `createEmbedding(request)` - Create embeddings
- `createEmbeddingsBatch(inputs, model)` - Batch embeddings
- `listModels()` - List available models
- `getModel(id)` - Get model info
- `batch(requests)` - Execute batch requests
- `batchCompletions(requests, concurrency)` - Batch completions with concurrency
- `getUsage(startDate?, endDate?)` - Get usage statistics

## License

MIT