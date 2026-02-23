import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { 
  Zap, 
  Server, 
  Shield, 
  Globe, 
  ArrowRight,
  Cpu,
  Layers,
  Lock,
  Check,
  Copy,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { WalletConnect } from '../components/WalletConnect';
import { formatNumber } from '../utils';

const features = [
  {
    icon: Server,
    title: 'Decentralized Compute',
    description: 'Access distributed GPU compute power from a global network of providers. No single point of failure.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'End-to-end encryption and zero-knowledge proofs protect your data and model weights.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Sub-second inference with edge-optimized model distribution across 50+ regions.',
  },
  {
    icon: Globe,
    title: 'Global Network',
    description: 'Low-latency access from anywhere in the world with automatic geo-routing.',
  },
];

const stats = [
  { value: '10,000+', label: 'Active GPUs' },
  { value: '50+', label: 'Regions' },
  { value: '1M+', label: 'Inference Jobs' },
  { value: '$2.5M+', label: 'Rewards Paid' },
];

const pricingComparison = [
  { provider: 'OpenAI GPT-4', price: '$0.09', multiplier: '60× more' },
  { provider: 'Anthropic Claude', price: '$0.09', multiplier: '60× more' },
  { provider: 'Synapse', price: '$0.0015', multiplier: 'Best price', highlight: true },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Home() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const location = useLocation();
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  useEffect(() => {
    // Check if we should open wallet connect
    if (location.state?.connectWallet) {
      // Wallet connect will be triggered by the button
    }
  }, [location.state]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto relative">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Now on Mainnet
            </motion.div>

            {/* Headline */}
            <motion.h1 
              className="text-4xl md:text-6xl font-semibold tracking-tight mb-4 leading-[1.1]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Decentralized AI Compute
              <br />
              <span className="text-emerald-400">at a Fraction of the Cost</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p 
              className="text-lg text-neutral-400 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Run AI inference on a global mesh of GPUs. 90% cheaper than OpenAI.
              <br className="hidden md:block" />
              No API key required to start.
            </motion.p>

            {/* Pricing Card */}
            <motion.div 
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 max-w-sm mx-auto mb-8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="text-xs text-emerald-400 tracking-wider mb-2 uppercase">Synapse Pricing</div>
              <div className="text-5xl font-bold text-white mb-1">$0.0015</div>
              <div className="text-sm text-neutral-400">per 1K tokens on DeepThink</div>
              <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs text-neutral-500">
                60× cheaper than OpenAI GPT-4
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {isConnected ? (
                <Link 
                  to="/dashboard" 
                  className="bg-emerald-500 text-black px-8 py-3 rounded-lg font-medium hover:bg-emerald-400 transition-colors flex items-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <WalletConnect />
              )}
              <Link 
                to="/docs/quickstart" 
                className="bg-white/[0.05] border border-white/[0.15] text-white px-8 py-3 rounded-lg font-medium hover:bg-white/[0.08] transition-colors"
              >
                Read Docs
              </Link>
            </motion.div>

            {/* Benefits */}
            <motion.div 
              className="flex items-center justify-center gap-6 mt-6 text-sm text-neutral-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                Free 1M token trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                No subscription
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div 
                key={i} 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-3xl md:text-4xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-neutral-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs text-emerald-400 tracking-wider mb-2 uppercase">Features</div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Why Choose Synapse?</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Built for developers who need reliable, scalable AI compute without vendor lock-in or inflated prices.
            </p>
          </div>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {features.map((feature, i) => (
              <motion.div 
                key={i} 
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 hover:border-emerald-500/30 transition-colors group"
                variants={fadeInUp}
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Node Operator Section */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs text-emerald-400 tracking-wider mb-2 uppercase">For Node Operators</div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-6">
                Earn by Contributing
                <br />
                <span className="text-emerald-400">Compute Power</span>
              </h2>
              <p className="text-neutral-400 mb-8">
                Have a GPU sitting idle? Connect it to the Synapse network and earn SYN tokens 
                for every inference job your hardware processes. Two commands to get started.
              </p>
              
              {/* Terminal */}
              <div className="bg-[#0d0d0d] border border-white/[0.1] rounded-lg overflow-hidden mb-8">
                <div className="bg-white/[0.03] px-4 py-2 border-b border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs text-neutral-500">quickstart.sh</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-700"></div>
                  </div>
                </div>
                <div className="p-4 text-sm space-y-3 font-mono">
                  <div>
                    <p className="text-neutral-600 mb-1.5"># Install Docker</p>
                    <div 
                      className="flex justify-between items-center bg-black/50 border border-white/[0.05] rounded px-3 py-2 cursor-pointer hover:border-emerald-500/30 transition-colors"
                      onClick={() => copyToClipboard('curl -fsSL https://get.docker.com | sh', 'docker')}
                    >
                      <code className="text-emerald-400 text-xs">curl -fsSL https://get.docker.com | sh</code>
                      {copiedCommand === 'docker' ? (
                        <span className="text-emerald-400 text-xs">COPIED</span>
                      ) : (
                        <Copy className="w-3 h-3 text-neutral-600" />
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-neutral-600 mb-1.5"># Run node</p>
                    <div 
                      className="flex justify-between items-center bg-black/50 border border-white/[0.05] rounded px-3 py-2 cursor-pointer hover:border-emerald-500/30 transition-colors"
                      onClick={() => copyToClipboard('docker run -d --gpus all -e WALLET=0x... synapse/node:latest', 'run')}
                    >
                      <code className="text-emerald-400 text-xs truncate mr-2">docker run -d --gpus all -e WALLET=0x... synapse/node</code>
                      {copiedCommand === 'run' ? (
                        <span className="text-emerald-400 text-xs flex-shrink-0">COPIED</span>
                      ) : (
                        <Copy className="w-3 h-3 text-neutral-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs">
                      <span className="text-emerald-500">$</span>
                      <span>Connected to mesh</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs">
                      <span className="text-emerald-500">$</span>
                      <span>Earning HSK tokens</span>
                    </div>
                  </div>
                </div>
              </div>

              <Link 
                to="/docs/node-setup" 
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                View full setup guide
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {/* Earnings Card */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
              <div className="text-xs text-emerald-400 tracking-wider mb-6 uppercase">Estimated Earnings — RTX 4090</div>
              <div className="space-y-4">
                <div className="flex justify-between items-baseline border-b border-white/[0.06] pb-4">
                  <span className="text-sm text-neutral-400">Per day</span>
                  <span className="text-3xl font-bold">$28</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-white/[0.06] pb-4">
                  <span className="text-sm text-neutral-400">Per month</span>
                  <span className="text-3xl font-bold">$850</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-neutral-400">Per year</span>
                  <span className="text-3xl font-bold text-emerald-400">$10,200</span>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Network Stats</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +12.5%
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-lg font-semibold">12.5K</div>
                    <div className="text-xs text-neutral-500">Active Nodes</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-lg font-semibold">98.7%</div>
                    <div className="text-xs text-neutral-500">Uptime</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-lg font-semibold">24ms</div>
                    <div className="text-xs text-neutral-500">Avg Latency</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs text-emerald-400 tracking-wider mb-2 uppercase">Pricing</div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-neutral-400 max-w-xl mx-auto">
              Start free with 1 million tokens. Then pay only for what you use. No subscriptions, no minimums.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
            {/* Free Trial */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
              <div className="text-xs text-neutral-500 tracking-wider mb-1 uppercase">Free Trial</div>
              <div className="text-3xl font-bold mb-2">1M tokens</div>
              <p className="text-sm text-neutral-400 mb-6">
                No credit card required. Try the API risk-free with full access.
              </p>
              <ul className="space-y-3 text-sm">
                {['Full API access', 'All models included', 'No time limit', 'Community support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-neutral-300">
                    <Check className="w-4 h-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pay Per Use */}
            <div className="bg-white/[0.03] border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-black text-xs font-medium px-3 py-1 rounded-bl-lg">
                Popular
              </div>
              <div className="text-xs text-emerald-400 tracking-wider mb-1 uppercase">Pay Per Use</div>
              <div className="text-3xl font-bold mb-1">$0.0015<span className="text-lg text-neutral-400">/1K tokens</span></div>
              <p className="text-sm text-neutral-400 mb-6">
                After your free trial. Only pay for what you actually use.
              </p>
              <ul className="space-y-3 text-sm">
                {['Credit card or crypto', '90% cheaper than OpenAI', 'Usage-based billing', 'Priority support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-neutral-300">
                    <Check className="w-4 h-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 text-xs text-neutral-500 uppercase tracking-wider py-3 px-6 border-b border-white/[0.08]">
                <div>Provider</div>
                <div className="text-right">Per 1K tokens</div>
                <div className="text-right">vs Synapse</div>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {pricingComparison.map((item, i) => (
                  <div 
                    key={i} 
                    className={`grid grid-cols-3 py-4 px-6 ${item.highlight ? 'bg-emerald-500/5' : ''}`}
                  >
                    <div className={item.highlight ? 'text-white font-medium' : 'text-neutral-300'}>
                      {item.provider}
                    </div>
                    <div className={`text-right ${item.highlight ? 'text-emerald-400' : 'text-neutral-400'}`}>
                      {item.price}
                    </div>
                    <div className={`text-right ${item.highlight ? 'text-emerald-400' : 'text-neutral-500'}`}>
                      {item.multiplier}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs text-emerald-400 tracking-wider mb-2 uppercase">For Developers</div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-6">
                OpenAI-Compatible API
              </h2>
              <p className="text-neutral-400 mb-6">
                Drop-in replacement for OpenAI's API. Just change the base URL and API key. 
                All your existing code works without modification.
              </p>
              <ul className="space-y-4">
                {[
                  'Drop-in OpenAI API replacement',
                  'Support for streaming responses',
                  'Function calling and tools',
                  'Multi-modal capabilities',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-neutral-300">
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link 
                to="/docs/api" 
                className="inline-flex items-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-emerald-400 transition-colors mt-8"
              >
                View API Docs
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="bg-[#0d0d0d] border border-white/[0.1] rounded-xl overflow-hidden">
              <div className="bg-white/[0.03] px-4 py-2 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs text-neutral-500">example.py</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="text-sm font-mono">
                  <code className="text-neutral-300" dangerouslySetInnerHTML={{
                    __html: `<span class="text-purple-400">import</span> <span class="text-neutral-300">openai</span>

<span class="text-neutral-500"># Just change the base URL</span>
<span class="text-neutral-300">client</span> <span class="text-purple-400">=</span> <span class="text-neutral-300">openai.OpenAI(</span>
  <span class="text-green-400">base_url</span><span class="text-purple-400">=</span><span class="text-yellow-300">"https://api.synapse.network/v1"</span><span class="text-neutral-300">,</span>
  <span class="text-green-400">api_key</span><span class="text-purple-400">=</span><span class="text-yellow-300">"syn_xxx"</span>
<span class="text-neutral-300">)</span>

<span class="text-neutral-500"># Use exactly like OpenAI</span>
<span class="text-neutral-300">response</span> <span class="text-purple-400">=</span> <span class="text-neutral-300">client.chat.completions.create(</span>
  <span class="text-green-400">model</span><span class="text-purple-400">=</span><span class="text-yellow-300">"llama-3-70b"</span><span class="text-neutral-300">,</span>
  <span class="text-green-400">messages</span><span class="text-purple-400">=</span><span class="text-neutral-300">[{"role": "user", "content": "Hello!"}]</span>
<span class="text-neutral-300">)</span>

<span class="text-purple-400">print</span><span class="text-neutral-300">(response.choices[0].message.content)</span>`
                  }} />
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-12 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-neutral-400 mb-8 max-w-lg mx-auto">
                Join thousands of developers and node operators building the future of decentralized AI.
                Start with 1 million free tokens.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isConnected ? (
                  <Link 
                    to="/dashboard" 
                    className="bg-emerald-500 text-black px-8 py-3 rounded-lg font-medium hover:bg-emerald-400 transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <WalletConnect />
                )}
                <Link 
                  to="/docs/quickstart" 
                  className="bg-white/[0.05] border border-white/[0.15] text-white px-8 py-3 rounded-lg font-medium hover:bg-white/[0.08] transition-colors"
                >
                  Read Quick Start
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
