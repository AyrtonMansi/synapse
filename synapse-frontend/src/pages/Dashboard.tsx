import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Key, Server, Wallet, Activity, 
  Plus, Copy, Eye, EyeOff, Trash2, TrendingUp,
  Clock, Zap, ChevronRight, AlertCircle, CheckCircle
} from 'lucide-react';
import { useSynapse } from '../hooks/useSynapse';

// Mock data for now - will be replaced with real API calls
const MOCK_API_KEYS = [
  {
    id: 'key_001',
    name: 'Production',
    key: 'syn_live_xxxxxxxxxxxx',
    createdAt: '2024-02-23',
    lastUsed: '2 hours ago',
    usage: 450000,
  },
  {
    id: 'key_002', 
    name: 'Development',
    key: 'syn_test_xxxxxxxxxxxx',
    createdAt: '2024-02-20',
    lastUsed: '1 day ago',
    usage: 12000,
  },
];

const MOCK_USAGE = [
  { date: 'Feb 17', requests: 1200, tokens: 45000 },
  { date: 'Feb 18', requests: 1500, tokens: 52000 },
  { date: 'Feb 19', requests: 1800, tokens: 61000 },
  { date: 'Feb 20', requests: 1400, tokens: 48000 },
  { date: 'Feb 21', requests: 2100, tokens: 75000 },
  { date: 'Feb 22', requests: 1900, tokens: 68000 },
  { date: 'Feb 23', requests: 450, tokens: 15000 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { synBalance, stakedBalance, pendingRewards } = useSynapse();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [apiKeys, setApiKeys] = useState(MOCK_API_KEYS);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      navigate('/connect');
    }
  }, [isConnected, navigate]);

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const createKey = () => {
    if (!newKeyName.trim()) return;
    
    const newKey = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      key: `syn_live_${Math.random().toString(36).substring(2, 15)}`,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      usage: 0,
    };
    
    setApiKeys([newKey, ...apiKeys]);
    setNewKeyName('');
    setShowNewKeyModal(false);
  };

  const deleteKey = (id: string) => {
    if (confirm('Are you sure? This cannot be undone.')) {
      setApiKeys(apiKeys.filter(k => k.id !== id));
    }
  };

  const totalTokensUsed = apiKeys.reduce((sum, k) => sum + k.usage, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">Synapse</span>
              </div>
              <nav className="hidden md:flex items-center gap-1">
                <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={LayoutDashboard} label="Overview" />
                <NavButton active={activeTab === 'api-keys'} onClick={() => setActiveTab('api-keys')} icon={Key} label="API Keys" />
                <NavButton active={activeTab === 'usage'} onClick={() => setActiveTab('usage')} icon={Activity} label="Usage" />
                <NavButton active={activeTab === 'nodes'} onClick={() => setActiveTab('nodes')} icon={Server} label="Nodes" />
                <NavButton active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={Wallet} label="Wallet" />
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {address && (
                <span className="text-sm text-slate-400 font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab 
            synBalance={synBalance} 
            ethBalance={ethBalance}
            totalTokensUsed={totalTokensUsed}
            apiKeysCount={apiKeys.length}
            onCreateKey={() => setShowNewKeyModal(true)}
          />
        )}
        {activeTab === 'api-keys' && (
          <ApiKeysTab 
            apiKeys={apiKeys}
            visibleKeys={visibleKeys}
            copiedId={copiedId}
            onToggleVisibility={toggleKeyVisibility}
            onCopy={copyKey}
            onDelete={deleteKey}
            onCreate={() => setShowNewKeyModal(true)}
          />
        )}
        {activeTab === 'usage' && <UsageTab usage={MOCK_USAGE} />}
        {activeTab === 'nodes' && <NodesTab />}
        {activeTab === 'wallet' && (
          <WalletTab 
            synBalance={synBalance}
            stakedBalance={stakedBalance}
            pendingRewards={pendingRewards}
            ethBalance={ethBalance}
          />
        )}
      </main>

      {/* New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create New API Key</h3>
            <input
              type="text"
              placeholder="Key name (e.g., Production)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 mb-4"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowNewKeyModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={createKey}
                disabled={!newKeyName.trim()}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Create Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Navigation Button
function NavButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-emerald-500/10 text-emerald-400' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// Overview Tab
function OverviewTab({ synBalance, ethBalance, totalTokensUsed, apiKeysCount, onCreateKey }: any) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to Synapse</h1>
        <p className="text-slate-400">Generate API keys to start using AI inference. Run a node to earn rewards.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="API Keys"
          value={apiKeysCount.toString()}
          subValue="Active keys"
          icon={Key}
        />
        <StatCard 
          title="Tokens Used"
          value={totalTokensUsed.toLocaleString()}
          subValue="This billing period"
          icon={Activity}
        />
        <StatCard 
          title="SYN Balance"
          value={synBalance ? parseFloat(synBalance).toFixed(2) : '0.00'}
          subValue="Available for payments"
          icon={Wallet}
        />
        <StatCard 
          title="Free Tokens"
          value="1,000,000"
          subValue="Remaining"
          icon={Zap}
          highlight
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard 
          title="Create API Key"
          description="Generate a new key to access AI models"
          icon={Plus}
          action="Create Key"
          onClick={onCreateKey}
        />
        <ActionCard 
          title="Run a Node"
          description="Earn SYN by providing GPU compute"
          icon={Server}
          action="Setup Node"
          onClick={() => window.location.href = '/nodes/setup'}
        />
      </div>

      {/* Quick Start */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Start</h3>
        <div className="bg-slate-950 rounded-xl p-4 font-mono text-sm text-slate-300 overflow-x-auto">
          <code>{`curl https://api.synapse.network/v1/chat/completions \\
  -H "Authorization: Bearer syn_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</code>
        </div>
      </div>
    </div>
  );
}

// API Keys Tab
function ApiKeysTab({ apiKeys, visibleKeys, copiedId, onToggleVisibility, onCopy, onDelete, onCreate }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">API Keys</h2>
          <p className="text-slate-400">Manage your API keys for accessing AI models</p>
        </div>
        <button 
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      <div className="space-y-4">
        {apiKeys.map((key: any) => (
          <div key={key.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white">{key.name}</h3>
                <p className="text-sm text-slate-500">Created {key.createdAt} • Last used {key.lastUsed}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onToggleVisibility(key.id)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  {visibleKeys.has(key.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => onCopy(key.key, key.id)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(key.id)}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-400 font-mono">
                {visibleKeys.has(key.id) ? key.key : `${key.key.slice(0, 12)}...${key.key.slice(-4)}`}
              </code>
              {copiedId === key.id && (
                <span className="text-emerald-400 text-sm">Copied!</span>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-sm">
              <span className="text-slate-500">Usage: {key.usage.toLocaleString()} tokens</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Usage Tab
function UsageTab({ usage }: any) {
  const totalRequests = usage.reduce((sum: number, d: any) => sum + d.requests, 0);
  const totalTokens = usage.reduce((sum: number, d: any) => sum + d.tokens, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Usage Statistics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-400 text-sm mb-1">Total Requests</p>
          <p className="text-3xl font-bold text-white">{totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-400 text-sm mb-1">Total Tokens</p>
          <p className="text-3xl font-bold text-white">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-400 text-sm mb-1">Estimated Cost</p>
          <p className="text-3xl font-bold text-white">${(totalTokens * 0.0015 / 1000).toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Date</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-400">Requests</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-400">Tokens</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-400">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {usage.map((day: any) => (
              <tr key={day.date} className="hover:bg-slate-800/30">
                <td className="px-6 py-3 text-sm text-white">{day.date}</td>
                <td className="px-6 py-3 text-sm text-right text-slate-300">{day.requests.toLocaleString()}</td>
                <td className="px-6 py-3 text-sm text-right text-slate-300">{day.tokens.toLocaleString()}</td>
                <td className="px-6 py-3 text-sm text-right text-emerald-400">${(day.tokens * 0.0015 / 1000).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Nodes Tab
function NodesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">My Nodes</h2>
          <p className="text-slate-400">Run GPU nodes to earn SYN tokens</p>
        </div>
        <button 
          onClick={() => window.location.href = '/nodes/setup'}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Deploy Node
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
        <Server className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No nodes deployed</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Deploy a compute node to start earning rewards by providing GPU power to the network
        </p>
        <button 
          onClick={() => window.location.href = '/nodes/setup'}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
        >
          Deploy Your First Node
        </button>
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-white">Requirements</h3>
            <ul className="mt-2 text-sm text-slate-400 space-y-1">
              <li>• NVIDIA GPU with 8GB+ VRAM</li>
              <li>• Stable internet connection</li>
              <li>• Minimum 10,000 SYN stake</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wallet Tab
function WalletTab({ synBalance, stakedBalance, pendingRewards, ethBalance }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Wallet</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Balances</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-emerald-400">SYN</span>
                </div>
                <div>
                  <p className="font-medium text-white">Synapse Token</p>
                  <p className="text-sm text-slate-500">For payments & staking</p>
                </div>
              </div>
              <span className="text-xl font-bold text-white">{synBalance ? parseFloat(synBalance).toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-slate-400">ETH</span>
                </div>
                <div>
                  <p className="font-medium text-white">Ethereum</p>
                  <p className="text-sm text-slate-500">For gas fees</p>
                </div>
              </div>
              <span className="text-xl font-bold text-white">{ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Staking</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
              <span className="text-slate-400">Staked Amount</span>
              <span className="text-white font-medium">{stakedBalance ? parseFloat(stakedBalance).toFixed(2) : '0.00'} SYN</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
              <span className="text-slate-400">Pending Rewards</span>
              <span className="text-emerald-400 font-medium">{pendingRewards ? parseFloat(pendingRewards).toFixed(4) : '0.0000'} SYN</span>
            </div>
            <div className="pt-2">
              <button className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
                Claim Rewards
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function StatCard({ title, value, subValue, icon: Icon, highlight }: any) {
  return (
    <div className={`bg-slate-900/50 border ${highlight ? 'border-emerald-500/30' : 'border-slate-800'} rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{title}</span>
        <div className={`w-8 h-8 ${highlight ? 'bg-emerald-500/10' : 'bg-slate-800'} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className={`text-sm mt-1 ${highlight ? 'text-emerald-400' : 'text-slate-500'}`}>{subValue}</p>
    </div>
  );
}

function ActionCard({ title, description, icon: Icon, action, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-emerald-500/30 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
            <Icon className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
      </div>
      <div className="mt-4 pt-4 border-t border-slate-800">
        <span className="text-sm text-emerald-400 font-medium">{action}</span>
      </div>
    </div>
  );
}