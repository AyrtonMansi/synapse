import { useState } from 'react';
import { Copy, Check, Terminal, Code, FileText, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const endpoints = [
  {
    method: 'POST',
    path: '/v1/chat/completions',
    name: 'Chat Completions',
    description: 'Generate text responses from AI models. Compatible with OpenAI\'s chat completions API.',
    requestExample: `curl https://api.synapse.network/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer syn_your_api_key" \\
  -d '{
    "model": "llama-3-70b",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 150
  }'`,
    responseExample: `{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "llama-3-70b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}`,
    parameters: [
      { name: 'model', type: 'string', required: true, description: 'ID of the model to use (e.g., llama-3-70b, gpt-4, claude-3-opus)' },
      { name: 'messages', type: 'array', required: true, description: 'Array of message objects with role and content' },
      { name: 'temperature', type: 'number', required: false, description: 'Sampling temperature (0-2). Default: 1' },
      { name: 'max_tokens', type: 'integer', required: false, description: 'Maximum tokens to generate' },
      { name: 'stream', type: 'boolean', required: false, description: 'Stream responses as Server-Sent Events' },
    ],
  },
  {
    method: 'POST',
    path: '/v1/embeddings',
    name: 'Create Embeddings',
    description: 'Generate vector embeddings for text input.',
    requestExample: `curl https://api.synapse.network/v1/embeddings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer syn_your_api_key" \\
  -d '{
    "model": "text-embedding-3-large",
    "input": "The food was delicious and the waiter..."
  }'`,
    responseExample: `{
  "object": "list",
  "data": [{
    "object": "embedding",
    "embedding": [0.0023064255, -0.009327292, ...],
    "index": 0
  }],
  "model": "text-embedding-3-large",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}`,
    parameters: [
      { name: 'model', type: 'string', required: true, description: 'ID of the embedding model' },
      { name: 'input', type: 'string/array', required: true, description: 'Text to embed. Can be a string or array of strings.' },
      { name: 'dimensions', type: 'integer', required: false, description: 'Number of dimensions for the output' },
    ],
  },
  {
    method: 'GET',
    path: '/v1/models',
    name: 'List Models',
    description: 'List all available models on the Synapse network.',
    requestExample: `curl https://api.synapse.network/v1/models \\
  -H "Authorization: Bearer syn_your_api_key"`,
    responseExample: `{
  "object": "list",
  "data": [
    {
      "id": "llama-3-70b",
      "object": "model",
      "created": 1677610602,
      "owned_by": "synapse"
    },
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1687882411,
      "owned_by": "synapse"
    }
  ]
}`,
    parameters: [],
  },
];

const models = [
  { id: 'llama-3-70b', provider: 'Meta', context: '8192', pricing: '$0.0015/1K tokens', capabilities: ['chat', 'code', 'analysis'] },
  { id: 'gpt-4', provider: 'OpenAI', context: '8192', pricing: '$0.015/1K tokens', capabilities: ['chat', 'code', 'vision'] },
  { id: 'claude-3-opus', provider: 'Anthropic', context: '200000', pricing: '$0.015/1K tokens', capabilities: ['chat', 'analysis', 'long-context'] },
  { id: 'mistral-large', provider: 'Mistral', context: '32000', pricing: '$0.003/1K tokens', capabilities: ['chat', 'code', 'analysis'] },
  { id: 'text-embedding-3-large', provider: 'OpenAI', context: '8191', pricing: '$0.0001/1K tokens', capabilities: ['embeddings'] },
];

const errorCodes = [
  { code: '400', name: 'Bad Request', description: 'Invalid request body or parameters' },
  { code: '401', name: 'Unauthorized', description: 'Invalid or missing API key' },
  { code: '429', name: 'Rate Limited', description: 'Too many requests. Upgrade your plan or wait.' },
  { code: '500', name: 'Internal Server Error', description: 'Server error. Please try again later.' },
  { code: '503', name: 'Service Unavailable', description: 'The service is temporarily unavailable' },
];

function EndpointCard({ endpoint }: { endpoint: typeof endpoints[0] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-blue-400 bg-blue-500/10';
      case 'POST': return 'text-emerald-400 bg-emerald-500/10';
      case 'PUT': return 'text-amber-400 bg-amber-500/10';
      case 'DELETE': return 'text-red-400 bg-red-500/10';
      default: return 'text-neutral-400 bg-neutral-500/10';
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 rounded text-xs font-mono font-medium ${getMethodColor(endpoint.method)}`}>
            {endpoint.method}
          </span>
          <div className="text-left">
            <p className="font-mono text-sm">{endpoint.path}</p>
            <p className="text-sm text-neutral-500">{endpoint.name}</p>
          </div>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5 text-neutral-500" /> : <ChevronRight className="w-5 h-5 text-neutral-500" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 border-t border-white/[0.06]">
              <p className="text-neutral-400 mb-6">{endpoint.description}</p>

              {endpoint.parameters.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-3">Parameters</h4>
                  <div className="space-y-2">
                    {endpoint.parameters.map((param) => (
                      <div key={param.name} className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-emerald-400">{param.name}</code>
                            <span className="text-xs text-neutral-500">{param.type}</span>
                            {param.required && <span className="text-xs text-red-400">required</span>}
                          </div>
                          <p className="text-sm text-neutral-500 mt-1">{param.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Request Example</h4>
                    <button 
                      onClick={() => copyToClipboard(endpoint.requestExample)}
                      className="text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm font-mono text-neutral-300">{endpoint.requestExample}</code>
                  </pre>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Response Example</h4>
                  <pre className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm font-mono text-neutral-300">{endpoint.responseExample}</code>
                  </pre>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ApiReference() {
  const [activeSection, setActiveSection] = useState('endpoints');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
          <a href="/docs" className="hover:text-emerald-400 transition-colors">Docs</a>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">API Reference</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">API Reference</h1>
        <p className="text-neutral-400 max-w-2xl">
          The Synapse API is organized around REST. Our API is compatible with OpenAI's API, 
          making it easy to migrate your existing applications.
        </p>
      </div>

      {/* Base URL */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-8">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-sm text-neutral-400">Base URL</p>
            <code className="text-emerald-400 font-mono">https://api.synapse.network/v1</code>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl mb-8 w-fit">
        {[
          { id: 'endpoints', label: 'Endpoints' },
          { id: 'models', label: 'Models' },
          { id: 'errors', label: 'Errors' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === tab.id ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSection === 'endpoints' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Code className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Endpoints</h2>
          </div>
          {endpoints.map((endpoint) => (
            <EndpointCard key={endpoint.path} endpoint={endpoint} />
          ))}
        </div>
      )}

      {activeSection === 'models' && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Available Models</h2>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/[0.03]">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Model</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Provider</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Context</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Pricing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {models.map((model) => (
                  <tr key={model.id} className="hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <code className="text-emerald-400 font-mono text-sm">{model.id}</code>
                      <div className="flex gap-2 mt-1">
                        {model.capabilities.map(cap => (
                          <span key={cap} className="text-xs px-2 py-0.5 bg-white/[0.05] rounded text-neutral-500">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{model.provider}</td>
                    <td className="px-6 py-4 text-sm">{parseInt(model.context).toLocaleString()} tokens</td>
                    <td className="px-6 py-4 text-sm">{model.pricing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'errors' && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Error Codes</h2>
          </div>
          <div className="grid gap-4">
            {errorCodes.map((error) => (
              <div key={error.code} className="flex items-start gap-4 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-sm font-mono">{error.code}</span>
                <div>
                  <p className="font-medium">{error.name}</p>
                  <p className="text-sm text-neutral-500">{error.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
