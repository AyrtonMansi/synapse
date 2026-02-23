'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, 
  Copy, 
  Check, 
  Server, 
  Zap, 
  Cpu, 
  Globe,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [typedText, setTypedText] = useState('');
  const fullText = 'synapse init --connect';

  useEffect(() => {
    setMounted(true);
    let i = 0;
    const typing = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(typing);
      }
    }, 80);
    return () => clearInterval(typing);
  }, []);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-sans selection:bg-terminal-accent/30">
      {/* Animated Grid Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-terminal-bg via-transparent to-terminal-bg" />
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 w-full bg-terminal-bg/80 backdrop-blur-md border-b border-terminal-border z-50"
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-8 h-8 bg-terminal-accent/10 border border-terminal-accent/50 rounded flex items-center justify-center">
                <Terminal className="w-4 h-4 text-terminal-accent" />
              </div>
              <span className="font-mono font-semibold text-sm tracking-wider">
                <span className="text-terminal-accent">&gt;</span> SYNAPSE
              </span>
            </motion.div>
            
            <div className="hidden md:flex items-center gap-8 text-xs font-mono">
              {['PRICING', 'MINING', 'DOCS'].map((item) => (
                <motion.a 
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-terminal-dim hover:text-terminal-accent transition-colors relative group"
                  whileHover={{ y: -1 }}
                >
                  <span className="text-terminal-accent opacity-0 group-hover:opacity-100 transition-opacity">_</span>
                  {item}
                </motion.a>
              ))}
              <motion.button 
                className="bg-terminal-accent/10 border border-terminal-accent/50 text-terminal-accent px-4 py-2 rounded font-mono text-xs hover:bg-terminal-accent/20 transition-all hover:shadow-terminal-glow-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                GET_API_KEY()
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Terminal Badge */}
            <motion.div 
              className="inline-flex items-center gap-2 bg-terminal-surface border border-terminal-border rounded-full px-4 py-1.5 mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="w-2 h-2 bg-terminal-accent rounded-full animate-pulse" />
              <span className="text-xs font-mono text-terminal-dim">Network Status: ONLINE</span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
              <span className="text-terminal-dim">Decentralized compute with</span>
              <br />
              <motion.span 
                className="text-terminal-accent text-glow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                much cheaper token rate limits
              </motion.span>
            </h1>

            {/* Network Label */}
            <p className="text-sm font-mono text-terminal-muted mb-10 tracking-widest">
              $ synapse --network mainnet
            </p>

            {/* Pricing Card */}
            <motion.div 
              className="bg-terminal-surface/50 border border-terminal-border rounded-xl p-8 max-w-md mx-auto mb-10 card-lift"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-terminal-accent" />
                <span className="text-xs font-mono text-terminal-accent tracking-wider">SYNAPSE PRICING</span>
              </div>
              <div className="text-5xl font-bold text-white mb-2">
                $0.0015
              </div>
              <div className="text-sm text-terminal-dim font-mono">
                per 1K tokens on DeepThink
              </div>
              <div className="mt-4 pt-4 border-t border-terminal-border">
                <div className="flex items-center justify-center gap-4 text-xs font-mono">
                  <span className="text-terminal-muted">
                    <span className="text-terminal-accent">&gt;</span> 90% cheaper
                  </span>
                  <span className="text-terminal-border">|</span>
                  <span className="text-terminal-muted">
                    <span className="text-terminal-accent">&gt;</span> No subscription
                  </span>
                </div>
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.button 
              className="group bg-terminal-accent text-terminal-bg px-8 py-4 rounded-lg font-semibold text-sm hover:bg-terminal-accentDim transition-all hover:shadow-terminal-glow mb-6"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono">$</span>
                Generate your API Key
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>

            {/* Benefits */}
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-6 text-xs font-mono text-terminal-dim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <span className="flex items-center gap-2">
                <Check className="w-3 h-3 text-terminal-accent" />
                Free 1M token trial
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-3 h-3 text-terminal-accent" />
                No credit card
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-3 h-3 text-terminal-accent" />
                Cancel anytime
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Quick Start - API Key */}
      <section className="py-20 px-6 border-t border-terminal-border">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs font-mono text-terminal-accent tracking-wider">QUICK_START</span>
            <h2 className="text-3xl font-bold mt-3 mb-4">Generate your API Key</h2>
            <p className="text-terminal-dim max-w-md mx-auto">
              Sign up and create your API key in seconds. No credit card required.
            </p>
          </motion.div>

          <motion.div 
            className="max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
              {/* Terminal Header */}
              <div className="bg-terminal-elevated border-b border-terminal-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-terminal-red/50" />
                  <div className="w-3 h-3 rounded-full bg-terminal-amber/50" />
                  <div className="w-3 h-3 rounded-full bg-terminal-accent/50" />
                </div>
                <span className="text-xs font-mono text-terminal-muted">setup.sh</span>
              </div>
              
              {/* Terminal Body */}
              <div className="p-6 font-mono text-sm">
                <div className="mb-4">
                  <span className="text-terminal-accent">$</span>
                  <span className="ml-2">{typedText}</span>
                  <span className="animate-cursor-blink text-terminal-accent">█</span>
                </div>
                
                <div className="bg-terminal-bg border border-terminal-border rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-terminal-accent/10 border border-terminal-accent/30 rounded-lg flex items-center justify-center">
                      <span className="text-terminal-accent font-bold">1</span>
                    </div>
                    <span className="text-sm">Initialize Connection</span>
                  </div>
                  <button className="w-full bg-terminal-accent text-terminal-bg py-3 rounded-lg font-semibold hover:bg-terminal-accentDim transition-colors">
                    GENERATE_API_KEY()
                  </button>
                </div>
                
                <p className="text-xs text-terminal-muted text-center">
                  <span className="text-terminal-accent">&gt;</span> 1 million tokens free. No credit card required.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mining Section */}
      <section id="mining" className="py-20 px-6 border-t border-terminal-border">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs font-mono text-terminal-accent tracking-wider">CONTRIBUTE</span>
            <h2 className="text-3xl font-bold mt-3 mb-4">Earn by contributions to the network</h2>
            <p className="text-terminal-dim max-w-lg mx-auto">
              Run a node on your GPU and earn HSK tokens. Two commands to start.
            </p>
          </motion.div>

          {/* Terminal Window */}
          <motion.div 
            className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden max-w-3xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            {/* Window Header */}
            <div className="bg-terminal-elevated border-b border-terminal-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-terminal-dim" />
                <span className="text-xs font-mono text-terminal-muted">quickstart.sh</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-terminal-amber/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-terminal-accent/50" />
              </div>
            </div>
            
            {/* Window Content */}
            <div className="p-6 font-mono text-sm space-y-4">
              {/* Command 1 */}
              <div>
                <p className="text-terminal-muted mb-2"># Install Docker</p>
                <motion.div 
                  className="flex justify-between items-center bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 cursor-pointer hover:border-terminal-accent/50 transition-all group"
                  onClick={() => copyToClipboard('curl -fsSL https://get.docker.com | sh', 'docker')}
                  whileHover={{ scale: 1.01 }}
                >
                  <code className="text-terminal-accent truncate mr-4">curl -fsSL https://get.docker.com | sh</code>
                  <span className="text-xs text-terminal-muted group-hover:text-terminal-accent transition-colors flex-shrink-0">
                    {copied === 'docker' ? (
                      <span className="flex items-center gap-1 text-terminal-accent">
                        <Check className="w-3 h-3" /> COPIED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="w-3 h-3" /> COPY
                      </span>
                    )}
                  </span>
                </motion.div>
              </div>

              {/* Command 2 */}
              <div>
                <p className="text-terminal-muted mb-2"># Run node</p>
                <motion.div 
                  className="flex justify-between items-center bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 cursor-pointer hover:border-terminal-accent/50 transition-all group"
                  onClick={() => copyToClipboard('docker run -d --gpus all -e WALLET=0x... synapse/node:latest', 'run')}
                  whileHover={{ scale: 1.01 }}
                >
                  <code className="text-terminal-accent truncate mr-4">docker run -d --gpus all -e WALLET=0x... synapse/node:latest</code>
                  <span className="text-xs text-terminal-muted group-hover:text-terminal-accent transition-colors flex-shrink-0">
                    {copied === 'run' ? (
                      <span className="flex items-center gap-1 text-terminal-accent">
                        <Check className="w-3 h-3" /> COPIED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="w-3 h-3" /> COPY
                      </span>
                    )}
                  </span>
                </motion.div>
              </div>

              {/* Output */}
              <div className="border-t border-terminal-border pt-4 space-y-2">
                <div className="flex items-center gap-2 text-terminal-accent">
                  <ChevronRight className="w-4 h-4" />
                  <span>Connected to mesh network</span>
                </div>
                <div className="flex items-center gap-2 text-terminal-accent">
                  <ChevronRight className="w-4 h-4" />
                  <span>Earning HSK tokens</span>
                </div>
                <div className="flex items-center gap-2 text-terminal-cyan">
                  <Sparkles className="w-4 h-4" />
                  <span>Node active. Rewards incoming...</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Steps + Earnings Grid */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Steps */}
            <div className="space-y-4">
              {[
                { num: '01', title: 'Install Docker', desc: 'One command setup on any Linux machine with NVIDIA GPU.' },
                { num: '02', title: 'Connect wallet', desc: 'Add your Ethereum address to receive HSK token payments.' },
                { num: '03', title: 'Start earning', desc: 'Your computer runs AI jobs automatically. Get paid daily.' },
              ].map((step, i) => (
                <motion.div 
                  key={step.num}
                  className="bg-terminal-surface/50 border border-terminal-border rounded-xl p-5 hover:border-terminal-accent/30 transition-all group"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-terminal-accent font-mono text-sm">{step.num}</span>
                    <div>
                      <h4 className="font-semibold mb-1 group-hover:text-terminal-accent transition-colors">{step.title}</h4>
                      <p className="text-sm text-terminal-dim">{step.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Earnings Card */}
            <motion.div 
              className="bg-terminal-surface/50 border border-terminal-border rounded-xl p-6"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Cpu className="w-4 h-4 text-terminal-accent" />
                <span className="text-xs font-mono text-terminal-accent tracking-wider">ESTIMATED_EARNINGS — RTX 4090</span>
              </div>
              
              <div className="space-y-4">
                {[
                  { label: 'Per day', value: '$28' },
                  { label: 'Per month', value: '$850' },
                  { label: 'Per year', value: '$10k', highlight: true },
                ].map((item, i) => (
                  <div 
                    key={item.label}
                    className={`flex justify-between items-baseline pb-3 ${i < 2 ? 'border-b border-terminal-border' : ''}`}
                  >
                    <span className="text-sm text-terminal-dim font-mono">{item.label}</span>
                    <span className={`text-2xl font-bold ${item.highlight ? 'text-terminal-accent text-glow' : ''}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 border-t border-terminal-border">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-xs font-mono text-terminal-accent tracking-wider">PRICING</span>
            <h2 className="text-3xl font-bold mt-3 mb-4">Simple pricing</h2>
            <p className="text-terminal-dim">Start free. Then pay only for what you use.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12">
            {/* Free Trial */}
            <motion.div 
              className="bg-terminal-surface/50 border border-terminal-border rounded-xl p-6 hover:border-terminal-accent/30 transition-all"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="text-xs font-mono text-terminal-muted tracking-wider mb-2">FREE_TRIAL</div>
              <div className="text-3xl font-bold mb-2">1M tokens</div>
              <p className="text-sm text-terminal-dim mb-6">
                No credit card required. Try the API risk-free.
              </p>
              <ul className="space-y-3 text-sm">
                {['Full API access', 'All models included', 'No time limit'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="text-terminal-accent">~</span>
                    <span className="text-terminal-dim">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Pay Per Use */}
            <motion.div 
              className="bg-terminal-surface/50 border border-terminal-accent/50 rounded-xl p-6 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-terminal-accent/5 rounded-full blur-3xl" />
              
              <div className="text-xs font-mono text-terminal-accent tracking-wider mb-2">PAY_PER_USE</div>
              <div className="text-3xl font-bold mb-2">
                $0.0015<span className="text-sm text-terminal-dim font-normal">/1K</span>
              </div>
              <p className="text-sm text-terminal-dim mb-6">
                After your free trial. No subscriptions, no minimums.
              </p>
              <ul className="space-y-3 text-sm">
                {['Credit card or crypto', '90% cheaper than OpenAI', 'Usage-based billing'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="text-terminal-accent">~</span>
                    <span className="text-terminal-dim">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Comparison Table */}
          <motion.div 
            className="max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-terminal-surface/50 border border-terminal-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 text-xs font-mono text-terminal-muted uppercase tracking-wider py-3 px-6 border-b border-terminal-border">
                <div>Provider</div>
                <div className="text-right">Per 1K</div>
                <div className="text-right">vs Synapse</div>
              </div>
              
              {[
                { name: 'OpenAI GPT-4', price: '$0.09', compare: '60× more' },
                { name: 'Anthropic Claude', price: '$0.09', compare: '60× more' },
                { name: 'Synapse', price: '$0.0015', compare: 'Best price', highlight: true },
              ].map((row) => (
                <div 
                  key={row.name}
                  className={`grid grid-cols-3 py-4 px-6 text-sm border-b border-terminal-border/50 last:border-0 ${row.highlight ? 'bg-terminal-accent/5' : ''}`}
                >
                  <div className={row.highlight ? 'text-white font-semibold' : 'text-terminal-text'}>
                    {row.name}
                  </div>
                  <div className={`text-right ${row.highlight ? 'text-terminal-accent font-semibold' : 'text-terminal-dim'}`}>
                    {row.price}
                  </div>
                  <div className={`text-right ${row.highlight ? 'text-terminal-accent' : 'text-terminal-muted'}`}>
                    {row.compare}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 border-t border-terminal-border">
        <div className="max-w-xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Globe className="w-12 h-12 text-terminal-accent mx-auto mb-6 opacity-50" />
            <h2 className="text-3xl font-bold mb-4">Start with 1M free tokens</h2>
            <p className="text-terminal-dim mb-8">
              No credit card required. Upgrade to paid when you're ready.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button 
                className="bg-terminal-accent text-terminal-bg px-8 py-3 rounded-lg font-semibold hover:bg-terminal-accentDim transition-all hover:shadow-terminal-glow"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="font-mono">$</span> START_FREE_TRIAL()
              </motion.button>
              <motion.button 
                className="bg-terminal-surface border border-terminal-border text-white px-8 py-3 rounded-lg font-semibold hover:border-terminal-accent/50 hover:bg-terminal-elevated transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="font-mono">$</span> START_MINING()
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-terminal-border py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-terminal-accent/10 border border-terminal-accent/50 rounded flex items-center justify-center">
                <Terminal className="w-4 h-4 text-terminal-accent" />
              </div>
              <span className="font-mono font-semibold text-sm tracking-wider">
                <span className="text-terminal-accent">&gt;</span> SYNAPSE
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-xs font-mono text-terminal-muted">
              {['Docs', 'GitHub', 'Discord', 'Status'].map((link) => (
                <motion.a 
                  key={link}
                  href="#" 
                  className="hover:text-terminal-accent transition-colors"
                  whileHover={{ y: -1 }}
                >
                  {link}
                </motion.a>
              ))}
            </div>
            
            <p className="text-xs font-mono text-terminal-muted">
              © 2026 <span className="text-terminal-accent">SYNAPSE</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
