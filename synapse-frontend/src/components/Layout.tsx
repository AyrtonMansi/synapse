import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Terminal, Server, Vote, BookOpen, Github, Twitter, MessageCircle,
  Menu, X, Zap, CreditCard, ChevronDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { WalletConnect } from './WalletConnect';
import { Helmet } from './Helmet';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Home', icon: Zap },
  { path: '/pricing', label: 'Pricing', icon: CreditCard },
  { path: '/nodes', label: 'Nodes', icon: Server, protected: true },
  { path: '/governance', label: 'Governance', icon: Vote },
  { path: '/docs', label: 'Docs', icon: BookOpen },
];

const docsDropdown = [
  { path: '/docs', label: 'Overview' },
  { path: '/docs/quickstart', label: 'Quick Start' },
  { path: '/docs/api', label: 'API Reference' },
  { path: '/docs/sdk', label: 'SDK' },
  { path: '/docs/node-setup', label: 'Node Setup' },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDocsOpen(false);
  }, [location.pathname]);

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.protected && !isConnected) {
      navigate('/', { state: { connectWallet: true } });
      return;
    }
    navigate(item.path);
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-sans">
      <Helmet pathname={location.pathname} />
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-terminal-bg via-transparent to-terminal-bg" />
      </div>
      
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-terminal-bg/95 backdrop-blur-xl border-b border-terminal-border' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-terminal-accent/10 border border-terminal-accent/50 rounded flex items-center justify-center group-hover:bg-terminal-accent/20 transition-colors">
                <Terminal className="w-4 h-4 text-terminal-accent" />
              </div>
              <span className="font-mono font-semibold text-sm tracking-wider">
                <span className="text-terminal-accent">&gt;</span> SYNAPSE
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                    isActive(item.path)
                      ? 'text-terminal-accent'
                      : 'text-terminal-dim hover:text-terminal-text'
                  }`}
                >
                  <span className={isActive(item.path) ? 'text-terminal-accent' : 'text-terminal-dim'}>
                    {isActive(item.path) ? '$' : '#'}
                  </span>
                  {item.label}
                </button>
              ))}
              
              {/* Docs Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDocsOpen(!docsOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                    isActive('/docs') ? 'text-terminal-accent' : 'text-terminal-dim hover:text-terminal-text'
                  }`}
                >
                  <span className={isActive('/docs') ? 'text-terminal-accent' : 'text-terminal-dim'}>
                    {isActive('/docs') ? '$' : '#'}
                  </span>
                  Docs
                  <ChevronDown className={`w-3 h-3 transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {docsOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 mt-2 w-48 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl overflow-hidden"
                    >
                      {docsDropdown.map(doc => (
                        <Link
                          key={doc.path}
                          to={doc.path}
                          className={`block px-4 py-2 text-sm font-mono hover:bg-terminal-elevated transition-colors ${
                            location.pathname === doc.path ? 'text-terminal-accent' : 'text-terminal-dim'
                          }`}
                        >
                          {location.pathname === doc.path ? '$ ' : '# '}{doc.label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <a 
                href="https://github.com/synapse" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-terminal-dim hover:text-terminal-accent transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <WalletConnect />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-terminal-dim hover:text-terminal-text"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-terminal-border bg-terminal-bg/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2">
                {navItems.map(item => (
                  <button
                    key={item.path}
                    onClick={() => handleNavClick(item)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono ${
                      isActive(item.path)
                        ? 'text-terminal-accent bg-terminal-accent/10'
                        : 'text-terminal-dim hover:bg-terminal-elevated'
                    }`}
                  >
                    <span>{isActive(item.path) ? '$' : '#'}</span>
                    {item.label}
                  </button>
                ))}
                
                <div className="border-t border-terminal-border pt-4 mt-4">
                  <p className="px-4 text-xs font-mono text-terminal-muted uppercase tracking-wider mb-2">Documentation</p>
                  {docsDropdown.map(doc => (
                    <Link
                      key={doc.path}
                      to={doc.path}
                      className="flex items-center gap-3 px-4 py-2 text-sm font-mono text-terminal-dim hover:text-terminal-text"
                    >
                      <span>#</span>{doc.label}
                    </Link>
                  ))}
                </div>
                
                <div className="border-t border-terminal-border pt-4 mt-4">
                  <WalletConnect />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="pt-16 relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-terminal-border mt-20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-terminal-accent/10 border border-terminal-accent/50 rounded flex items-center justify-center">
                  <Terminal className="w-3 h-3 text-terminal-accent" />
                </div>
                <span className="font-mono font-semibold text-sm tracking-wider">
                  <span className="text-terminal-accent">&gt;</span> SYNAPSE
                </span>
              </div>
              <p className="text-terminal-dim text-sm max-w-xs">
                Decentralized AI compute marketplace. Access distributed GPU power or earn rewards by contributing hardware.
              </p>
            </div>
            
            <div>
              <h4 className="font-mono text-xs text-terminal-muted uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-terminal-dim">
                <li><Link to="/pricing" className="hover:text-terminal-accent transition-colors">Pricing</Link></li>
                <li><Link to="/nodes" className="hover:text-terminal-accent transition-colors">Node Operators</Link></li>
                <li><Link to="/governance" className="hover:text-terminal-accent transition-colors">Governance</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-mono text-xs text-terminal-muted uppercase tracking-wider mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-terminal-dim">
                <li><Link to="/docs" className="hover:text-terminal-accent transition-colors">Documentation</Link></li>
                <li><Link to="/docs/api" className="hover:text-terminal-accent transition-colors">API Reference</Link></li>
                <li><Link to="/docs/sdk" className="hover:text-terminal-accent transition-colors">SDK</Link></li>
                <li><Link to="/docs/node-setup" className="hover:text-terminal-accent transition-colors">Node Setup</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-mono text-xs text-terminal-muted uppercase tracking-wider mb-4">Community</h4>
              <div className="flex gap-4">
                <a href="https://github.com/synapse" target="_blank" rel="noopener noreferrer" className="text-terminal-dim hover:text-terminal-accent transition-colors">
                  <Github className="w-5 h-5" />
                </a>
                <a href="https://twitter.com/synapse" target="_blank" rel="noopener noreferrer" className="text-terminal-dim hover:text-terminal-accent transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="https://discord.gg/synapse" target="_blank" rel="noopener noreferrer" className="text-terminal-dim hover:text-terminal-accent transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-terminal-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-mono text-terminal-muted">
              <span className="text-terminal-accent">&gt;</span> © 2026 Synapse Protocol
            </p>
            <div className="flex gap-6 text-xs font-mono text-terminal-muted">
              <a href="#" className="hover:text-terminal-text transition-colors">Privacy</a>
              <a href="#" className="hover:text-terminal-text transition-colors">Terms</a>
              <a href="#" className="hover:text-terminal-text transition-colors">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
