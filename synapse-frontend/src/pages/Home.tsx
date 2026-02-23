import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';
import { Zap, Shield, Globe, Server, ArrowRight, Code, Cpu, Layers, Check } from 'lucide-react';

const models = [
  { name: 'DeepSeek V3', provider: 'DeepSeek', price: '$0.0015/1K', context: '128K' },
  { name: 'Llama 3.1 70B', provider: 'Meta', price: '$0.0012/1K', context: '128K' },
  { name: 'Llama 3.1 8B', provider: 'Meta', price: '$0.0003/1K', context: '128K' },
  { name: 'Mistral Large 2', provider: 'Mistral', price: '$0.0020/1K', context: '128K' },
];

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
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-400">1,247 GPUs Online Now</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Decentralized AI
              <span className="text-emerald-400"> Inference API</span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
              Access DeepSeek, Llama, Mistral and more through a single API. 
              Pay with crypto. No KYC. Decentralized compute network.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button 
                onClick={() => navigate('/connect')}
                className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
              >
                Get API Key
                <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={() => navigate('/docs')}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors"
              >
                View Docs
              </button>
            </div>
            
            {/* Code Example */}
            <div className="mt-12 max-w-2xl mx-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-left">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-4 text-sm text-slate-500">example.js</span>
                </div>
                <pre className="p-4 text-sm text-slate-300 overflow-x-auto">
                  <code>{`curl https://api.synapse.network/v1/chat/completions \\
  -H "Authorization: Bearer syn_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Why Synapse?</h2>
            <p className="text-slate-400">The easiest way to access AI models at the best prices</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Code}
              title="Simple API"
              description="OpenAI-compatible API. Drop-in replacement for your existing code."
            />
            <FeatureCard 
              icon={Shield}
              title="No KYC Required"
              description="Connect your wallet and start using. No signup, no personal info."
            />
            <FeatureCard 
              icon={Globe}
              title="Global Network"
              description="Distributed GPU nodes worldwide. Low latency, high availability."
            />
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="py-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Available Models</h2>
            <p className="text-slate-400">Access the best open-source AI models</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {models.map((model) => (
              <div key={model.name} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-emerald-500/30 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Cpu className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{model.context}</span>
                </div>
                <h3 className="font-semibold text-white mb-1">{model.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{model.provider}</p>
                <p className="text-emerald-400 font-medium">{model.price} tokens</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-slate-400">Get started in minutes</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard 
              number="1"
              title="Connect Wallet"
              description="Connect your MetaMask or WalletConnect. No signup required."
            />
            <StepCard 
              number="2"
              title="Generate API Key"
              description="Create an API key in the dashboard. Get 1M free tokens."
            />
            <StepCard 
              number="3"
              title="Start Building"
              description="Make API calls. Pay with SYN, ETH, or USDC."
            />
          </div>
        </div>
      </section>

      {/* Earn Section */}
      <section className="py-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Run a Node, Earn SYN</h2>
              <p className="text-slate-400 mb-6">
                Have a GPU? Run a Synapse node and earn tokens by providing compute power 
                to the network. Set your own prices, work when you want.
              </p>
              <ul className="space-y-3 mb-8">
                {['Earn SYN tokens for every job processed', 'Set your own pricing', 'No minimum commitment', 'Automatic payments'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => navigate('/nodes/setup')}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
              >
                Start Earning
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-slate-400">Earnings Calculator</span>
                <span className="text-emerald-400 font-medium">RTX 4090</span>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Daily Jobs</span>
                  <span className="text-white">~500 requests</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Avg Price</span>
                  <span className="text-white">$0.0015/1K tokens</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Daily Earnings</span>
                  <span className="text-emerald-400 font-medium">~$50-100</span>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Potential</span>
                    <span className="text-2xl font-bold text-emerald-400">$1,500-3,000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <Stat value="1,247" label="Active GPUs" />
            <Stat value="2.4M" label="API Requests/Day" />
            <Stat value="99.9%" label="Uptime" />
            <Stat value="$0.0015" label="Starting Price/1K" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to start?
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Get 1 million free tokens. No credit card required.
          </p>
          <button 
            onClick={() => navigate('/connect')}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
          >
            Get Started Free
          </button>
        </div>
      </section>
    </div>
  );
}

// Components
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

function StepCard({ number, title, description }: any) {
  return (
    <div className="relative">
      <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-black font-bold text-xl mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}

function Stat({ value, label }: any) {
  return (
    <div>
      <p className="text-4xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}