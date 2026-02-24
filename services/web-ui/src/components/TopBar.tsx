import { Activity, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import type { Stats } from '../types';

interface TopBarProps {
  stats: Stats;
  wallet?: string | null;
  health?: 'online' | 'degraded' | 'offline';
}

export function TopBar({ stats, wallet, health = 'online' }: TopBarProps) {
  const healthConfig = {
    online: { icon: Wifi, dot: 'online', label: 'Network Online' },
    degraded: { icon: AlertCircle, dot: 'degraded', label: 'Network Degraded' },
    offline: { icon: WifiOff, dot: 'offline', label: 'Network Offline' },
  };
  
  const { icon: HealthIcon, dot, label } = healthConfig[health];
  
  const formatWallet = (w: string) => {
    if (w.includes('@')) return w;
    return `${w.slice(0, 6)}...${w.slice(-4)}`;
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="health-indicator">
          <span className={`health-dot ${dot}`} />
          <HealthIcon size={12} />
          <span>{label}</span>
        </div>
        
        <div className="health-indicator">
          <Activity size={12} />
          <span>{stats.nodes_online} nodes</span>
        </div>
        
        <div className="health-indicator">
          <span>{stats.jobs_today} jobs today</span>
        </div>
      </div>
      
      <div className="topbar-right">
        {wallet && (
          <span className="badge badge-primary">
            {formatWallet(wallet)}
          </span>
        )}
      </div>
    </header>
  );
}
