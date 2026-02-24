import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { OperatorBadge } from './OperatorBadge';
import { AchievementsPanel } from './Achievements';
import type { Stats, Achievement } from '../types';

interface GatewayLayoutProps {
  children: ReactNode;
  stats: Stats;
  wallet?: string | null;
  achievements?: {
    achievements: Achievement[];
    unlockedCount: number;
    totalCount: number;
  };
}

export function GatewayLayout({ children, stats, wallet, achievements }: GatewayLayoutProps) {
  const health = stats.nodes_online > 0 
    ? 'online' 
    : stats.nodes_online === 0 
      ? 'offline' 
      : 'degraded';

  return (
    <div className="page-container">
      <Sidebar />
      <div className="page-content" style={{ position: 'relative', zIndex: 1 }}>
        <TopBar stats={stats} wallet={wallet} health={health} />
        <main className="page-main">
          {children}
        </main>
      </div>
      
      {/* Right panel - Operator info */}
      {wallet && (
        <div 
          className="fixed right-6 top-[64px] w-[240px] space-y-4"
          style={{ zIndex: 10 }}
        >
          <OperatorBadge 
            wallet={wallet} 
            operatorNumber={Math.floor(Math.random() * 100) + 1}
            clearanceLevel="ALPHA"
          />
          
          {achievements && (
            <AchievementsPanel 
              achievements={achievements.achievements}
              unlockedCount={achievements.unlockedCount}
              totalCount={achievements.totalCount}
            />
          )}
        </div>
      )}
    </div>
  );
}
