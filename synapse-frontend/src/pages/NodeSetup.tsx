import { useState } from 'react';
import { Copy, Check, Terminal, Server, Cpu, HardDrive, Globe, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const requirements = [
  {
    category: 'GPU',
    icon: Cpu,
    items: [
      { name: 'NVIDIA GPU', spec: 'RTX 3090 or better', required: true },
      { name: 'VRAM', spec: '24GB minimum', required: true },
      { name: 'CUDA Compute', spec: 'Capability 8.0+', required: true },
    ],
  },
  {
    category: 'System',
    icon: Server,
    items: [
      { name: 'CPU', spec: '8+ cores recommended', required: false },
      { name: 'RAM', spec: '32GB minimum', required: true },
      { name: 'Storage', spec: '100GB SSD', required: true },
    ],
  },
  {
    category: 'Network',
    icon: Globe,
    items: [
      { name: 'Bandwidth', spec: '100 Mbps upload', required: true },
      { name: 'Latency', spec: '<50ms to nearest region', required: false },
      { name: 'Uptime', spec: '95% minimum', required: true },
    ],
  },
];

const installSteps = [
  {
    title: 'Install Docker',
    command: 'curl -fsSL https://get.docker.com | sh',
    description: 'Docker is required to run the Synapse node container',
  },
  {
    title: 'Install NVIDIA Container Toolkit',
    command: 'distribution=$(. /etc/os-release;echo $ID$VERSION_ID) && curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add - && curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list && sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit && sudo systemctl restart docker',
    description: 'Enables GPU support in Docker containers',
  },
  {
    title: 'Run the Node',
    command: 'docker run -d --gpus all --name synapse-node -e WALLET=0xYOUR_WALLET_ADDRESS -e API_KEY=your_api_key synapse/node:latest',
    description: 'Start your node and connect to the network',
  },
];

export default function NodeSetup() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-400 mb-8">
        <a href="/docs" className="hover:text-emerald-400 transition-colors">Docs</a>
        <ChevronRight className="w-4 h-4" />
        <span className="text-white">Node Setup</span>
      </div>

      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-6">
          <Server className="w-4 h-4" />
          Node Operator Guide
        </div>
        <h1 className="text-4xl font-bold mb-4">Set Up Your Node</h1>
        <p className="text-neutral-400 text-lg">
          Turn your GPU into a revenue stream. Follow this guide to set up a Synapse node 
          and start earning SYN tokens for providing compute power.
        </p>
      </div>

      {/* Requirements */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Hardware Requirements</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {requirements.map((req) => (
            <div key={req.category} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <req.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-semibold">{req.category}</h3>
              </div>
              <ul className="space-y-3">
                {req.items.map((item) => (
                  <li key={item.name} className="flex items-start gap-2">
                    {item.required ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-neutral-500">{item.spec}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Installation Steps */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Installation</h2>
        <div className="space-y-6">
          {installSteps.map((step, index) => (
            <div key={step.title} className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="p-6 border-b border-white/[0.06]">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 font-bold text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{step.title}</h3>
                    <p className="text-sm text-neutral-400">{step.description}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#0a0a0a] p-4">
                <div className="flex items-start justify-between gap-4">
                  <code className="text-sm font-mono text-neutral-300 break-all">{step.command}</code>
                  <button 
                    onClick={() => copyToClipboard(step.command, index)}
                    className="flex-shrink-0 text-neutral-500 hover:text-emerald-400 transition-colors"
                  >
                    {copiedIndex === index ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Configuration</h2>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
          <h3 className="font-semibold mb-4">Environment Variables</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
              <code className="text-sm font-mono text-emerald-400">WALLET</code>
              <span className="text-sm text-neutral-500">Your Ethereum wallet address for rewards</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
              <code className="text-sm font-mono text-emerald-400">API_KEY</code>
              <span className="text-sm text-neutral-500">Optional: for node monitoring API</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
              <code className="text-sm font-mono text-emerald-400">REGION</code>
              <span className="text-sm text-neutral-500">Your node's region (e.g., us-east-1)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
              <code className="text-sm font-mono text-emerald-400">MAX_JOBS</code>
              <span className="text-sm text-neutral-500">Maximum concurrent jobs (default: 4)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Estimate */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Potential Earnings</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">$15-30</p>
            <p className="text-sm text-neutral-500">Per day (RTX 4090)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">$450-900</p>
            <p className="text-sm text-neutral-500">Per month</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">$5,400-10,800</p>
            <p className="text-sm text-neutral-500">Per year</p>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-4">
          * Estimates based on average network usage. Actual earnings vary based on GPU model, 
          availability, and network demand.
        </p>
      </div>
    </div>
  );
}
