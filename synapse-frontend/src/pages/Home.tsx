import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';
import { Zap, Shield, Globe, Server, ArrowRight } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) {
      navigate('/dashboard');
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-400">Network Status: Online</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Decentralized AI
              <span className="text-emerald-400"> Compute</span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
              Rent GPU compute power from a global network of providers. 
              Pay with crypto, no KYC required.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => navigate('/connect')}
                className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
              >
                Launch App
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={Server}
            title="GPU Compute"
            description="Access high-performance GPUs for AI training and inference"
          />
          <FeatureCard 
            icon={Shield}
            title="No KYC Required"
            description="Connect your wallet and start computing immediately"
          />
          <FeatureCard 
            icon={Globe}
            title="Global Network"
            description="Distributed compute nodes worldwide for low latency"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="border-y border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <Stat value="1,247" label="Active Nodes" />
            <Stat value="$2.4M" label="Total Compute" />
            <Stat value="99.9%" label="Uptime" />
            <Stat value="24ms" label="Avg Latency" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors">
      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}

function Stat({ value, label }: any) {
  return (
    <div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}