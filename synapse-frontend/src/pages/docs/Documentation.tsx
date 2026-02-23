import { useState } from 'react';
import { 
  Book, Play, AlertCircle, HelpCircle, MessageCircle, Video, 
  FileText, ChevronRight, ExternalLink, Search, CheckCircle,
  Cpu, Wifi, Wallet, Server, RefreshCw
} from 'lucide-react';

const VIDEO_TUTORIALS = [
  {
    id: 1,
    title: 'Getting Started with Synapse Mining',
    duration: '5:32',
    thumbnail: '🎬',
    description: 'Learn the basics of setting up your first Synapse node',
    level: 'Beginner'
  },
  {
    id: 2,
    title: 'GPU Setup & Optimization',
    duration: '8:45',
    thumbnail: '🎮',
    description: 'Configure NVIDIA and AMD GPUs for maximum earnings',
    level: 'Intermediate'
  },
  {
    id: 3,
    title: 'Advanced Staking Strategies',
    duration: '12:20',
    thumbnail: '📊',
    description: 'Maximize your returns with optimal staking amounts',
    level: 'Advanced'
  },
  {
    id: 4,
    title: 'Troubleshooting Common Issues',
    duration: '6:15',
    thumbnail: '🔧',
    description: 'Fix the most common node setup and runtime issues',
    level: 'All Levels'
  },
  {
    id: 5,
    title: 'Mobile Monitoring Setup',
    duration: '3:48',
    thumbnail: '📱',
    description: 'Monitor your node from anywhere with our mobile app',
    level: 'Beginner'
  },
  {
    id: 6,
    title: 'Docker Deployment Guide',
    duration: '7:22',
    thumbnail: '🐳',
    description: 'Deploy multiple nodes using Docker Compose',
    level: 'Intermediate'
  }
];

const TROUBLESHOOTING_GUIDES = [
  {
    category: 'Installation Issues',
    icon: Server,
    issues: [
      {
        title: 'Docker installation fails',
        solution: 'Ensure your system meets the minimum requirements. Run: curl -fsSL https://get.docker.com | bash',
        steps: ['Check OS compatibility', 'Verify internet connection', 'Run with sudo privileges']
      },
      {
        title: 'GPU not detected',
        solution: 'Install NVIDIA drivers and container toolkit for GPU support.',
        steps: ['Install NVIDIA drivers (470+)', 'Install nvidia-container-toolkit', 'Restart Docker service']
      },
      {
        title: 'Permission denied errors',
        solution: 'Add your user to the docker group and log out/back in.',
        steps: ['sudo usermod -aG docker $USER', 'newgrp docker', 'Verify with: docker run hello-world']
      }
    ]
  },
  {
    category: 'Connection Issues',
    icon: Wifi,
    issues: [
      {
        title: 'Node cannot connect to network',
        solution: 'Check firewall settings and ensure ports 8080, 9090, 30303 are open.',
        steps: ['ufw allow 8080,9090,30303/tcp', 'Check router port forwarding', 'Verify internet connectivity']
      },
      {
        title: 'Wallet connection timeout',
        solution: 'Ensure you have a stable internet connection and try again.',
        steps: ['Check MetaMask connection', 'Switch to a different RPC endpoint', 'Clear browser cache']
      }
    ]
  },
  {
    category: 'Performance Issues',
    icon: Cpu,
    issues: [
      {
        title: 'Low GPU utilization',
        solution: 'Adjust power limits and check thermal throttling.',
        steps: ['nvidia-smi -pl 350 (set power limit)', 'Check GPU temperature', 'Verify model compatibility']
      },
      {
        title: 'High memory usage',
        solution: 'Reduce batch size or upgrade system RAM.',
        steps: ['Monitor with: htop or nvtop', 'Close unnecessary applications', 'Consider adding swap space']
      }
    ]
  },
  {
    category: 'Wallet & Earnings',
    icon: Wallet,
    issues: [
      {
        title: 'Rewards not showing',
        solution: 'Wait for the next payout cycle (every 24 hours).',
        steps: ['Check pending rewards in dashboard', 'Verify wallet address is correct', 'Ensure minimum stake is met']
      },
      {
        title: 'Cannot claim rewards',
        solution: 'Ensure you have enough ETH for gas fees.',
        steps: ['Check wallet balance', 'Switch to a faster RPC', 'Wait for lower network congestion']
      }
    ]
  }
];

const FAQS = [
  {
    question: 'What are the minimum hardware requirements?',
    answer: 'Minimum: 8GB VRAM GPU (GTX 1080), 16GB RAM, 100GB SSD. Recommended: 24GB VRAM (RTX 3090/4090), 32GB RAM, NVMe SSD for optimal performance.'
  },
  {
    question: 'How much can I earn per month?',
    answer: 'Earnings vary based on GPU model, network demand, and stake amount. Entry-level GPUs (8GB) earn ~$50-100/mo, while high-end GPUs (80GB) can earn $5000-10000/mo.'
  },
  {
    question: 'When do I receive my rewards?',
    answer: 'Rewards are calculated continuously and distributed every 24 hours. You can claim them anytime through the dashboard.'
  },
  {
    question: 'Is there a lockup period for staking?',
    answer: 'Yes, there is a 7-day unstaking period to maintain network stability. During this time, your stake continues to earn rewards.'
  },
  {
    question: 'Can I run multiple nodes?',
    answer: 'Yes! You can run multiple nodes on different machines or use Docker to run multiple instances on a single machine with multiple GPUs.'
  },
  {
    question: 'What happens if my node goes offline?',
    answer: 'Your node stops earning during downtime. Extended downtime (>24h) may result in a small penalty to encourage reliability.'
  }
];

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('videos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Documentation & Support</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Everything you need to know about running a Synapse node. 
            From setup guides to troubleshooting, find answers here.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl mb-8 overflow-x-auto">
          {[
            { id: 'videos', label: 'Video Tutorials', icon: Video },
            { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
            { id: 'faq', label: 'FAQ', icon: HelpCircle },
            { id: 'community', label: 'Community', icon: MessageCircle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Video Tutorials */}
          {activeTab === 'videos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {VIDEO_TUTORIALS.map(video => (
                <div key={video.id} className="glass-card p-4 card-hover cursor-pointer group">
                  <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center text-4xl mb-4 relative overflow-hidden">
                    {video.thumbnail}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs">
                      {video.duration}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      video.level === 'Beginner' ? 'bg-emerald-500/20 text-emerald-400' :
                      video.level === 'Intermediate' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {video.level}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1">{video.title}</h3>
                  <p className="text-sm text-slate-400">{video.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Troubleshooting */}
          {activeTab === 'troubleshooting' && (
            <div className="space-y-6">
              {TROUBLESHOOTING_GUIDES.map((category, idx) => (
                <div key={idx} className="glass-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                      <category.icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-semibold">{category.category}</h3>
                  </div>
                  <div className="space-y-3">
                    {category.issues.map((issue, i) => (
                      <div key={i} className="border border-slate-700/50 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedIssue(expandedIssue === `${idx}-${i}` ? null : `${idx}-${i}`)}
                          className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition-colors"
                        >
                          <span className="font-medium">{issue.title}</span>
                          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${
                            expandedIssue === `${idx}-${i}` ? 'rotate-90' : ''
                          }`} />
                        </button>
                        {expandedIssue === `${idx}-${i}` && (
                          <div className="px-4 pb-4">
                            <p className="text-slate-400 mb-3">{issue.solution}</p>
                            <div className="space-y-2">
                              {issue.steps.map((step, si) => (
                                <div key={si} className="flex items-start gap-3">
                                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                  <code className="text-sm bg-slate-900 px-2 py-1 rounded font-mono text-cyan-400">
                                    {step}
                                  </code>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FAQ */}
          {activeTab === 'faq' && (
            <div className="glass-card p-6">
              <div className="space-y-4">
                {FAQS.map((faq, idx) => (
                  <div key={idx} className="border-b border-slate-800 last:border-0 pb-4 last:pb-0">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      className="w-full flex items-start justify-between gap-4 text-left"
                    >
                      <span className="font-medium">{faq.question}</span>
                      <ChevronRight className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
                        expandedFaq === idx ? 'rotate-90' : ''
                      }`} />
                    </button>
                    {expandedFaq === idx && (
                      <p className="mt-3 text-slate-400">{faq.answer}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Community */}
          {activeTab === 'community' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  name: 'Discord',
                  description: 'Join 50,000+ miners discussing strategies and getting support',
                  members: '50K+',
                  icon: '💬',
                  color: 'bg-indigo-500/20 text-indigo-400',
                  link: 'https://discord.gg/synapse'
                },
                {
                  name: 'Telegram',
                  description: 'Real-time updates and announcements from the Synapse team',
                  members: '25K+',
                  icon: '📱',
                  color: 'bg-cyan-500/20 text-cyan-400',
                  link: 'https://t.me/synapse_network'
                },
                {
                  name: 'GitHub',
                  description: 'Open source code, issues, and feature requests',
                  members: '2K+',
                  icon: '💻',
                  color: 'bg-slate-500/20 text-slate-400',
                  link: 'https://github.com/synapse-network'
                },
                {
                  name: 'Twitter/X',
                  description: 'Latest news, updates, and community highlights',
                  members: '100K+',
                  icon: '🐦',
                  color: 'bg-blue-500/20 text-blue-400',
                  link: 'https://twitter.com/synapse_network'
                },
                {
                  name: 'Reddit',
                  description: 'Discussion forum for node operators and miners',
                  members: '15K+',
                  icon: '🤖',
                  color: 'bg-orange-500/20 text-orange-400',
                  link: 'https://reddit.com/r/synapse_network'
                },
                {
                  name: 'YouTube',
                  description: 'Video tutorials, AMAs, and community showcases',
                  members: '10K+',
                  icon: '📺',
                  color: 'bg-red-500/20 text-red-400',
                  link: 'https://youtube.com/synapse_network'
                }
              ].map((community, idx) => (
                <a
                  key={idx}
                  href={community.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card p-6 card-hover group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{community.icon}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${community.color}`}>
                      {community.members} members
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    {community.name}
                    <ExternalLink className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-sm text-slate-400">{community.description}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Contact Support */}
        <div className="mt-12 glass-card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Still need help?</h2>
          <p className="text-slate-400 mb-6">
            Our support team is available 24/7 to assist you with any issues.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="mailto:support@synapse.network" className="btn-primary">
              Email Support
            </a>
            <a href="https://discord.gg/synapse" className="btn-secondary">
              Live Chat
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
