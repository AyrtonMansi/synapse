import { useState } from 'react';
import { Copy, Check, Terminal, ChevronRight, Code, Package, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const sdks = [
  {
    id: 'javascript',
    name: 'JavaScript / TypeScript',
    icon: 'JS',
    color: 'text-yellow-400',
    install: 'npm install @synapse/sdk',
    description: 'Official JavaScript SDK for Node.js and browsers',
    features: ['TypeScript support', 'Browser & Node.js', 'Streaming support', 'Error handling'],
  },
  {
    id: 'python',
    name: 'Python',
    icon: 'PY',
    color: 'text-blue-400',
    install: 'pip install synapse-sdk',
    description: 'Official Python SDK for AI applications',
    features: ['Async support', 'Pydantic models', 'Streaming support', 'Type hints'],
  },
  {
    id: 'go',
    name: 'Go',
    icon: 'GO',
    color: 'text-cyan-400',
    install: 'go get github.com/synapse/sdk-go',
    description: 'Official Go SDK for high-performance applications',
    features: ['Context support', 'Retries & backoff', 'Streaming support', 'Mocking'],
  },
];

const jsExample = `import { SynapseClient } from '@synapse/sdk';

const client = new SynapseClient({
  apiKey: process.env.SYNAPSE_API_KEY,
});

// Simple completion
const response = await client.chat.completions.create({
  model: 'llama-3-70b',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: 'llama-3-70b',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`;

const pythonExample = `import os
from synapse import SynapseClient

client = SynapseClient(
    api_key=os.environ["SYNAPSE_API_KEY"]
)

# Simple completion
response = client.chat.completions.create(
    model="llama-3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="llama-3-70b",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`;

const goExample = `package main

import (
    "context"
    "fmt"
    "os"
    
    "github.com/synapse/sdk-go"
)

func main() {
    client := synapse.NewClient(os.Getenv("SYNAPSE_API_KEY"))
    
    // Simple completion
    resp, err := client.Chat.Completions.Create(context.Background(), synapse.ChatCompletionRequest{
        Model: "llama-3-70b",
        Messages: []synapse.Message{
            {Role: "user", Content: "Hello!"},
        },
    })
    if err != nil {
        panic(err)
    }
    
    fmt.Println(resp.Choices[0].Message.Content)
}`;

const codeExamples: Record<string, string> = {
  javascript: jsExample,
  python: pythonExample,
  go: goExample,
};

export default function SdkGuide() {
  const [activeSdk, setActiveSdk] = useState('javascript');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const activeSdkData = sdks.find(s => s.id === activeSdk)!;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-400 mb-8">
        <a href="/docs" className="hover:text-emerald-400 transition-colors">Docs</a>
        <ChevronRight className="w-4 h-4" />
        <span className="text-white">SDK</span>
      </div>

      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-6">
          <Package className="w-4 h-4" />
          SDK Documentation
        </div>
        <h1 className="text-4xl font-bold mb-4">Synapse SDKs</h1>
        <p className="text-neutral-400 text-lg">
          Official SDKs for interacting with the Synapse API. Choose your preferred language 
          and start building in minutes.
        </p>
      </div>

      {/* SDK Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {sdks.map((sdk) => (
          <button
            key={sdk.id}
            onClick={() => setActiveSdk(sdk.id)}
            className={`p-4 text-left border rounded-xl transition-all ${
              activeSdk === sdk.id 
                ? 'border-emerald-500/50 bg-emerald-500/5' 
                : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12]'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-xs font-bold ${sdk.color}`}>
                {sdk.icon}
              </span>
              <h3 className="font-semibold">{sdk.name}</h3>
            </div>
            <p className="text-sm text-neutral-500">{sdk.description}</p>
          </button>
        ))}
      </div>

      {/* Installation */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          Installation
        </h2>
        <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.08]">
            <span className="text-xs text-neutral-500">Terminal</span>
            <button 
              onClick={() => copyToClipboard(activeSdkData.install, 'install')}
              className="text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              {copied === 'install' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'install' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="p-4">
            <code className="text-sm font-mono text-neutral-300">{activeSdkData.install}</code>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Features</h2>
        <div className="grid grid-cols-2 gap-3">
          {activeSdkData.features.map((feature) => (
            <div key={feature} className="flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Example */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-emerald-400" />
          Usage Example
        </h2>
        <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <button 
              onClick={() => copyToClipboard(codeExamples[activeSdk], 'code')}
              className="text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              {copied === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'code' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm font-mono">
              <code className="text-neutral-300">{codeExamples[activeSdk]}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* GitHub Links */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Open Source</h2>
        <p className="text-neutral-400 mb-4">
          All SDKs are open source and available on GitHub. Contributions are welcome!
        </p>
        <div className="flex flex-wrap gap-3">
          {sdks.map((sdk) => (
            <a
              key={sdk.id}
              href={`https://github.com/synapse/sdk-${sdk.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg hover:bg-white/[0.08] transition-colors"
            >
              <span className={`text-xs font-bold ${sdk.color}`}>{sdk.icon}</span>
              <span className="text-sm">{sdk.name}</span>
              <ExternalLink className="w-3 h-3 text-neutral-500" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
