import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, Server, Cpu, Activity, Zap, TrendingUp, Clock, 
  Award, Wallet, CheckCircle, Globe, Layers, Thermometer,
  Bell, Filter, Download, ExternalLink, StopCircle, BarChart3,
  ChevronRight, Play, Pause
} from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { formatAddress, formatNumber, formatTimeAgo } from '../utils';

// Mock data generators
const generateEarningsData = () => {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    data.push({
      time: `Day ${30-i}`,
      earnings: Math.random() * 50 + 20,
      jobs: Math.floor(Math.random() * 100 + 50),
    });
  }
  return data;
};

const generateGpuMetrics = () => {
  const data = [];
  for (let i = 60; i >= 0; i--) {
    data.push({
      time: `${i}m`,
      temperature: 65 + Math.random() * 15,
      utilization: 70 + Math.random() * 25,
      power: 280 + Math.random() * 40,
    });
  }
  return data;
};

const MOCK_JOBS = [
  { id: 'job-001', model: 'Llama-3-70B', status: 'running', tokens: 2450, earnings: 0.045, duration: 234 },
  { id: 'job-002', model: 'GPT-4-Turbo', status: 'completed', tokens: 1890, earnings: 0.032, duration: 156 },
  { id: 'job-003', model: 'Claude-3-Opus', status: 'completed', tokens: 3200, earnings: 0.058, duration: 312 },
  { id: 'job-004', model: 'Mistral-Large', status: 'queued', tokens: 1200, earnings: 0.0, duration: 0 },
  { id: 'job-005', model: 'Llama-3-8B', status: 'completed', tokens: 890, earnings: 0.018, duration: 45 },
];

const MOCK_PAYOUTS = [
  { id: 'pay-001', amount: 456.78, timestamp: Date.now() - 86400000 * 7, txHash: '0xabc...def' },
  { id: 'pay-002', amount: 523.45, timestamp: Date.now() - 86400000 * 14, txHash: '0x123...456' },
];

export default function NodeDashboard() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedJobFilter, setSelectedJobFilter] = useState('all');
  const [earningsData] = useState(generateEarningsData());
  const [gpuMetrics] = useState(generateGpuMetrics());
  const [nodeStats, setNodeStats] = useState({
    status: 'active', 
    uptime: 97.5, 
    totalJobs: 1247, 
    totalEarnings: 2456.78,
    pendingRewards: 123.45, 
    gpuTemp: 72, 
    gpuUtilization: 89, 
    gpuMemory: 18.5,
    gpuPower: 320, 
    networkPeers: 156, 
    lastBlock: 1847293,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setNodeStats(prev => ({
        ...prev,
        gpuTemp: Math.max(60, Math.min(85, prev.gpuTemp + (Math.random() - 0.5) * 2)),
        gpuUtilization: Math.max(50, Math.min(100, prev.gpuUtilization + (Math.random() - 0.5) * 5)),
        pendingRewards: prev.pendingRewards + Math.random() * 0.001,
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'running': case 'completed': 
        return 'text-terminal-accent bg-terminal-accent/10 border-terminal-accent/30';
      case 'paused': case 'queued': 
        return 'text-terminal-amber bg-terminal-amber/10 border-terminal-amber/30';
      case 'error': case 'failed': 
        return 'text-terminal-red bg-terminal-red/10 border-terminal-red/30';
      default: 
        return 'text-terminal-dim bg-terminal-muted/10 border-terminal-muted/30';
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div 
          className="text-center space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-24 h-24 bg-terminal-accent/10 border border-terminal-accent/30 rounded-2xl mx-auto flex items-center justify-center">
            <Server className="w-12 h-12 text-terminal-accent" />
          </div>
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <span className="text-terminal-accent">$</span> Node Dashboard
          </h1>
          <p className="text-terminal-dim max-w-md">Connect your wallet to monitor your Synapse mining nodes</p>
          <WalletConnect />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Header */}
      <div className="border-b border-terminal-border bg-terminal-surface/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-terminal-accent/10 border border-terminal-accent/30 rounded-xl flex items-center justify-center">
                <Server className="w-5 h-5 text-terminal-accent" />
              </div>
              <div>
                <h1 className="font-bold text-lg flex items-center gap-2">
                  <span className="text-terminal-accent">$</span> Node Dashboard
                </h1>
                <p className="text-xs font-mono text-terminal-dim">{formatAddress(address || '')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-sm border ${getStatusColor(nodeStats.status)}`}>
                <Activity className="w-4 h-4" />
                <span className="capitalize font-mono">{nodeStats.status}</span>
              </div>
              <button className="p-2 hover:bg-terminal-elevated rounded-lg relative">
                <Bell className="w-5 h-5 text-terminal-dim" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-terminal-red rounded-full animate-pulse" />
              </button>
              <button className="p-2 bg-terminal-red/10 text-terminal-red border border-terminal-red/30 rounded-lg hover:bg-terminal-red/20 transition-colors">
                <StopCircle className="w-5 h-5" />
              </button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {[
            { icon: Thermometer, label: 'GPU Temp', value: `${Math.round(nodeStats.gpuTemp)}°C`, color: nodeStats.gpuTemp > 80 ? 'text-terminal-red' : 'text-terminal-accent' },
            { icon: Activity, label: 'Utilization', value: `${Math.round(nodeStats.gpuUtilization)}%`, color: 'text-terminal-cyan' },
            { icon: Zap, label: 'Power', value: `${Math.round(nodeStats.gpuPower)}W`, color: 'text-terminal-amber' },
            { icon: Clock, label: 'Uptime', value: `${nodeStats.uptime}%`, color: 'text-terminal-accent' },
            { icon: Globe, label: 'Peers', value: nodeStats.networkPeers, color: 'text-terminal-cyan' },
            { icon: Award, label: 'Earned', value: formatNumber(nodeStats.totalEarnings), color: 'text-terminal-accent' },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              className="terminal-card p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center gap-2 text-terminal-dim mb-1">
                <stat.icon className="w-3 h-3" />
                <span className="text-xs font-mono uppercase">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Earnings', value: formatNumber(nodeStats.totalEarnings), sub: '+12.5% vs last week', subColor: 'text-terminal-accent', icon: Award },
            { label: 'Pending Rewards', value: `${formatNumber(nodeStats.pendingRewards, 4)} SYN`, sub: 'Claim Now →', subColor: 'text-terminal-cyan', icon: Wallet },
            { label: 'Jobs Completed', value: nodeStats.totalJobs.toLocaleString(), sub: '98.5% success rate', subColor: 'text-terminal-accent', icon: Layers },
            { label: 'Current Block', value: `#${nodeStats.lastBlock.toLocaleString()}`, sub: '~12s block time', subColor: 'text-terminal-dim', icon: BarChart3 },
          ].map((card, i) => (
            <motion.div 
              key={card.label}
              className="terminal-card p-6 card-lift"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-mono text-terminal-dim uppercase tracking-wider">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                </div>
                <div className="w-14 h-14 bg-terminal-accent/10 rounded-2xl flex items-center justify-center">
                  <card.icon className="w-7 h-7 text-terminal-accent" />
                </div>
              </div>
              <p className={`text-sm ${card.subColor}`}>{card.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-terminal-surface/50 border border-terminal-border rounded-xl mb-6">
          {['overview', 'jobs', 'earnings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-terminal-accent text-terminal-bg' 
                  : 'text-terminal-dim hover:text-terminal-text hover:bg-terminal-elevated'
              }`}
            >
              <span className="font-mono">{tab === activeTab ? '$' : '#'}</span> {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Earnings Chart */}
              <div className="terminal-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-terminal-accent" />
                    <h3 className="text-lg font-semibold">Earnings History</h3>
                  </div>
                  <span className="text-xs font-mono text-terminal-dim">Last 30 days</span>
                </div>
                <div className="h-64 flex items-end gap-2">
                  {earningsData.map((day, i) => (
                    <motion.div 
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1"
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <div 
                        className="w-full bg-terminal-accent/20 hover:bg-terminal-accent/40 rounded-t transition-all cursor-pointer"
                        style={{ height: `${(day.earnings / 70) * 100}%` }}
                        title={`${day.time}: ${day.earnings.toFixed(2)} SYN`}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Recent Jobs & Payouts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="terminal-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-terminal-accent" />
                      <h3 className="text-lg font-semibold">Recent Jobs</h3>
                    </div>
                    <button className="text-xs font-mono text-terminal-accent hover:underline">View all</button>
                  </div>
                  <div className="space-y-3">
                    {MOCK_JOBS.slice(0, 4).map((job, i) => (
                      <motion.div 
                        key={job.id} 
                        className="flex items-center gap-4 p-3 bg-terminal-bg border border-terminal-border rounded-lg hover:border-terminal-accent/30 transition-all"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <div className={`w-2 h-2 rounded-full ${job.status === 'running' ? 'bg-terminal-cyan animate-pulse' : 'bg-terminal-accent'}`} />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{job.model}</p>
                          <p className="text-xs text-terminal-dim font-mono">{job.tokens.toLocaleString()} tokens</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-terminal-accent">+{job.earnings} SYN</p>
                          <p className="text-xs text-terminal-dim font-mono">{job.duration}s</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="terminal-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-terminal-accent" />
                      <h3 className="text-lg font-semibold">Recent Payouts</h3>
                    </div>
                    <button className="text-xs font-mono text-terminal-accent hover:underline">View all</button>
                  </div>
                  <div className="space-y-3">
                    {MOCK_PAYOUTS.map((payout, i) => (
                      <motion.div 
                        key={payout.id} 
                        className="flex items-center gap-4 p-3 bg-terminal-bg border border-terminal-border rounded-lg hover:border-terminal-accent/30 transition-all"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <div className="w-10 h-10 bg-terminal-accent/10 rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-terminal-accent" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{formatNumber(payout.amount)} SYN</p>
                          <p className="text-xs text-terminal-dim font-mono">{formatTimeAgo(payout.timestamp)}</p>
                        </div>
                        <a href="#" className="text-terminal-cyan hover:text-terminal-cyan/80">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'jobs' && (
            <motion.div 
              key="jobs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="terminal-card overflow-hidden"
            >
              <div className="p-4 border-b border-terminal-border flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-terminal-accent" />
                  <h3 className="text-lg font-semibold">Job Queue</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-terminal-dim" />
                    <select 
                      value={selectedJobFilter}
                      onChange={(e) => setSelectedJobFilter(e.target.value)}
                      className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="all">All Jobs</option>
                      <option value="running">Running</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <button className="p-2 hover:bg-terminal-elevated rounded-lg">
                    <Download className="w-4 h-4 text-terminal-dim" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-terminal-bg/50">
                    <tr>
                      <th className="text-left px-6 py-4 text-xs font-mono text-terminal-dim uppercase">Job ID</th>
                      <th className="text-left px-6 py-4 text-xs font-mono text-terminal-dim uppercase">Model</th>
                      <th className="text-left px-6 py-4 text-xs font-mono text-terminal-dim uppercase">Status</th>
                      <th className="text-left px-6 py-4 text-xs font-mono text-terminal-dim uppercase">Tokens</th>
                      <th className="text-right px-6 py-4 text-xs font-mono text-terminal-dim uppercase">Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border/50">
                    {MOCK_JOBS.map((job, i) => (
                      <motion.tr 
                        key={job.id} 
                        className="hover:bg-terminal-bg/30 transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <td className="px-6 py-4 font-mono text-sm text-terminal-dim">{job.id}</td>
                        <td className="px-6 py-4 font-medium">{job.model}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-mono capitalize border ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-terminal-dim font-mono">{job.tokens.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium text-terminal-accent font-mono">
                          {job.earnings > 0 ? `+${job.earnings} SYN` : '-'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'earnings' && (
            <motion.div 
              key="earnings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[
                  { label: 'Daily Average', value: '$42.50', change: '+5.2%', positive: true },
                  { label: 'This Week', value: '$297.50', change: '+12.8%', positive: true },
                  { label: 'This Month', value: '$1,275.00', change: '+8.4%', positive: true },
                ].map((stat, i) => (
                  <motion.div 
                    key={stat.label}
                    className="terminal-card p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <p className="text-xs font-mono text-terminal-dim uppercase">{stat.label}</p>
                    <p className="text-3xl font-bold mt-2">{stat.value}</p>
                    <p className={`text-sm mt-2 ${stat.positive ? 'text-terminal-accent' : 'text-terminal-red'}`}>
                      {stat.change} vs last period
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
