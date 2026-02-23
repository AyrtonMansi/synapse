import { useState } from 'react';
import { Copy, Check, Terminal, ArrowRight, ExternalLink, ChevronRight, Code, Key } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Create an Account',
    description: 'Connect your wallet to the Synapse Dashboard to get started.',
    action: 'Go to Dashboard',
    href: '/dashboard',
  },
  {
    number: '02',
    title: 'Generate an API Key',
    description: 'Create an API key from the dashboard. Your first 1 million tokens are free.',
    action: 'Generate Key',
    href: '/dashboard',
  },
  {
    number: '03',
    title: 'Make Your First Request',
    description: 'Use our OpenAI-compatible API to start making inference requests.',
    action: 'View API Docs',
    href: '/docs/api',
  },
];

const codeExamples = {
  curl: `curl https://api.synapse.network/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer syn_your_api_key" \\
  -d '{
    "model": "llama-3-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  python: `import openai

# Initialize with Synapse
client = openai.OpenAI(
    base_url="https://api.synapse.network/v1",
    api_key="syn_your_api_key"
)

# Make a request
response = client.chat.completions.create(
    model="llama-3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,
  javascript: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.synapse.network/v1',
  apiKey: 'syn_your_api_key',
});

async function main() {
  const completion = await client.chat.completions.create({
    model: 'llama-3-70b',
    messages: [{ role: 'user', content: 'Hello!' }],
  });

  console.log(completion.choices[0].message.content);
}

main();`,
};

export default function QuickStart() {
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript'>('curl');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-400 mb-8">
        <a href="/docs" className="hover:text-emerald-400 transition-colors">Docs</a>
        <ChevronRight className="w-4 h-4" />
        <span className="text-white">Quick Start</span>
      </div>

      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-6">
          <Terminal className="w-4 h-4" />
          Quick Start
        </div>
        <h1 className="text-4xl font-bold mb-4">Get Started in 5 Minutes</h1>
        <p className="text-neutral-400 text-lg">
          Learn how to make your first API call to the Synapse network. Our API is compatible with OpenAI, 
          so you can use your existing code with minimal changes.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-8 mb-12">
        {steps.map((step, index) => (
          <div key={step.number} className="flex gap-6">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                <span className="text-emerald-400 font-bold">{step.number}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="w-px h-full bg-white/[0.08] mt-4" />
              )}
            </div>
            <div className="flex-1 pb-8">
              <h2 className="text-xl font-semibold mb-2">{step.title}</h2>
              <p className="text-neutral-400 mb-4">{step.description}</p>
              <Link 
                to={step.href}
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {step.action}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Code Example */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Make Your First Request</h2>
        
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl mb-4 w-fit">
          {[
            { id: 'curl', label: 'cURL' },
            { id: 'python', label: 'Python' },
            { id: 'javascript', label: 'JavaScript' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code Block */}
        <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <button 
              onClick={() => copyToClipboard(codeExamples[activeTab])}
              className="text-xs text-neutral-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm font-mono">
              <code className="text-neutral-300">{codeExamples[activeTab]}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Expected Response */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Expected Response</h2>
        <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-4 overflow-x-auto">
          <pre className="text-sm font-mono">
            <code className="text-neutral-300">{`{
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
    "prompt_tokens": 4,
    "completion_tokens": 10,
    "total_tokens": 14
  }
}`}</code>
          </pre>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
        <div className="space-y-3">
          <Link to="/docs/api" className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors group">
            <Code className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="font-medium group-hover:text-emerald-400 transition-colors">Explore the API Reference</p>
              <p className="text-sm text-neutral-500">Learn about all available endpoints and parameters</p>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-emerald-400 transition-colors" />
          </Link>
          <Link to="/docs/sdk" className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors group">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="font-medium group-hover:text-emerald-400 transition-colors">Install the SDK</p>
              <p className="text-sm text-neutral-500">Use our official SDKs for easier integration</p>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-emerald-400 transition-colors" />
          </Link>
          <a 
            href="https://discord.gg/synapse" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors group"
          >
            <ExternalLink className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="font-medium group-hover:text-emerald-400 transition-colors">Join our Community</p>
              <p className="text-sm text-neutral-500">Get help from the team and other developers</p>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-emerald-400 transition-colors" />
          </a>
        </div>
      </div>
    </div>
  );
}
