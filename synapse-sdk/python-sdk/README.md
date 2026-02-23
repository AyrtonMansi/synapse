# Synapse Python SDK

Official Python SDK for the Synapse AI API. Build powerful AI applications with async support, batch processing, and Jupyter integration.

## Installation

```bash
pip install synapse-ai-sdk
```

### Optional Dependencies

```bash
# Jupyter integration
pip install synapse-ai-sdk[jupyter]

# Development tools
pip install synapse-ai-sdk[dev]
```

## Quick Start

```python
import asyncio
from synapse_sdk import SynapseSDK, CompletionRequest, Message, MessageRole

async def main():
    sdk = SynapseSDK(api_key="your-api-key")
    
    response = await sdk.chat_completion(
        CompletionRequest(
            model="gpt-4",
            messages=[
                Message(role=MessageRole.USER, content="Hello!")
            ]
        )
    )
    
    print(response.choices[0].message.content)
    await sdk.close()

asyncio.run(main())
```

## Features

- 🚀 **Full Async Support** - Built on asyncio and aiohttp
- 📦 **Batch Processing** - Efficient batch operations with concurrency control
- 📊 **Jupyter Integration** - Special utilities for notebooks
- 🛡️ **Robust Error Handling** - Specific error classes with retry logic
- 🔄 **Streaming Support** - Real-time response streaming
- 🧮 **Type Hints** - Full type annotations throughout

## Usage

### Async Context Manager

```python
async with SynapseSDK(api_key="your-key") as sdk:
    response = await sdk.chat_completion(...)
# Session automatically closed
```

### Streaming

```python
async for chunk in sdk.stream_chat_completion(request):
    content = chunk.choices[0].delta.get("content", "")
    print(content, end="", flush=True)
```

### Batch Processing

```python
requests = [
    CompletionRequest(model="gpt-4", messages=[...]),
    CompletionRequest(model="gpt-4", messages=[...]),
]

results = await sdk.batch_completions(requests, concurrency=5)
```

### Embeddings

```python
# Single embedding
response = await sdk.create_embedding(
    EmbeddingRequest(model="text-embedding-3-small", input="Hello")
)

# Batch embeddings
responses = await sdk.create_embeddings_batch(
    texts=["Hello", "World", "..."],
    model="text-embedding-3-small",
    batch_size=100,
    concurrency=5
)
```

### Function Calling

```python
response = await sdk.chat_completion(
    CompletionRequest(
        model="gpt-4",
        messages=[Message(role=MessageRole.USER, content="Weather in Paris?")],
        tools=[
            Tool(
                type="function",
                function=FunctionDefinition(
                    name="get_weather",
                    description="Get weather",
                    parameters={
                        "type": "object",
                        "properties": {
                            "location": {"type": "string"}
                        },
                        "required": ["location"]
                    }
                )
            )
        ]
    )
)
```

## Jupyter Integration

```python
from synapse_sdk import SynapseSDK, JupyterIntegration

sdk = SynapseSDK(api_key="your-key")
jupyter = JupyterIntegration(sdk)

# Simple chat
response = await jupyter.chat("What is machine learning?")

# Streaming chat
async for chunk in jupyter.chat_stream("Tell me a story"):
    pass  # Automatically displays in notebook

# Embeddings
embeddings = await jupyter.embed(["text1", "text2"])

# Display usage stats
usage = await sdk.get_usage()
jupyter.display_usage(usage)
```

## Error Handling

```python
from synapse_sdk import (
    SynapseSDK,
    AuthenticationError,
    RateLimitError,
    ValidationError,
    TimeoutError
)

try:
    response = await sdk.chat_completion(request)
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
except ValidationError as e:
    print(f"Validation failed: {e.field_errors}")
except AuthenticationError:
    print("Invalid API key")
except TimeoutError:
    print("Request timed out")
```

## API Reference

### `SynapseSDK`

Main SDK class for interacting with the Synapse API.

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `api_key` | `str` | Required | Your Synapse API key |
| `base_url` | `str` | `https://api.synapse.ai/v1` | API base URL |
| `timeout` | `float` | `60.0` | Request timeout in seconds |
| `retries` | `int` | `3` | Number of retry attempts |
| `version` | `str` | `v1` | API version |

#### Methods

- `chat_completion(request)` - Create a chat completion
- `stream_chat_completion(request)` - Stream a completion
- `create_embedding(request)` - Create embeddings
- `create_embeddings_batch(inputs, model, ...)` - Batch embeddings
- `batch_completions(requests, concurrency, on_progress)` - Batch completions
- `list_models()` - List available models
- `get_model(model_id)` - Get model info
- `get_usage(start_date, end_date)` - Get usage statistics

## License

MIT