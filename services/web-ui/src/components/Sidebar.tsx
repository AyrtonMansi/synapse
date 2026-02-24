import { 
  MessageSquare, 
  LayoutDashboard, 
  Server, 
  Activity, 
  BarChart3, 
  Wallet, 
  Settings, 
  BookOpen,
  Terminal
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  onNavigate?: () => void;
}

const navItems = [
  { section: 'Gateway', items: [
    { path: '/gateway/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/gateway/overview', icon: LayoutDashboard, label: 'Overview' },
    { path: '/gateway/nodes', icon: Server, label: 'Nodes' },
    { path: '/gateway/sessions', icon: Activity, label: 'Sessions' },
  ]},
  { section: 'Analytics', items: [
    { path: '/gateway/usage', icon: BarChart3, label: 'Usage' },
    { path: '/gateway/earnings', icon: Wallet, label: 'Earnings' },
  ]},
  { section: 'System', items: [
    { path: '/gateway/settings', icon: Settings, label: 'Settings' },
    { path: '/docs', icon: BookOpen, label: 'Docs' },
  ]},
];

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Terminal size={20} className="icon" />
          <span>Synapse</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map(({ section, items }) => (
          <div key={section} className="sidebar-section">
            <h3 className="sidebar-section-title">{section}</h3>
            {items.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => 
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
                onClick={onNavigate}
              >
                <Icon size={16} className="icon" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
