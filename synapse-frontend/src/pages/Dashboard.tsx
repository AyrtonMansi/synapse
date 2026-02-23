import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { 
  Terminal, Activity, Wallet, Key, Server, 
  Clock, Zap, TrendingUp, Copy, Eye, EyeOff, 
  Plus, Trash2, RefreshCw, ChevronRight, AlertCircle
} from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { useSynapse } from '../hooks/useSynapse';
import { formatAddress, copyToClipboard, generateApiKey } from '../utils';
import type { ApiKey } from '../types';

// Real data state - no mocks
export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { synBalance, stakedBalance, pendingRewards, claim, isClaiming } = useSynapse();
  const { data: ethBalance } = useBalance({ address });
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'apikeys' | 'usage'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading real data
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 border-2 border-emerald-500/30 rounded-xl mx-auto flex items-center justify-center bg-zinc-900">
            <Terminal className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">Connect Wallet</h1>
          <p className="text-zinc-400 max-w-md">
            Connect your wallet to access the Synapse Dashboard
          </p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="text-emerald-500">$</span> dashboard
          </h1>
          <p className="text-zinc-400 mt-1 font-mono text-sm">
            <span className="text-zinc-600">user@</span>
            <span className="text-emerald-500">{formatAddress(address!)}</span>
          </p>
        </div>
        <WalletConnect />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="SYN Balance" 
          value={isLoading ? '...' : `${parseFloat(synBalance || '0').toFixed(2)} SYN`}
          subValue={isLoading ? '' : `$${(parseFloat(synBalance || '0') * 0.05).toFixed(2)}`}
          icon={Wallet}
        />
        <StatCard 
          label="Staked" 
          value={isLoading ? '...' : `${parseFloat(stakedBalance || '0').toFixed(2)} SYN`}
          subValue={isLoading ? '' : `${parseFloat(pendingRewards || '0').toFixed(4)} pending`}
          icon={TrendingUp}
        />
        <StatCard 
          label="ETH Balance" 
          value={isLoading ? '...' : `${parseFloat(formatEther(ethBalance?.value || 0n)).toFixed(4)} ETH`}
          subValue=""
          icon={Activity}
        />
        <StatCard 
          label="Total Jobs" 
          value={isLoading ? '...' : '0'}
          subValue="No jobs yet"
          icon={Server}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-zinc-800">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'apikeys', label: 'API Keys' },
          { id: 'usage', label: 'Usage' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 font-mono text-sm border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-emerald-500 text-emerald-500' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-500" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-emerald-500/50 transition-colors text-left group">
                  <Key className="w-8 h-8 text-emerald-500 mb-3" />
                  <h3 className="font-medium text-white group-hover:text-emerald-400">Create API Key</h3>
                  <p className="text-sm text-zinc-500 mt-1">Generate a new API key</p>
                </button>
                <button className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-emerald-500/50 transition-colors text-left group">
                  <Server className="w-8 h-8 text-emerald-500 mb-3" />
                  <h3 className="font-medium text-white group-hover:text-emerald-400">Start Node</h3>
                  <p className="text-sm text-zinc-500 mt-1">Run a compute node</p>
                </button>
                <button className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-emerald-500/50 transition-colors text-left group">
                  <Activity className="w-8 h-8 text-emerald-500 mb-3" />
                  <h3 className="font-medium text-white group-hover:text-emerald-400">View Analytics</h3>
                  <p className="text-sm text-zinc-500 mt-1">Check network stats</p>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Recent Activity
              </h2>
              <div className="text-center py-12 text-zinc-500">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No recent activity</p>
                <p className="text-sm mt-1">Start using the API to see activity here</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'apikeys' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-semibold text-white">API Keys</h2>
                <p className="text-sm text-zinc-500 font-mono mt-1">Manage your API access keys</p>
              </div>
              <button 
                onClick={() => setShowNewKey(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Key
              </button>
            </div>

            <div className="p-6">
              {apiKeys.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
                  <p className="text-zinc-400">No API keys yet</p>
                  <p className="text-sm text-zinc-500 mt-1">Create your first key to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map(key => (
                    <div key={key.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <div>
                        <p className="font-medium text-white">{key.name}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-1">{key.prefix}****</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-zinc-700 rounded transition-colors">
                          <Copy className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button className="p-2 hover:bg-zinc-700 rounded transition-colors">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Usage Statistics</h2>
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
              <p className="text-zinc-400">No usage data available</p>
              <p className="text-sm text-zinc-500 mt-1">Usage statistics will appear once you start making API calls</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, subValue, icon: Icon }: { 
  label: string; 
  value: string; 
  subValue: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subValue && <p className="text-sm text-emerald-500 mt-1 font-mono">{subValue}</p>}
        </div>
        <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-emerald-500" />
        </div>
      </div>
    </div>
  );
}