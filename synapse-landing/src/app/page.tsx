'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Terminal, 
  Copy, 
  Check, 
  Zap, 
  Activity,
  Globe,
  ArrowRight,
  Key,
  Loader2
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.synapse.sh';
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://web-pri4fr91w-ayrton-8893s-projects.vercel.app/gateway';

interface Stats {
  nodes_online: number;
  jobs_today: number;
  tokens_processed: number;
  avg_cost: number;
  fallback_rate: number;
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<Stats>({
    nodes_online: 0,
    jobs_today: 0,
    tokens_processed: 0,
    avg_cost: 0.0015,
    fallback_rate: 0,
  });
  
  // API Key Modal State
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Fetch stats
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            nodes_online: data.nodes_online || 0,
            jobs_today: data.jobs_today || 0,
            tokens_processed: data.tokens_processed || 0,
            avg_cost: data.avg_cost || 0.0015,
            fallback_rate: data.fallback_rate || 0,
          });
        }
      } catch {
        // ignore
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const isEmail = input.includes('@');
      const body = isEmail ? { email: input } : { wallet: input };
      
      const res = await fetch(`${API_URL}/auth/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to generate key');
      }
      
      const data = await res.json();
      setApiKey(data.api_key);
      
      // Store in localStorage for dashboard access
      if (typeof window !== 'undefined') {
        localStorage.setItem('synapse_api_key', data.api_key);
        localStorage.setItem('synapse_wallet', input);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnterDashboard = () => {
    if (typeof window !== 'undefined') {
      window.location.href = GATEWAY_URL;
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-mono">
      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Hero */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <Terminal size={28} className="text-[#00ff88]" />
          <span className="text-2xl font-semibold tracking-tight">Synapse</span>
        </motion.div>

        {/* Tagline */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[#888] text-sm mb-12 text-center"
        >
          Decentralized AI Inference Network
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => setShowModal(true)}
          className="group flex items-center gap-2 bg-[#00ff88] text-[#0a0a0a] px-8 py-4 rounded-lg font-semibold text-sm hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all"
        >
          <Key size={16} />
          Generate API Key
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Live Metrics */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-24 flex gap-12"
        >
          <div className="text-center">
            <div className="text-2xl font-semibold text-[#00ff88]" style={{ textShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
              {stats.nodes_online}
            </div>
            <div className="text-xs text-[#555] uppercase tracking-wider mt-1">
              <Activity size={10} className="inline mr-1" />
              Nodes
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-semibold text-[#00ff88]" style={{ textShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
              {stats.jobs_today}
            </div>
            <div className="text-xs text-[#555] uppercase tracking-wider mt-1">Jobs Today</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-semibold text-[#00ff88]" style={{ textShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
              {(stats.tokens_processed / 1e6).toFixed(1)}M
            </div>
            <div className="text-xs text-[#555] uppercase tracking-wider mt-1">Tokens</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-semibold text-[#888]">
              ${stats.avg_cost.toFixed(4)}
            </div>
            <div className="text-xs text-[#555] uppercase tracking-wider mt-1">
              <Globe size={10} className="inline mr-1" />
              Avg Cost
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-8 text-xs text-[#444]"
        >
          Run a node. Earn SYN. Power the network.
        </motion.div>
      </div>

      {/* API Key Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          onClick={() => !apiKey && setShowModal(false)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111] border border-[#222] rounded-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <Terminal size={20} className="text-[#00ff88]" />
              <div>
                <h3 className="font-semibold">Synapse Gateway</h3>
                <p className="text-xs text-[#666]">Generate an API key to access the network</p>
              </div>
            </div>

            {!apiKey ? (
              <>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="wallet address or email"
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-sm mb-4 focus:outline-none focus:border-[#00ff88] transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  autoFocus
                />

                {error && (
                  <div className="text-[#ff4444] text-xs mb-4">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading || !input.trim()}
                  className="w-full bg-[#00ff88] text-[#0a0a0a] py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      Generate API Key
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4 mb-4 relative">
                  <code className="text-xs break-all text-[#888]">
                    {apiKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-[#666] hover:text-[#e0e0e0] transition-colors flex items-center gap-1"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-[#666] mb-2">Quick start:</p>
                  <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3 text-xs text-[#555]">
                    {`curl -X POST ${API_URL}/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey.slice(0, 20)}..." \\
  -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"Hello"}]}'`}
                  </div>
                </div>

                <button
                  onClick={handleEnterDashboard}
                  className="w-full bg-[#00ff88] text-[#0a0a0a] py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all"
                >
                  <Zap size={16} />
                  Enter Gateway
                </button>
              </>
            )}

            <div className="mt-4 text-center text-xs text-[#444]">
              Your key is stored locally in your browser
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
