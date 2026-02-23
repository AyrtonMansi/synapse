import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, Server, Activity, Wallet, Key, BarChart3, 
  CreditCard, Copy, Eye, EyeOff, Trash2, Plus, RefreshCw,
  TrendingUp, Zap, Clock, CheckCircle2, X, ChevronRight
} from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { useSynapse } from '../hooks/useSynapse';
import { formatAddress, formatNumber, copyToClipboard, generateApiKey, formatTimeAgo } from '../utils';
import type { ApiKey, UsageStats, BillingHistory } from '../types';

// Mock data
const mockUsageStats: UsageStats = {
  totalRequests: 15420,
  totalTokens: 8923456,
  computeTime: 43200,
  costEstimate: '245.50',
  requestsByDay: [
    { date: '2024-02-17', count: 2100 },
    { date: '2024-02-18', count: 2350 },
    { date: '2024-02-19', count: 1980 },
    { date: '2024-02-20', count: 2670 },
    { date: '2024-02-21', count: 2890 },
    { date: '2024-02-22', count: 1830 },
    { date: '2024-02-23', count: 1600 },
  ],
  tokensByModel: [
    { model: 'GPT-4', tokens: 4567890 },
    { model: 'Claude-3', tokens: 2345678 },
    { model: 'Llama-2', tokens: 1234567 },
    { model: 'Mistral', tokens: 775321 },
  ],
};

const mockBillingHistory: BillingHistory[] = [
  { id: '1', date: Date.now() - 86400000 * 2, amount: '45.50', status: 'paid', description: 'Usage Feb 20-22' },
  { id: '2', date: Date.now() - 86400000 * 5, amount: '62.30', status: 'paid', description: 'Usage Feb 17-19' },
  { id: '3', date: Date.now() - 86400000 * 8, amount: '38.25', status: 'paid', description: 'Usage Feb 14-16' },
];

const mockApiKeys: ApiKey[] = [
  {
    id: '1',
    name: 'Production API Key',
    key: 'syn_prod_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
    prefix: 'syn_prod_',
    permissions: ['read', 'write', 'inference'],
    createdAt: Date.now() - 86400000 * 30,
    lastUsed: Date.now() - 3600000,
    isActive: true,
  },
  {
    id: '2',
    name: 'Development Testing',
    key: 'syn_dev_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0',
    prefix: 'syn_dev_',
    permissions: ['read', 'inference'],
    createdAt: Date.now() - 86400000 * 7,
    lastUsed: Date.now() - 86400000,
    expiresAt: Date.now() + 86400000 * 23,
    isActive: true,
  },
];

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, permissions: string[]) => void;
}

function CreateKeyModal({ isOpen, onClose, onCreate }: CreateKeyModalProps) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['read', 'inference']);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name, permissions);
      setName('');
      setPermissions(['read', 'inference']);
    }
  };

  const togglePermission = (perm: string) => {
    setPermissions(prev => 
      prev.includes(perm) 
        ? prev.filter(p => p !== perm)
        : [...prev, perm]
    );
  };

  return (
    <div className="fixed inset-0 bg-terminal-bg/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        className="terminal-window max-w-md w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {/* Header */}
        <div className="terminal-window-header">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-terminal-accent" />
            <span className="font-mono text-sm">create_key.sh</span>
          </div>
          <button onClick={onClose} className="text-terminal-dim hover:text-terminal-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          <div className="mb-4 font-mono text-xs text-terminal-accent">
            <span className="text-terminal-dim">$</span> synapse apikey create
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-terminal-dim mb-2">
                --name
              </label>
              <input
                type="text"
                placeholder="e.g., Production Server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="terminal-input w-full"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-terminal-dim mb-2">
                --permissions
              </label>
              <div className="space-y-2">
                {['read', 'write', 'inference', 'admin'].map((perm) => (
                  <label key={perm} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={permissions.includes(perm)}
                      onChange={() => togglePermission(perm)}
                      className="w-4 h-4 rounded border-terminal-border bg-terminal-bg text-terminal-accent focus:ring-terminal-accent/20"
                    />
                    <span className="text-sm capitalize group-hover:text-terminal-accent transition-colors">{perm}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                type="button"
                onClick={onClose} 
                className="flex-1 terminal-btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 terminal-btn-primary"
              >
                Create Key
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { synBalance, stakedBalance, pendingRewards, claim, isClaiming } = useSynapse();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(mockApiKeys);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'apikeys' | 'billing'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: ethBalance } = useBalance({ address });

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyKey = async (key: string, id: string) => {
    await copyToClipboard(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateKey = (name: string, permissions: string[]) => {
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: name,
      key: generateApiKey(),
      prefix: 'syn_new_',
      permissions: permissions,
      createdAt: Date.now(),
      isActive: true,
    };
    setApiKeys([newKey, ...apiKeys]);
    setShowKeyModal(false);
  };

  const handleDeleteKey = (id: string) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      setApiKeys(apiKeys.filter(k => k.id !== id));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <motion.div 
          className="text-center space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 bg-terminal-accent/10 border border-terminal-accent/30 rounded-2xl mx-auto flex items-center justify-center">
            <Terminal className="w-10 h-10 text-terminal-accent" />
          </div>
          <h1 className="text-3xl font-bold">Connect Your Wallet</h1>
          <p className="text-terminal-dim max-w-md">
            Connect your wallet to access the Synapse Dashboard, manage API keys, and view usage statistics.
          </p>
          <WalletConnect />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-terminal-accent">$</span> Dashboard
          </h1>
          <p className="text-terminal-dim mt-1 font-mono text-sm">
            Welcome back, <span className="text-terminal-accent">{formatAddress(address!)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className="terminal-btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <WalletConnect />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { 
            label: 'SYN Balance', 
            value: `${formatNumber(parseFloat(synBalance || '0'), 2)} SYN`,
            sub: `~$${formatNumber(parseFloat(synBalance || '0') * 5, 2)}`,
            icon: Wallet,
            color: 'terminal-accent'
          },
          { 
            label: 'Staked', 
            value: `${formatNumber(parseFloat(stakedBalance || '0'), 2)} SYN`,
            sub: `${formatNumber(parseFloat(pendingRewards || '0'), 4)} pending`,
            icon: TrendingUp,
            color: 'terminal-accent'
          },
          { 
            label: 'Total Requests', 
            value: formatNumber(mockUsageStats.totalRequests),
            sub: '+12.5% this week',
            icon: Activity,
            color: 'terminal-accent'
          },
          { 
            label: 'Total Cost', 
            value: `${mockUsageStats.costEstimate} SYN`,
            sub: `~$${(parseFloat(mockUsageStats.costEstimate) * 5).toFixed(2)} USD`,
            icon: Zap,
            color: 'terminal-accent'
          },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            className="terminal-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-terminal-dim uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                <p className="text-xs text-terminal-accent mt-1">{stat.sub}</p>
              </div>
              <div className={`w-12 h-12 bg-${stat.color}/10 rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-terminal-surface/50 border border-terminal-border rounded-xl mb-6 w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'apikeys', label: 'API Keys', icon: Key },
          { id: 'billing', label: 'Billing', icon: CreditCard },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-terminal-accent text-terminal-bg' 
                : 'text-terminal-dim hover:text-terminal-text hover:bg-terminal-elevated'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Usage Chart */}
              <div className="lg:col-span-2 terminal-card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="w-5 h-5 text-terminal-accent" />
                  <h2 className="text-lg font-semibold">Usage Statistics</h2>
                </div>
                <div className="flex items-end gap-2 h-40">
                  {mockUsageStats.requestsByDay.map((day, i) => {
                    const max = Math.max(...mockUsageStats.requestsByDay.map(d => d.count));
                    const height = (day.count / max) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <motion.div 
                          className="w-full bg-terminal-accent/30 group-hover:bg-terminal-accent/50 rounded-t transition-all cursor-pointer"
                          style={{ height: `${height}%` }}
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: i * 0.05 }}
                        />
                        <span className="text-xs text-terminal-muted font-mono">
                          {new Date(day.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Wallet Card */}
              <div className="terminal-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-terminal-accent" />
                  <h2 className="text-lg font-semibold">Wallet</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-terminal-dim font-mono">ETH</span>
                    <span className="font-mono">{parseFloat(formatEther(ethBalance?.value || 0n)).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-terminal-dim font-mono">SYN</span>
                    <span className="font-mono text-terminal-accent">{formatNumber(parseFloat(synBalance || '0'), 2)}</span>
                  </div>
                  <div className="pt-3 border-t border-terminal-border">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-terminal-dim font-mono">Pending Rewards</span>
                      <span className="font-mono text-terminal-accent">{formatNumber(parseFloat(pendingRewards || '0'), 4)} SYN</span>
                    </div>
                    <button 
                      onClick={() => claim()}
                      disabled={isClaiming || parseFloat(pendingRewards || '0') === 0}
                      className="w-full terminal-btn-primary disabled:opacity-50"
                    >
                      {isClaiming ? 'Claiming...' : 'Claim Rewards'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'apikeys' && (
          <motion.div 
            key="apikeys" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <div className="terminal-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-terminal-accent" />
                    <h2 className="text-xl font-semibold">API Keys</h2>
                  </div>
                  <p className="text-sm text-terminal-dim mt-1 font-mono">$ synapse apikey list</p>
                </div>
                <button 
                  onClick={() => setShowKeyModal(true)}
                  className="terminal-btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Key
                </button>
              </div>

              <div className="space-y-4">
                {apiKeys.map((key, index) => (
                  <motion.div 
                    key={key.id} 
                    className="p-4 bg-terminal-bg border border-terminal-border rounded-lg hover:border-terminal-accent/30 transition-all"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{key.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded font-mono ${key.isActive ? 'bg-terminal-accent/10 text-terminal-accent' : 'bg-terminal-muted/10 text-terminal-dim'}`}>
                            {key.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-terminal-muted mt-1 font-mono">Created {formatTimeAgo(key.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleKeyVisibility(key.id)} 
                          className="p-2 text-terminal-dim hover:text-terminal-text transition-colors"
                        >
                          {visibleKeys.has(key.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleCopyKey(key.key, key.id)} 
                          className="p-2 text-terminal-dim hover:text-terminal-text transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteKey(key.id)} 
                          className="p-2 text-terminal-dim hover:text-terminal-red transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <code className="flex-1 text-xs bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 font-mono text-terminal-dim truncate">
                        {visibleKeys.has(key.id) ? key.key : `${key.prefix}${'*'.repeat(32)}`}
                      </code>
                      {copiedId === key.id && <span className="text-xs text-terminal-accent font-mono">Copied!</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {key.permissions.map(perm => (
                        <span key={perm} className="text-xs px-2 py-1 bg-terminal-accent/10 text-terminal-accent rounded font-mono">{perm}</span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'billing' && (
          <motion.div 
            key="billing" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          >
            <div className="terminal-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <CreditCard className="w-5 h-5 text-terminal-accent" />
                <h2 className="text-xl font-semibold">Billing History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-terminal-border">
                      <th className="text-left py-3 text-xs font-mono text-terminal-dim uppercase">Description</th>
                      <th className="text-left py-3 text-xs font-mono text-terminal-dim uppercase">Date</th>
                      <th className="text-right py-3 text-xs font-mono text-terminal-dim uppercase">Amount</th>
                      <th className="text-right py-3 text-xs font-mono text-terminal-dim uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border/50">
                    {mockBillingHistory.map((bill, i) => (
                      <motion.tr 
                        key={bill.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <td className="py-4 text-sm">{bill.description}</td>
                        <td className="py-4 text-sm text-terminal-dim font-mono">{new Date(bill.date).toLocaleDateString()}</td>
                        <td className="py-4 text-sm text-right font-mono">{bill.amount} SYN</td>
                        <td className="py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-terminal-accent/10 text-terminal-accent font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            {bill.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateKeyModal 
        isOpen={showKeyModal} 
        onClose={() => setShowKeyModal(false)} 
        onCreate={handleCreateKey} 
      />
    </div>
  );
}
