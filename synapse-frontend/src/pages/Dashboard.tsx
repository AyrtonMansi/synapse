import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { 
  LayoutDashboard, Wallet, Server, Activity, 
  TrendingUp, Clock, ChevronRight, Plus,
  Copy, ExternalLink, AlertCircle
} from 'lucide-react';
import { useSynapse } from '../hooks/useSynapse';

export default function Dashboard() {
  const { address } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { synBalance, stakedBalance, pendingRewards } = useSynapse();
  const [activeTab, setActiveTab] = useState('overview');

  const copyAddress = () => {
    if (address) navigator.clipboard.writeText(address);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Navigation */}
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">Synapse</span>
              </div>
              <nav className="hidden md:flex items-center gap-1">
                <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={LayoutDashboard} label="Overview" />
                <NavButton active={activeTab === 'nodes'} onClick={() => setActiveTab('nodes')} icon={Server} label="Nodes" />
                <NavButton active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={Wallet} label="Wallet" />
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {address && (
                <button 
                  onClick={copyAddress}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab synBalance={synBalance} stakedBalance={stakedBalance} pendingRewards={pendingRewards} ethBalance={ethBalance} address={address} />}
        {activeTab === 'nodes' && <NodesTab />}
        {activeTab === 'wallet' && <WalletTab synBalance={synBalance} stakedBalance={stakedBalance} pendingRewards={pendingRewards} ethBalance={ethBalance} />}
      </main>
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
function OverviewTab({ synBalance, stakedBalance, pendingRewards, ethBalance, address }: any) {
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard Overview</h1>
        <p className="text-slate-400">Manage your nodes, monitor performance, and track earnings.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="SYN Balance"
          value={synBalance ? parseFloat(synBalance).toFixed(2) : '0.00'}
          symbol="SYN"
          change="+0.00%"
          icon={Wallet}
        />
        <StatCard 
          title="Staked"
          value={stakedBalance ? parseFloat(stakedBalance).toFixed(2) : '0.00'}
          symbol="SYN"
          change="Earning rewards"
          icon={TrendingUp}
        />
        <StatCard 
          title="Pending Rewards"
          value={pendingRewards ? parseFloat(pendingRewards).toFixed(4) : '0.0000'}
          symbol="SYN"
          change="Ready to claim"
          icon={Clock}
          highlight
        />
        <StatCard 
          title="ETH Balance"
          value={ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'}
          symbol="ETH"
          change="For gas fees"
          icon={Activity}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard 
          title="Start a Node"
          description="Deploy a compute node and start earning"
          icon={Server}
          action="Get Started"
        />
        <ActionCard 
          title="View Documentation"
          description="Learn how to use the platform"
          icon={ExternalLink}
          action="Read Docs"
        />
      </div>
    </div>
  );
}

// Nodes Tab
function NodesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">My Nodes</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Add Node
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
        <Server className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No nodes yet</h3>
        <p className="text-slate-400 mb-4">Deploy your first compute node to start earning rewards</p>
        <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
          Deploy Node
        </button>
      </div>
    </div>
  );
}

// Wallet Tab
function WalletTab({ synBalance, stakedBalance, pendingRewards, ethBalance }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Wallet</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balances */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-medium text-white mb-4">Balances</h3>
          <div className="space-y-4">
            <BalanceRow symbol="SYN" name="Synapse Token" balance={synBalance || '0'} />
            <BalanceRow symbol="ETH" name="Ethereum" balance={ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0'} />
          </div>
        </div>

        {/* Staking */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-medium text-white mb-4">Staking</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
              <span className="text-slate-400">Staked Amount</span>
              <span className="text-white font-medium">{stakedBalance ? parseFloat(stakedBalance).toFixed(2) : '0.00'} SYN</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
              <span className="text-slate-400">Pending Rewards</span>
              <span className="text-emerald-400 font-medium">{pendingRewards ? parseFloat(pendingRewards).toFixed(4) : '0.0000'} SYN</span>
            </div>
            <button className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
              Claim Rewards
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function StatCard({ title, value, symbol, change, icon: Icon, highlight }: any) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-400 text-sm">{title}</span>
        <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
          <Icon className={`w-4 h-4 ${highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-slate-500 text-sm">{symbol}</span>
      </div>
      <p className={`text-sm mt-2 ${highlight ? 'text-emerald-400' : 'text-slate-500'}`}>{change}</p>
    </div>
  );
}

function ActionCard({ title, description, icon: Icon, action }: any) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors group cursor-pointer">
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

function BalanceRow({ symbol, name, balance }: any) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
          <span className="text-sm font-bold text-slate-400">{symbol.slice(0, 2)}</span>
        </div>
        <div>
          <p className="font-medium text-white">{symbol}</p>
          <p className="text-sm text-slate-500">{name}</p>
        </div>
      </div>
      <span className="font-medium text-white">{balance}</span>
    </div>
  );
}