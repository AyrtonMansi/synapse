import { Copy, Check, Terminal } from 'lucide-react';
import { useState } from 'react';

const installCommands: Record<string, string> = {
  linux: 'curl -sSL https://synapse.sh/install.sh | bash',
  macos: 'curl -sSL https://synapse.sh/install.sh | bash',
  docker: 'docker run -d --gpus all -e WALLET=$WALLET synapse/node:latest',
};

export function RunNodePage() {
  const [os, setOs] = useState<'linux' | 'macos' | 'docker'>('linux');
  const [copied, setCopied] = useState(false);
  const [wallet, setWallet] = useState('');

  const copyCommand = () => {
    navigator.clipboard.writeText(installCommands[os]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold text-charcoal-100 mb-2">Run a Node</h1>
      <p className="text-charcoal-400 mb-8">
        Contribute GPU compute to the network and earn rewards.
      </p>

      {/* Wallet Input */}
      <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 mb-6">
        <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider mb-4">
          Your Wallet Address
        </h2>
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="0x... (for receiving rewards)"
          className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg px-4 py-3 text-charcoal-200 placeholder-charcoal-600 focus:outline-none focus:border-synapse-600"
        />
      </div>

      {/* OS Selector */}
      <div className="flex gap-2 mb-6">
        {(['linux', 'macos', 'docker'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setOs(option)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              os === option 
                ? 'bg-synapse-600 text-white' 
                : 'bg-charcoal-900 text-charcoal-400 hover:text-charcoal-200 border border-charcoal-800'
            }`}
          >
            {option === 'linux' && 'Linux'}
            {option === 'macos' && 'macOS'}
            {option === 'docker' && 'Docker'}
          </button>
        ))}
      </div>

      {/* Command */}
      <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal-800 bg-charcoal-900">
          <div className="flex items-center gap-2 text-charcoal-400">
            <Terminal size={16} />
            <span className="text-sm">Install Command</span>
          </div>
          <button
            onClick={copyCommand}
            className="flex items-center gap-1.5 text-sm text-charcoal-400 hover:text-charcoal-200 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="p-4">
          <code className="text-sm text-charcoal-300 font-mono break-all">
            {installCommands[os]}
          </code>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 space-y-4">
        <h3 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider">
          Quick Start
        </h3>
        <ol className="space-y-3 text-charcoal-300">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-charcoal-800 flex items-center justify-center text-xs text-charcoal-400 flex-shrink-0">1</span>
            <span>Ensure you have an NVIDIA GPU with CUDA support</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-charcoal-800 flex items-center justify-center text-xs text-charcoal-400 flex-shrink-0">2</span>
            <span>Enter your wallet address above</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-charcoal-800 flex items-center justify-center text-xs text-charcoal-400 flex-shrink-0">3</span>
            <span>Copy and run the install command in your terminal</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-charcoal-800 flex items-center justify-center text-xs text-charcoal-400 flex-shrink-0">4</span>
            <span>The node will automatically connect to the network</span>
          </li>
        </ol>
      </div>

      {/* Requirements */}
      <div className="mt-8 p-4 bg-charcoal-900/50 rounded-lg border border-charcoal-800">
        <h4 className="text-sm font-medium text-charcoal-300 mb-2">System Requirements</h4>
        <ul className="text-sm text-charcoal-500 space-y-1">
          <li>• NVIDIA GPU with 8GB+ VRAM</li>
          <li>• CUDA 11.8 or higher</li>
          <li>• 16GB+ RAM</li>
          <li>• Stable internet connection</li>
        </ul>
      </div>
    </div>
  );
}
