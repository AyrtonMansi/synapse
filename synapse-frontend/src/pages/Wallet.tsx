import { useNavigate } from 'react-router-dom';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { formatEther } from 'viem';
import { useEffect } from 'react';
import { Wallet, Copy, ExternalLink, LogOut } from 'lucide-react';
import { useSynapse } from '../hooks/useSynapse';

export default function WalletPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ethBalance } = useBalance({ address });
  const { synBalance, stakedBalance, pendingRewards } = useSynapse();

  useEffect(() => {
    if (!isConnected) {
      navigate('/connect');
    }
  }, [isConnected, navigate]);

  const copyAddress = () => {
    if (address) navigator.clipboard.writeText(address);
  };

  return (
    <div className="min-h-screen bg-slate-950 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Wallet</h1>

        {/* Wallet Info */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Connected Wallet</p>
                <p className="font-mono text-white">{address?.slice(0, 10)}...{address?.slice(-8)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={copyAddress}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4 text-slate-400" />
              </button>
              <button 
                onClick={() => window.open(`https://etherscan.io/address/${address}`, '_blank')}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </button>
              <button 
                onClick={() => disconnect()}
                className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <p className="text-sm text-slate-400 mb-2">SYN Balance</p>
            <p className="text-3xl font-bold text-white">{synBalance ? parseFloat(synBalance).toFixed(2) : '0.00'}</p>
            <p className="text-sm text-slate-500">SYN</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <p className="text-sm text-slate-400 mb-2">ETH Balance</p>
            <p className="text-3xl font-bold text-white">{ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'}</p>
            <p className="text-sm text-slate-500">ETH</p>
          </div>
        </div>

        {/* Staking */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Staking</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
              <span className="text-slate-400">Staked Amount</span>
              <span className="text-white font-medium">{stakedBalance ? parseFloat(stakedBalance).toFixed(2) : '0.00'} SYN</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-800">
              <span className="text-slate-400">Pending Rewards</span>
              <span className="text-emerald-400 font-medium">{pendingRewards ? parseFloat(pendingRewards).toFixed(4) : '0.0000'} SYN</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
                Stake
              </button>
              <button className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
                Unstake
              </button>
              <button className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg font-medium transition-colors">
                Claim
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}