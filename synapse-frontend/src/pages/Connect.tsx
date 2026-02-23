import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ArrowRight, Zap, Shield, Globe } from 'lucide-react';

export default function Connect() {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();

  // Redirect to dashboard if already connected
  useEffect(() => {
    if (isConnected) {
      navigate('/dashboard');
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Synapse</h1>
          <p className="text-slate-400">Connect your wallet to access the dashboard</p>
        </div>

        {/* Connect Card */}
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Connect Wallet</h2>
          
          {/* Wallet Options */}
          <div className="space-y-3">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => connect({ connector })}
                disabled={isPending}
                className="w-full flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-slate-400 group-hover:text-emerald-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-white">{connector.name}</p>
                  <p className="text-sm text-slate-500">Click to connect</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400" />
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error.message}</p>
            </div>
          )}

          {isPending && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-emerald-400">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Connecting...</span>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="text-center">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-500">Secure</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-500">Fast</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-500">Decentralized</p>
          </div>
        </div>
      </div>
    </div>
  );
}