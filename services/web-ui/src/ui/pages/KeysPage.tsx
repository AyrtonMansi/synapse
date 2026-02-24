import { Key, Copy, Check, RefreshCw, AlertCircle, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '../../lib/toast';

export function KeysPage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [wallet, setWallet] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('synapse_api_key');
    if (stored) setApiKey(stored);
    setLoading(false);
  }, []);

  const generateKey = async () => {
    setIsGenerating(true);
    try {
      // Simulate API call
      await new Promise(r => setTimeout(r, 1000));
      const newKey = `synapse_${Array.from({length: 32}, () => Math.random().toString(36)[2]).join('')}`;
      setApiKey(newKey);
      localStorage.setItem('synapse_api_key', newKey);
      showToast('API key generated successfully', 'success');
    } catch (err) {
      showToast('Failed to generate key', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    showToast('API key copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const connectWallet = () => {
    if (!wallet) {
      showToast('Please enter a wallet address', 'error');
      return;
    }
    localStorage.setItem('synapse_wallet', wallet);
    showToast('Wallet connected (local mode)', 'success');
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-charcoal-800 rounded w-1/4 mb-2" />
          <div className="h-4 bg-charcoal-800 rounded w-1/2 mb-8" />
          <div className="h-32 bg-charcoal-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold text-charcoal-100 mb-2">API Keys</h1>
      <p className="text-charcoal-400 mb-8">Manage your API keys for accessing the Synapse network.</p>

      {/* Current Key */}
      <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider">
            Current Key
          </h2>
          <span className="px-2 py-0.5 text-xs bg-amber-950/50 text-amber-400 rounded border border-amber-900/50">
            Local Mode
          </span>
        </div>
        
        {apiKey ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-charcoal-950 rounded-lg px-4 py-3 text-charcoal-200 font-mono text-sm">
                {apiKey.slice(0, 20)}...{apiKey.slice(-8)}
              </code>
              <button
                onClick={copyKey}
                className="p-3 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 rounded-lg transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={18} className="text-synapse-500" /> : <Copy size={18} />}
              </button>
              <button
                onClick={generateKey}
                disabled={isGenerating}
                className="p-3 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 rounded-lg transition-colors"
                title="Generate new key"
              >
                <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
              </button>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-charcoal-950 rounded-lg border border-charcoal-800">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-charcoal-400">
                This key is stored locally in your browser. In production, keys are managed server-side 
                with proper access controls.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-charcoal-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key size={24} className="text-charcoal-500" />
            </div>
            <p className="text-charcoal-400 mb-4">No API key configured</p>
            <button
              onClick={generateKey}
              disabled={isGenerating}
              className="px-6 py-3 bg-synapse-600 hover:bg-synapse-500 disabled:bg-charcoal-800 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto"
            >
              <Key size={18} />
              {isGenerating ? 'Generating...' : 'Generate API Key'}
            </button>
          </div>
        )}
      </div>

      {/* Wallet Connection */}
      <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-charcoal-400" />
          <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider">
            Wallet Connection
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Enter wallet address (0x...)"
            className="flex-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-4 py-3 text-charcoal-200 placeholder-charcoal-600 focus:outline-none focus:border-synapse-600"
          />
          <button 
            onClick={connectWallet}
            className="px-4 py-3 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 rounded-lg transition-colors"
          >
            Connect
          </button>
        </div>
        
        <p className="mt-3 text-sm text-charcoal-500">
          Connect your wallet to earn rewards for providing compute on the network.
        </p>
      </div>
    </div>
  );
}
