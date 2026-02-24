import { 
  MessageSquare, 
  Key, 
  BarChart3, 
  BookOpen, 
  Settings,
  Shield,
  Zap,
  Network,
  History,
  Cpu
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  isAdmin?: boolean;
}

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}

const mainNavItems: NavItem[] = [
  { path: '/gateway/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/gateway/sessions', icon: History, label: 'Sessions' },
];

const configNavItems: NavItem[] = [
  { path: '/gateway/keys', icon: Key, label: 'API Keys' },
  { path: '/gateway/usage', icon: BarChart3, label: 'Usage' },
  { path: '/gateway/nodes', icon: Network, label: 'Nodes' },
  { path: '/gateway/run-node', icon: Cpu, label: 'Run a Node' },
];

const bottomNavItems: NavItem[] = [
  { path: '/docs', icon: BookOpen, label: 'Docs', external: true },
  { path: '/gateway/settings', icon: Settings, label: 'Settings' },
];

function NavItemLink({ item }: { item: NavItem }) {
  if (item.external) {
    return (
      <a
        href={item.path}
        className="sidebar-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        <item.icon size={18} />
        <span>{item.label}</span>
      </a>
    );
  }
  
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => 
        `sidebar-link ${isActive ? 'active' : ''}`
      }
    >
      <item.icon size={18} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function Sidebar({ isAdmin }: SidebarProps) {
  return (
    <aside className="w-64 bg-charcoal-900 border-r border-charcoal-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-charcoal-800">
        <NavLink to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-synapse-600 rounded-lg flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-semibold text-charcoal-100">Synapse</span>
        </NavLink>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
        {/* Main */}
        <div className="space-y-1">
          <div className="px-3 text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-2">
            Main
          </div>
          {mainNavItems.map((item) => (
            <NavItemLink key={item.path} item={item} />
          ))}
        </div>

        {/* Configuration */}
        <div className="space-y-1">
          <div className="px-3 text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-2">
            Configuration
          </div>
          {configNavItems.map((item) => (
            <NavItemLink key={item.path} item={item} />
          ))}
        </div>
        
        {isAdmin && (
          <div className="space-y-1">
            <div className="px-3 text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-2">
              Admin
            </div>
            <NavLink
              to="/gateway/admin"
              className={({ isActive }) => 
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Shield size={18} />
              <span>Admin</span>
            </NavLink>
          </div>
        )}
      </nav>
      
      {/* Bottom */}
      <div className="p-3 border-t border-charcoal-800 space-y-1">
        {bottomNavItems.map((item) => (
          <NavItemLink key={item.path} item={item} />
        ))}
      </div>
    </aside>
  );
}
