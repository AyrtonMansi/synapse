import { useState, useEffect, useRef } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { useSynapse } from '../hooks/useSynapse';
import { WalletConnect } from '../components/WalletConnect';
import { 
  Terminal, Activity, Cpu, Wallet, Server, 
  Clock, Zap, TrendingUp, Shield, Globe,
  ChevronRight, MoreHorizontal
} from 'lucide-react';

// Real-time console dashboard
export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { synBalance, stakedBalance, pendingRewards } = useSynapse();
  const { data: ethBalance } = useBalance({ address });
  
  const [logs, setLogs] = useState<string[]>([
    '[11:47:23] System initialized',
    '[11:47:24] Connecting to Synapse network...',
    '[11:47:25] Node status: ONLINE',
    '[11:47:26] Waiting for wallet connection...',
  ]);
  const [command, setCommand] = useState('');
  const [activePanel, setActivePanel] = useState('overview');
  const [systemStats, setSystemStats] = useState({
    cpu: 23,
    memory: 45,
    network: 12,
    jobs: 0,
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Add log when connected
  useEffect(() => {
    if (isConnected && address) {
      addLog(`Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
      addLog('Loading user data...');
    }
  }, [isConnected, address]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev.slice(-50), `[${time}] ${msg}`]);
  };

  const handleCommand = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && command.trim()) {
      addLog(`> ${command}`);
      
      // Simple command processing
      const cmd = command.trim().toLowerCase();
      if (cmd === 'help') {
        addLog('Available commands: status, balance, stake, jobs, clear');
      } else if (cmd === 'status') {
        addLog('Node: ONLINE | Network: Connected | Latency: 24ms');
      } else if (cmd === 'balance') {
        addLog(`SYN: ${synBalance || '0'} | ETH: ${parseFloat(formatEther(ethBalance?.value || 0n)).toFixed(4)}`);
      } else if (cmd === 'clear') {
        setLogs(['[System] Console cleared']);
      } else {
        addLog(`Command not found: ${command}`);
      }
      
      setCommand('');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="border border-green-500/30 bg-green-500/5 p-6 rounded-sm">
            <div className="flex items-center gap-3 mb-6">
              <Terminal className="w-8 h-8 text-green-500" />
              <h1 className="text-2xl font-mono font-bold text-green-500">SYNAPSE_CONSOLE</h1>
            </div>
            <p className="text-green-400/70 font-mono text-sm mb-6">
              Connect wallet to access the decentralized compute network
            </p>
            <WalletConnect />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono text-sm flex flex-col">
      {/* Header Bar */}
      <header className="border-b border-green-500/20 bg-zinc-950 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Terminal className="w-5 h-5 text-green-500" />
          <span className="font-bold text-green-500">SYNAPSE_NODE_v1.0.4</span>
          <span className="text-green-500/40">|</span>
          <span className="text-xs text-green-400/60">STATUS: ONLINE</span>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-400/60">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
          <WalletConnect />
        </div>
      </header>

      {/* Main Console Grid */}
      <div className="flex-1 grid grid-cols-12 gap-px bg-green-500/10">
        
        {/* Left Sidebar - Navigation */}
        <div className="col-span-2 bg-zinc-950 border-r border-green-500/20">
          <div className="p-4 border-b border-green-500/20">
            <p className="text-xs text-green-500/50 uppercase tracking-wider mb-3">Navigation</p>
            <nav className="space-y-1">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'nodes', label: 'My Nodes', icon: Server },
                { id: 'jobs', label: 'Job Queue', icon: Cpu },
                { id: 'wallet', label: 'Wallet', icon: Wallet },
                { id: 'network', label: 'Network', icon: Globe },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    activePanel === item.id 
                      ? 'bg-green-500/10 text-green-400 border-l-2 border-green-500' 
                      : 'text-green-400/60 hover:text-green-400 hover:bg-green-500/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="p-4">
            <p className="text-xs text-green-500/50 uppercase tracking-wider mb-3">Quick Stats</p>
            <div className="space-y-3">
              <StatLine label="CPU" value={`${systemStats.cpu}%`} bar={systemStats.cpu} />
              <StatLine label="MEM" value={`${systemStats.memory}%`} bar={systemStats.memory} />
              <StatLine label="NET" value={`${systemStats.network} MB/s`} bar={systemStats.network} />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col-span-7 bg-zinc-950 flex flex-col">
          {/* Content Header */}
          <div className="border-b border-green-500/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-green-500" />
              <span className="text-green-400 uppercase tracking-wider">{activePanel}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-green-400/50">
              <Clock className="w-3 h-3" />
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 p-4 overflow-auto">
            {activePanel === 'overview' && <OverviewPanel synBalance={synBalance} stakedBalance={stakedBalance} pendingRewards={pendingRewards} ethBalance={ethBalance} />}
            {activePanel === 'nodes' && <NodesPanel />}
            {activePanel === 'jobs' && <JobsPanel />}
            {activePanel === 'wallet' && <WalletPanel synBalance={synBalance} stakedBalance={stakedBalance} pendingRewards={pendingRewards} ethBalance={ethBalance} />}
            {activePanel === 'network' && <NetworkPanel />}
          </div>
        </div>

        {/* Right Panel - Logs & Console */}
        <div className="col-span-3 bg-zinc-950 border-l border-green-500/20 flex flex-col">
          {/* Logs Panel */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="border-b border-green-500/20 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-green-500/50 uppercase tracking-wider">System Log</span>
              <button 
                onClick={() => setLogs(['[System] Console cleared'])}
                className="text-xs text-green-400/40 hover:text-green-400"
              >
                clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="text-green-400/80 break-all">
                  <span className="text-green-500/40">{log}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Command Input */}
          <div className="border-t border-green-500/20 p-3">
            <div className="flex items-center gap-2 bg-zinc-900 border border-green-500/20 rounded px-3 py-2">
              <span className="text-green-500">$</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleCommand}
                placeholder="type 'help' for commands"
                className="flex-1 bg-transparent outline-none text-green-400 placeholder-green-500/30"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <footer className="border-t border-green-500/20 bg-zinc-950 px-4 py-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-green-400/70">CONNECTED</span>
          </span>
          <span className="text-green-400/40">Block: 18,492,301</span>
          <span className="text-green-400/40">Gas: 24 gwei</span>
        </div>
        <div className="flex items-center gap-4 text-green-400/40">
          <span>v1.0.4-stable</span>
          <span>64ms latency</span>
        </div>
      </footer>
    </div>
  );
}

// Stat Line Component
function StatLine({ label, value, bar }: { label: string; value: string; bar: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-green-400/60">{label}</span>
        <span className="text-green-400">{value}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${Math.min(bar, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Overview Panel
function OverviewPanel({ synBalance, stakedBalance, pendingRewards, ethBalance }: any) {
  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <ConsoleBox title="BALANCE">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-400/60">SYN</span>
              <span className="text-green-400 font-bold">{parseFloat(synBalance || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400/60">ETH</span>
              <span className="text-green-400">{parseFloat(formatEther(ethBalance?.value || 0n)).toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400/60">USD</span>
              <span className="text-green-400">${(parseFloat(synBalance || '0') * 0.05).toFixed(2)}</span>
            </div>
          </div>
        </ConsoleBox>

        <ConsoleBox title="STAKING">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-400/60">Staked</span>
              <span className="text-green-400">{parseFloat(stakedBalance || '0').toFixed(2)} SYN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400/60">Rewards</span>
              <span className="text-emerald-400">+{parseFloat(pendingRewards || '0').toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400/60">APY</span>
              <span className="text-green-400">12.5%</span>
            </div>
          </div>
        </ConsoleBox>
      </div>

      {/* Activity */}
      <ConsoleBox title="RECENT_ACTIVITY" fullWidth>
        <div className="text-center py-8 text-green-400/40">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
          <p className="text-xs mt-1">Start a node or create an API key</p>
        </div>
      </ConsoleBox>
    </div>
  );
}

// Nodes Panel
function NodesPanel() {
  return (
    <div className="space-y-4">
      <ConsoleBox title="ACTIVE_NODES" fullWidth>
        <div className="space-y-3">
          <NodeRow name="node-001" status="online" cpu={34} memory={67} uptime="3d 14h" />
          <NodeRow name="node-002" status="offline" cpu={0} memory={0} uptime="-" />
        </div>
      </ConsoleBox>

      <ConsoleBox title="SYSTEM_METRICS">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-400">127</p>
            <p className="text-xs text-green-400/50">Total Nodes</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">98%</p>
            <p className="text-xs text-green-400/50">Uptime</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">12TB</p>
            <p className="text-xs text-green-400/50">Compute</p>
          </div>
        </div>
      </ConsoleBox>
    </div>
  );
}

// Jobs Panel
function JobsPanel() {
  return (
    <div className="space-y-4">
      <ConsoleBox title="JOB_QUEUE" fullWidth>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-green-400/50 border-b border-green-500/20">
              <th className="text-left py-2">ID</th>
              <th className="text-left py-2">TYPE</th>
              <th className="text-left py-2">STATUS</th>
              <th className="text-right py-2">REWARDS</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-green-400/30">
              <td className="py-4 text-center" colSpan={4}>No active jobs</td>
            </tr>
          </tbody>
        </table>
      </ConsoleBox>
    </div>
  );
}

// Wallet Panel
function WalletPanel({ synBalance, stakedBalance, pendingRewards, ethBalance }: any) {
  return (
    <div className="space-y-4">
      <ConsoleBox title="TOKEN_BALANCES" fullWidth>
        <div className="space-y-3">
          <TokenRow symbol="SYN" name="Synapse Token" balance={synBalance || '0'} price="$0.05" />
          <TokenRow symbol="ETH" name="Ethereum" balance={parseFloat(formatEther(ethBalance?.value || 0n)).toFixed(4)} price="$2,450" />
        </div>
      </ConsoleBox>

      <ConsoleBox title="STAKING_POSITIONS">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-400/60">Staked Amount</span>
            <span className="text-green-400">{parseFloat(stakedBalance || '0').toFixed(2)} SYN</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-400/60">Pending Rewards</span>
            <span className="text-emerald-400">{parseFloat(pendingRewards || '0').toFixed(4)} SYN</span>
          </div>
          <div className="pt-2 border-t border-green-500/20">
            <button className="w-full py-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm hover:bg-green-500/20 transition-colors">
              CLAIM REWARDS
            </button>
          </div>
        </div>
      </ConsoleBox>
    </div>
  );
}

// Network Panel
function NetworkPanel() {
  return (
    <div className="space-y-4">
      <ConsoleBox title="NETWORK_STATS">
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Total Nodes" value="1,247" />
          <Metric label="Active Jobs" value="342" />
          <Metric label="Daily Requests" value="2.4M" />
          <Metric label="Avg Latency" value="24ms" />
        </div>
      </ConsoleBox>

      <ConsoleBox title="TOP_REGIONS">
        <div className="space-y-2">
          <RegionRow region="US-East" nodes={423} load={78} />
          <RegionRow region="EU-West" nodes={312} load={65} />
          <RegionRow region="Asia-Pacific" nodes={298} load={82} />
        </div>
      </ConsoleBox>
    </div>
  );
}

// Helper Components
function ConsoleBox({ title, children, fullWidth }: { title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={`border border-green-500/20 bg-zinc-900/50 ${fullWidth ? '' : ''}`}>
      <div className="border-b border-green-500/20 px-3 py-2 bg-green-500/5">
        <span className="text-xs text-green-500/70 uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function NodeRow({ name, status, cpu, memory, uptime }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-green-500/10 last:border-0">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-green-400">{name}</span>
      </div>
      <div className="flex items-center gap-6 text-xs">
        <span className="text-green-400/60">CPU: {cpu}%</span>
        <span className="text-green-400/60">MEM: {memory}%</span>
        <span className="text-green-400/60">{uptime}</span>
      </div>
    </div>
  );
}

function TokenRow({ symbol, name, balance, price }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-green-500/10 last:border-0">
      <div>
        <span className="text-green-400 font-bold">{symbol}</span>
        <span className="text-green-400/50 text-xs ml-2">{name}</span>
      </div>
      <div className="text-right">
        <p className="text-green-400">{balance}</p>
        <p className="text-xs text-green-400/50">{price}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 bg-green-500/5 rounded">
      <p className="text-xl font-bold text-green-400">{value}</p>
      <p className="text-xs text-green-400/50 mt-1">{label}</p>
    </div>
  );
}

function RegionRow({ region, nodes, load }: { region: string; nodes: number; load: number }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-green-400/80">{region}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs text-green-400/50">{nodes} nodes</span>
        <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-green-500" style={{ width: `${load}%` }} />
        </div>
      </div>
    </div>
  );
}