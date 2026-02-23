# Synapse CLI

Command-line interface for managing Synapse AI API keys, monitoring usage, testing models, and deployment helpers.

## Installation

```bash
npm install -g @synapse-ai/cli
```

## Quick Start

```bash
# Add your API key
synapse auth add

# List available models
synapse models list

# Test a model
synapse models test gpt-4

# Check usage
synapse usage show

# Start interactive chat
synapse chat
```

## Commands

### Authentication

```bash
# Add a new API key
synapse auth add my-key --key sk-...

# List configured keys
synapse auth list

# Set default key
synapse auth use my-key

# Remove a key
synapse auth remove my-key
```

### Models

```bash
# List all models
synapse models list

# Filter by provider
synapse models list --filter openai

# Get model info
synapse models info gpt-4

# Test a model
synapse models test gpt-4 --prompt "Hello!"

# Test with streaming
synapse models test gpt-4 --stream
```

### Usage Monitoring

```bash
# Show usage (last 30 days)
synapse usage show

# Show usage for specific period
synapse usage show --days 7
```

### Chat

```bash
# Interactive chat session
synapse chat

# Chat with specific model
synapse chat gpt-3.5-turbo

# Chat with system prompt
synapse chat --system "You are a helpful coding assistant"
```

### Embeddings

```bash
# Create embedding
synapse embed "Your text here"

# Use specific model
synapse embed "Your text" --model text-embedding-3-large
```

### Deployment Helpers

```bash
# Initialize new project
synapse deploy init my-project

# Generate environment file
synapse deploy env --output .env.local
```

## Configuration

Configuration is stored in `~/.synapse/config.json`:

```json
{
  "defaultKey": "my-key",
  "keys": {
    "my-key": {
      "name": "my-key",
      "key": "sk-...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "settings": {
    "defaultModel": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

## Environment Variables

```bash
export SYNAPSE_API_KEY=your-api-key
```

The CLI will use this if no keys are configured.

## License

MIT