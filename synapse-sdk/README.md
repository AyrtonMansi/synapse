# Synapse SDK & Developer Tools

A comprehensive suite of SDKs, CLI tools, and developer resources for building AI-powered applications with Synapse.

## 📦 Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@synapse-ai/sdk](./javascript-sdk) | JavaScript/TypeScript SDK | 1.0.0 |
| [synapse-ai-sdk](./python-sdk) | Python SDK | 1.0.0 |
| [@synapse-ai/cli](./cli-tool) | Command-line interface | 1.0.0 |
| [Developer Portal](./developer-portal) | Interactive documentation | 1.0.0 |

## 🚀 Quick Start

### JavaScript/TypeScript

```bash
npm install @synapse-ai/sdk
```

```typescript
import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const response = await sdk.chatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Python

```bash
pip install synapse-ai-sdk
```

```python
import asyncio
from synapse_sdk import SynapseSDK, CompletionRequest, Message, MessageRole

async def main():
    sdk = SynapseSDK(api_key='your-api-key')
    
    response = await sdk.chat_completion(
        CompletionRequest(
            model='gpt-4',
            messages=[Message(role=MessageRole.USER, content='Hello!')]
        )
    )
    
    print(response.choices[0].message.content)
    await sdk.close()

asyncio.run(main())
```

### CLI

```bash
npm install -g @synapse-ai/cli

# Authenticate
synapse auth add

# List models
synapse models list

# Test a model
synapse models test gpt-4

# Interactive chat
synapse chat
```

## 📚 Features

### JavaScript/TypeScript SDK
- ✅ Full API wrapper with TypeScript definitions
- ✅ Streaming support with async generators
- ✅ Robust error handling with specific error classes
- ✅ Batch processing with concurrency control
- ✅ Automatic retries with exponential backoff
- ✅ Request cancellation support

### Python SDK
- ✅ Async/await support with aiohttp
- ✅ Batch processing with progress callbacks
- ✅ Model management utilities
- ✅ Jupyter notebook integration
- ✅ Type hints throughout
- ✅ Context manager support

### CLI Tool
- ✅ API key management (add, list, use, remove)
- ✅ Usage monitoring and analytics
- ✅ Model testing with streaming support
- ✅ Interactive chat sessions
- ✅ Deployment helpers and project initialization

### Developer Portal
- ✅ Interactive API explorer (Swagger UI)
- ✅ Multi-language code generator
- ✅ Webhook testing interface
- ✅ Comprehensive SDK documentation

## 📖 Documentation

- [JavaScript SDK Documentation](./javascript-sdk/README.md)
- [Python SDK Documentation](./python-sdk/README.md)
- [CLI Documentation](./cli-tool/README.md)
- [Developer Portal Guide](./developer-portal/README.md)

## 🔧 Development

### Prerequisites

- Node.js 18+ (for JavaScript/TypeScript SDK and CLI)
- Python 3.8+ (for Python SDK)
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/synapse-ai/synapse-sdk.git
cd synapse-sdk

# JavaScript SDK
cd javascript-sdk
npm install
npm run build

# Python SDK
cd ../python-sdk
pip install -e ".[dev]"

# CLI
cd ../cli-tool
npm install
npm run build

# Developer Portal
# Just open developer-portal/index.html in a browser
```

### Running Tests

```bash
# JavaScript SDK
cd javascript-sdk
npm test

# Python SDK
cd python-sdk
pytest
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

All packages are licensed under the MIT License.

## 🆘 Support

- 📧 Email: support@synapse.ai
- 💬 Discord: [Join our community](https://discord.gg/synapse)
- 🐛 Issues: [GitHub Issues](https://github.com/synapse-ai/synapse-sdk/issues)

---

Built with ❤️ by the Synapse team