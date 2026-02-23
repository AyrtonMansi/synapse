import { useState } from 'react';
import { 
  Terminal, Search, BookOpen, Code, Cpu, Zap, ChevronRight, 
  FileText, Layers, ExternalLink, Command, Hash 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const docSections = [
  {
    title: 'Getting Started',
    icon: Zap,
    command: 'synapse init',
    items: [
      { title: 'Introduction', href: '#intro', description: 'Learn about Synapse Protocol' },
      { title: 'Quick Start', href: '/docs/quickstart', description: 'Get up and running in 5 minutes' },
      { title: 'Authentication', href: '#auth', description: 'API keys and authentication' },
    ],
  },
  {
    title: 'API Reference',
    icon: Code,
    command: 'synapse api',
    items: [
      { title: 'Chat Completions', href: '/docs/api', description: 'Generate text responses' },
      { title: 'Embeddings', href: '/docs/api#embeddings', description: 'Generate vector embeddings' },
      { title: 'Models', href: '/docs/api#models', description: 'Available AI models' },
      { title: 'Error Handling', href: '/docs/api#errors', description: 'Error codes and handling' },
    ],
  },
  {
    title: 'SDKs',
    icon: Layers,
    command: 'synapse sdk',
    items: [
      { title: 'JavaScript/TypeScript', href: '/docs/sdk', description: 'Node.js and browser SDK' },
      { title: 'Python', href: '/docs/sdk#python', description: 'Python SDK' },
      { title: 'Go', href: '/docs/sdk#go', description: 'Go SDK' },
    ],
  },
  {
    title: 'Node Operators',
    icon: Cpu,
    command: 'synapse node',
    items: [
      { title: 'Hardware Requirements', href: '/docs/node-setup', description: 'GPU and system requirements' },
      { title: 'Installation', href: '/docs/node-setup#install', description: 'Set up your node' },
      { title: 'Configuration', href: '/docs/node-setup#config', description: 'Advanced configuration' },
    ],
  },
];

const quickLinks = [
  { title: 'API Status', href: 'https://status.synapse.network', description: 'Check API availability' },
  { title: 'GitHub', href: 'https://github.com/synapse', description: 'Open source repositories' },
  { title: 'Discord', href: 'https://discord.gg/synapse', description: 'Community support' },
];

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div 
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-terminal-accent/10 border border-terminal-accent/20 rounded-full text-terminal-accent text-sm font-mono mb-6">
          <BookOpen className="w-4 h-4" />
          <span>docs.synapse.network</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          <span className="text-terminal-accent">$</span> Documentation
        </h1>
        <p className="text-terminal-dim max-w-2xl mx-auto">
          Everything you need to build with Synapse Protocol. Learn how to access decentralized AI compute, 
          run a node, or integrate our API.
        </p>
      </motion.div>

      {/* Search */}
      <div className="max-w-2xl mx-auto mb-12">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-terminal-muted" />
          <input
            type="text"
            placeholder="$ search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-terminal-surface border border-terminal-border rounded-xl pl-12 pr-4 py-4 text-terminal-text placeholder-terminal-muted focus:outline-none focus:border-terminal-accent/50 font-mono"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {quickLinks.map((link, i) => (
          <motion.a
            key={link.title}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="terminal-card p-4 flex items-center gap-4 group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold group-hover:text-terminal-accent transition-colors">{link.title}</h3>
                <ExternalLink className="w-3 h-3 text-terminal-muted" />
              </div>
              <p className="text-sm text-terminal-dim">{link.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-terminal-muted group-hover:text-terminal-accent transition-colors" />
          </motion.a>
        ))}
      </div>

      {/* Doc Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {docSections.map((section, sectionIndex) => (
          <motion.div 
            key={section.title} 
            className="terminal-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 + 0.3 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-terminal-accent/10 rounded-lg flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-terminal-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                  <p className="text-xs font-mono text-terminal-accent">$ {section.command}</p>
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {section.items.map((item, itemIndex) => (
                <motion.li 
                  key={item.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: sectionIndex * 0.1 + itemIndex * 0.05 + 0.4 }}
                >
                  <Link
                    to={item.href}
                    className="flex items-start gap-3 p-3 rounded-lg text-terminal-dim hover:text-terminal-text hover:bg-terminal-elevated transition-colors group border border-transparent hover:border-terminal-border"
                  >
                    <Hash className="w-4 h-4 mt-0.5 text-terminal-muted group-hover:text-terminal-accent transition-colors" />
                    <div className="flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-terminal-muted">{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-terminal-muted group-hover:text-terminal-accent transition-colors" />
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Help Section */}
      <motion.div 
        className="mt-12 terminal-card p-8 border-terminal-accent/30 bg-terminal-accent/5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Command className="w-5 h-5 text-terminal-accent" />
              <h2 className="text-2xl font-semibold">Need Help?</h2>
            </div>
            <p className="text-terminal-dim">
              Can't find what you're looking for? Join our community for support from the team and other developers.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a 
              href="https://discord.gg/synapse" 
              target="_blank" 
              rel="noopener noreferrer"
              className="terminal-btn-primary"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono">$</span> Join Discord
              </span>
            </a>
            <a 
              href="https://github.com/synapse/discussions" 
              target="_blank" 
              rel="noopener noreferrer"
              className="terminal-btn-secondary"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono">#</span> GitHub Discussions
              </span>
            </a>
          </div>
        </div>
      </motion.div>

      {/* Code Example */}
      <motion.div 
        className="mt-12 terminal-window"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div className="terminal-window-header">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-terminal-accent" />
            <span className="font-mono text-sm text-terminal-dim">example.js</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-amber/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-accent/50" />
          </div>
        </div>
        <div className="terminal-window-body">
          <pre className="text-sm">
            <code>
              <span className="text-terminal-dim">// Initialize Synapse client</span>
              {'\n'}
              <span className="text-terminal-cyan">import</span> {'{ SynapseClient }'} <span className="text-terminal-cyan">from</span> <span className="text-terminal-accent">'@synapse/sdk'</span>
              {'\n\n'}
              <span className="text-terminal-dim">// Create client with your API key</span>
              {'\n'}
              <span className="text-terminal-purple">const</span> client = <span className="text-terminal-cyan">new</span> <span className="text-terminal-text">SynapseClient</span>({'{'}
              {'\n  '}apiKey: <span className="text-terminal-accent">'syn_prod_...'</span>,
              {'\n}'}
              {'\n\n'}
              <span className="text-terminal-dim">// Generate text completion</span>
              {'\n'}
              <span className="text-terminal-purple">const</span> response = <span className="text-terminal-cyan">await</span> client.chat.completions.create({'{'}
              {'\n  '}model: <span className="text-terminal-accent">'llama-3-70b'</span>,
              {'\n  '}messages: [{'{ '}role: <span className="text-terminal-accent">'user'</span>, content: <span className="text-terminal-accent">'Hello!'</span>{' }'}],
              {'\n}'}
              {'\n\n'}
              <span className="text-terminal-accent">$</span> <span className="text-terminal-text">console</span>.log(response.choices[0].message.content)
            </code>
          </pre>
        </div>
      </motion.div>
    </div>
  );
}
