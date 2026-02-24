import { useState, useEffect } from 'react';
import { Award, X, Zap, Server, Coins, Clock } from 'lucide-react';
import type { Achievement } from '../types';

const defaultAchievements: Achievement[] = [
  {
    id: 'first-blood',
    title: 'First Blood',
    description: 'Made your first API call',
    icon: Zap,
    unlocked: false,
  },
  {
    id: 'node-runner',
    title: 'Node Runner',
    description: 'Started your first GPU node',
    icon: Server,
    unlocked: false,
  },
  {
    id: 'first-dollar',
    title: 'First Dollar',
    description: 'Earned your first HSK',
    icon: Coins,
    unlocked: false,
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Sub-100ms inference',
    icon: Clock,
    unlocked: false,
  },
  {
    id: 'mesh-pioneer',
    title: 'Mesh Pioneer',
    description: 'Operator #100 or earlier',
    icon: Award,
    unlocked: true,
    unlockedAt: new Date(),
  },
];

export function useAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    const stored = localStorage.getItem('synapse_achievements');
    if (stored) {
      return JSON.parse(stored);
    }
    return defaultAchievements;
  });

  const [recentUnlock, setRecentUnlock] = useState<Achievement | null>(null);

  useEffect(() => {
    localStorage.setItem('synapse_achievements', JSON.stringify(achievements));
  }, [achievements]);

  const unlock = (id: string) => {
    setAchievements(prev => {
      const achievement = prev.find(a => a.id === id);
      if (achievement && !achievement.unlocked) {
        const updated = prev.map(a => 
          a.id === id 
            ? { ...a, unlocked: true, unlockedAt: new Date() }
            : a
        );
        setRecentUnlock({ ...achievement, unlocked: true, unlockedAt: new Date() });
        return updated;
      }
      return prev;
    });
  };

  const dismissToast = () => setRecentUnlock(null);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  return { 
    achievements, 
    unlock, 
    recentUnlock, 
    dismissToast,
    unlockedCount,
    totalCount,
  };
}

export function AchievementToast({ 
  achievement, 
  onDismiss 
}: { 
  achievement: Achievement; 
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const Icon = achievement.icon;

  return (
    <div 
      className="fixed bottom-6 right-6 z-[300]"
      style={{
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <div className="bg-[#111] border border-[#00ff88]/30 rounded-xl p-4 shadow-2xl min-w-[300px]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg flex items-center justify-center">
            <Icon size={20} className="text-[#00ff88]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#00ff88] font-semibold uppercase tracking-wider">
                Achievement Unlocked
              </span>
            </div>
            <h4 className="font-semibold text-[#e0e0e0] mt-1">{achievement.title}</h4>
            <p className="text-xs text-[#666] mt-0.5">{achievement.description}</p>
          </div>
          <button 
            onClick={onDismiss}
            className="text-[#444] hover:text-[#888] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Progress line */}
        <div className="mt-3 h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#00ff88]"
            style={{
              animation: 'progress 5s linear forwards',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export function AchievementsPanel({ 
  achievements,
  unlockedCount,
  totalCount,
}: { 
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Achievements</h3>
        <span className="text-xs text-[#555]">
          {unlockedCount}/{totalCount}
        </span>
      </div>
      
      <div className="space-y-2">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <div 
              key={achievement.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                achievement.unlocked 
                  ? 'bg-[#00ff88]/5 border border-[#00ff88]/20' 
                  : 'bg-[#1a1a1a]/50 opacity-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                achievement.unlocked 
                  ? 'bg-[#00ff88]/10' 
                  : 'bg-[#222]'
              }`}>
                <Icon 
                  size={14} 
                  className={achievement.unlocked ? 'text-[#00ff88]' : 'text-[#444]'} 
                />
              </div>
              <div className="flex-1">
                <div className={`text-xs font-medium ${
                  achievement.unlocked ? 'text-[#e0e0e0]' : 'text-[#555]'
                }`}>
                  {achievement.title}
                </div>
                <div className="text-[10px] text-[#444]">
                  {achievement.description}
                </div>
              </div>
              {achievement.unlocked && (
                <span className="text-[10px] text-[#00ff88]">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
