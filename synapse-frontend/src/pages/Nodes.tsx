import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';
import { Server, Plus, AlertCircle } from 'lucide-react';

export default function Nodes() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!isConnected) {
      navigate('/connect');
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">My Nodes</h1>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Deploy Node
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <Server className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No nodes deployed</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Deploy a compute node to start earning rewards by providing GPU power to the network
          </p>
          <button className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
            Deploy Your First Node
          </button>
        </div>

        <div className="mt-8 bg-slate-900/30 border border-slate-800 rounded-xl p-6">
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
    </div>
  );
}