import { useState } from 'react';
import { useAccount } from 'wagmi';
import {
  Server,
  Plus,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Cpu,
  Globe,
  Zap,
  History,
  X,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletConnect } from '../components/WalletConnect';
import { useSynapse } from '../hooks/useSynapse';
import { formatAddress, formatNumber, formatTimeAgo } from '../utils';
import type { ComputeNode, JobHistory } from '../types';

const mockNodes: ComputeNode[] = [
  {
    id: 'node_001',
    name: 'Alpha Compute-1',
    status: 'active',
    gpuModel: 'NVIDIA A100',
    vram: 80,
    tflops: 312,
    region: 'us-east-1',
    uptime: 99.8,
    jobsCompleted: 1247,
    earnings: '456.78',
    stakedAmount: '10000',
    registeredAt: Date.now() - 86400000 * 45,
    lastSeen: Date.now(),
    capabilities: ['inference', 'training', 'fine-tuning'],
    pricePerHour: '0.5',
  },
  {
    id: 'node_002',
    name: 'Beta GPU Cluster',
    status: 'maintenance',
    gpuModel: 'NVIDIA H100',
    vram: 80,
    tflops: 989,
    region: 'eu-west-1',
    uptime: 97.2,
    jobsCompleted: 523,
    earnings: '234.56',
    stakedAmount: '5000',
    registeredAt: Date.now() - 86400000 * 30,
    lastSeen: Date.now() - 3600000,
    capabilities: ['inference', 'training'],
    pricePerHour: '1.2',
  },
];

const mockJobs: JobHistory[] = [
  {
    id: 'job_001',
    nodeId: 'node_001',
    status: 'completed',
    model: 'GPT-4',
    promptTokens: 1024,
    completionTokens: 2048,
    duration: 45,
    earnings: '0.023',
    createdAt: Date.now() - 3600000,
    completedAt: Date.now() - 3595500,
    clientAddress: '0x1234...5678',
  },
  {
    id: 'job_002',
    nodeId: 'node_001',
    status: 'completed',
    model: 'Claude-3',
    promptTokens: 512,
    completionTokens: 1024,
    duration: 23,
    earnings: '0.012',
    createdAt: Date.now() - 7200000,
    completedAt: Date.now() - 7197700,
    clientAddress: '0x8765...4321',
  },
];

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: any) => void;
}

function RegisterNodeModal({ isOpen, onClose, onRegister }: RegisterModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    gpuModel: 'NVIDIA A100',
    vram: 80,
    tflops: 312,
    region: 'us-east-1',
    stakeAmount: '5000',
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl p-6 max-w-lg w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Register New Node</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onRegister(formData); onClose(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Node Name</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-white" placeholder="My GPU Node" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">GPU Model</label>
            <select value={formData.gpuModel} onChange={(e) => setFormData({...formData, gpuModel: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-white">
              <option>NVIDIA A100</option>
              <option>NVIDIA H100</option>
              <option>NVIDIA RTX 4090</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">VRAM (GB)</label>
              <input type="number" value={formData.vram} onChange={(e) => setFormData({...formData, vram: parseInt(e.target.value)})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">TFLOPS</label>
              <input type="number" value={formData.tflops} onChange={(e) => setFormData({...formData, tflops: parseFloat(e.target.value)})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Region</label>
            <select value={formData.region} onChange={(e) => setFormData({...formData, region: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-white">
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">Europe (Ireland)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Stake Amount (SYN)</label>
            <input type="number" value={formData.stakeAmount} onChange={(e) => setFormData({...formData, stakeAmount: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-white" />
            <p className="text-xs text-neutral-500 mt-1">Minimum stake: 5,000 SYN</p>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white py-2 rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 bg-emerald-500 text-black py-2 rounded-lg font-medium hover:bg-emerald-400">Register Node</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function NodeOperator() {
  const { address, isConnected } = useAccount();
  const { synBalance, pendingRewards, claim, isClaiming } = useSynapse();
  const [activeTab, setActiveTab] = useState<'overview' | 'nodes' | 'jobs' | 'earnings'>('overview');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [nodes, setNodes] = useState<ComputeNode[]>(mockNodes);

  const totalEarnings = nodes.reduce((sum, n) => sum + parseFloat(n.earnings), 0);
  const totalStaked = nodes.reduce((sum, n) => sum + parseFloat(n.stakedAmount), 0);
  const activeNodes = nodes.filter(n => n.status === 'active').length;
  const totalJobs = nodes.reduce((sum, n) => sum + n.jobsCompleted, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'inactive': return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20';
      case 'maintenance': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return '';
    }
  };

  const handleRegisterNode = (data: any) => {
    const newNode: ComputeNode = {
      id: `node_${Date.now()}`,
      name: data.name,
      status: 'syncing',
      gpuModel: data.gpuModel,
      vram: data.vram,
      tflops: data.tflops,
      region: data.region,
      uptime: 100,
      jobsCompleted: 0,
      earnings: '0',
      stakedAmount: data.stakeAmount,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      capabilities: ['inference'],
      pricePerHour: '0.5',
    };
    setNodes([newNode, ...nodes]);
  };

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mx-auto flex items-center justify-center">
            <Server className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold">Node Operator Portal</h1>
          <p className="text-neutral-400 max-w-md">Connect your wallet to register compute nodes, track earnings, and manage your AI infrastructure.</p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Node Operator</h1>
          <p className="text-neutral-400 mt-1">Manage your compute infrastructure and track earnings</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowRegisterModal(true)} className="bg-emerald-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-emerald-400 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Node
          </button>
          <WalletConnect />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">Total Earnings</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(totalEarnings, 3)} SYN</p>
              <p className="text-sm text-emerald-400 mt-1">+12.5% this week</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center"><TrendingUp className="w-6 h-6 text-emerald-400" /></div>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">Total Staked</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(totalStaked)} SYN</p>
              <p className="text-sm text-neutral-400 mt-1">24.5% APR</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center"><Wallet className="w-6 h-6 text-emerald-400" /></div>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">Active Nodes</p>
              <p className="text-2xl font-bold mt-1">{activeNodes} / {nodes.length}</p>
              <p className="text-sm text-neutral-400 mt-1">{totalJobs.toLocaleString()} jobs</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center"><Server className="w-6 h-6 text-emerald-400" /></div>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">Pending Rewards</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(parseFloat(pendingRewards || '0'), 4)} SYN</p>
              <button onClick={() => claim()} disabled={isClaiming || parseFloat(pendingRewards || '0') === 0} className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 disabled:text-neutral-600">
                {isClaiming ? 'Claiming...' : 'Claim Now →'}
              </button>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center"><Zap className="w-6 h-6 text-emerald-400" /></div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl mb-6 w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'nodes', label: 'My Nodes', icon: Server },
          { id: 'jobs', label: 'Job History', icon: History },
          { id: 'earnings', label: 'Earnings', icon: Wallet },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Server className="w-5 h-5 text-emerald-400" /> Your Nodes</h2>
              <div className="space-y-3">
                {nodes.map(node => (
                  <div key={node.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{node.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(node.status)}`}>{node.status}</span>
                        </div>
                        <p className="text-sm text-neutral-400">{node.gpuModel} • {node.vram}GB</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatNumber(parseFloat(node.earnings), 3)} SYN</p>
                        <p className="text-xs text-neutral-500">{node.jobsCompleted} jobs</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><History className="w-5 h-5 text-emerald-400" /> Recent Jobs</h2>
              <div className="space-y-3">
                {mockJobs.map(job => (
                  <div key={job.id} className="flex items-center gap-4 p-3 bg-white/[0.03] rounded-xl">
                    <div className={`w-2 h-2 rounded-full ${job.status === 'completed' ? 'bg-emerald-400' : 'bg-emerald-400 animate-pulse'}`} />
                    <div className="flex-1"><p className="font-medium text-sm">{job.model}</p><p className="text-xs text-neutral-500">{job.promptTokens + job.completionTokens} tokens</p></div>
                    <div className="text-right"><p className="text-sm font-medium text-emerald-400">+{job.earnings} SYN</p><p className="text-xs text-neutral-500">{formatTimeAgo(job.createdAt)}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'nodes' && (
          <motion.div key="nodes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {nodes.map(node => (
              <div key={node.id} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{node.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(node.status)}`}>{node.status}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-neutral-400">GPU</p><p className="font-medium">{node.gpuModel}</p></div>
                      <div><p className="text-neutral-400">VRAM</p><p className="font-medium">{node.vram} GB</p></div>
                      <div><p className="text-neutral-400">TFLOPS</p><p className="font-medium">{node.tflops}</p></div>
                      <div><p className="text-neutral-400">Region</p><p className="font-medium flex items-center gap-1"><Globe className="w-3 h-3" /> {node.region}</p></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatNumber(parseFloat(node.earnings), 3)} SYN</p>
                    <p className="text-sm text-neutral-400">{node.jobsCompleted} jobs completed</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/[0.03]">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Job ID</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Model</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Tokens</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-neutral-400">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {mockJobs.map(job => (
                  <tr key={job.id} className="hover:bg-white/[0.03]">
                    <td className="px-6 py-4 font-mono text-sm">{job.id}</td>
                    <td className="px-6 py-4">{job.model}</td>
                    <td className="px-6 py-4"><span className={job.status === 'completed' ? 'text-emerald-400' : 'text-emerald-400'}>{job.status}</span></td>
                    <td className="px-6 py-4 text-sm">{job.promptTokens + job.completionTokens}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-400">+{job.earnings} SYN</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {activeTab === 'earnings' && (
          <motion.div key="earnings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-6">Earnings Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white/[0.03] rounded-xl">
                <p className="text-sm text-neutral-400 mb-2">Total Earned (All Time)</p>
                <p className="text-3xl font-bold">{formatNumber(totalEarnings, 4)} SYN</p>
                <p className="text-sm text-emerald-400 mt-2">≈ ${(totalEarnings * 5).toFixed(2)} USD</p>
              </div>
              <div className="p-6 bg-white/[0.03] rounded-xl">
                <p className="text-sm text-neutral-400 mb-2">This Month</p>
                <p className="text-3xl font-bold">{formatNumber(totalEarnings * 0.3, 4)} SYN</p>
                <p className="text-sm text-emerald-400 mt-2">+23% vs last month</p>
              </div>
              <div className="p-6 bg-white/[0.03] rounded-xl">
                <p className="text-sm text-neutral-400 mb-2">Available to Withdraw</p>
                <p className="text-3xl font-bold">{formatNumber(parseFloat(pendingRewards || '0'), 4)} SYN</p>
                <button onClick={() => claim()} disabled={isClaiming || parseFloat(pendingRewards || '0') === 0} className="w-full bg-emerald-500 text-black py-2 rounded-lg font-medium mt-4 hover:bg-emerald-400 disabled:opacity-50">{isClaiming ? 'Withdrawing...' : 'Withdraw All'}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RegisterNodeModal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)} onRegister={handleRegisterNode} />
    </div>
  );
}
