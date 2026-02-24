import { useEffect, useState } from 'react';
import type { Stats } from '../types';

interface MetricsPanelProps {
  stats: Stats;
  loading?: boolean;
}

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = (value - displayValue) / steps;
    let step = 0;
    
    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(prev => prev + increment);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [value]);

  const formatNumber = (n: number) => {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(n % 1 === 0 ? 0 : 1);
  };

  return (
    <span className="metric-counter">
      {prefix}{formatNumber(displayValue)}{suffix}
    </span>
  );
}

export function MetricsPanel({ stats, loading }: MetricsPanelProps) {
  if (loading) {
    return (
      <div className="grid-metrics">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="metric-card">
            <div className="skeleton" style={{ height: '32px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '12px', width: '60%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid-metrics">
      <div className="metric-card glow-border">
        <div className="metric-counter">
          <AnimatedCounter value={stats.nodes_online} />
        </div>
        <div className="metric-label">Nodes Online</div>
      </div>
      
      <div className="metric-card">
        <div className="metric-counter">
          <AnimatedCounter value={stats.jobs_today} />
        </div>
        <div className="metric-label">Jobs Today</div>
      </div>
      
      <div className="metric-card">
        <div className="metric-counter">
          <AnimatedCounter value={stats.tokens_processed} suffix="M" />
        </div>
        <div className="metric-label">Tokens Processed</div>
      </div>
      
      <div className="metric-card">
        <div className="metric-counter" style={{ color: 'var(--text-secondary)' }}>
          $<AnimatedCounter value={stats.avg_cost} />
        </div>
        <div className="metric-label">Avg Cost / 1M</div>
      </div>
    </div>
  );
}
