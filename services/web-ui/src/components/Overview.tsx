import { MetricsPanel } from './MetricsPanel';
import { QuickSetTerminal } from './QuickSetTerminal';
import type { Stats } from '../types';

interface OverviewProps {
  stats: Stats;
  wallet?: string;
  loading?: boolean;
}

export function Overview({ stats, wallet, loading }: OverviewProps) {
  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontSize: '18px' }}>Gateway Overview</h2>
      
      <MetricsPanel stats={stats} loading={loading} />
      
      <div style={{ marginBottom: '24px' }}>
        <QuickSetTerminal wallet={wallet} />
      </div>
      
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-dot red" />
          <div className="terminal-dot yellow" />
          <div className="terminal-dot green" />
          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Network Status
          </span>
        </div>
        <div className="terminal-body">
          <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
            $ synapse-cli status
          </div>
          <div style={{ lineHeight: '1.8' }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              <span style={{ color: stats.nodes_online > 0 ? 'var(--accent-primary)' : 'var(--error)' }}>
                ● Router: {stats.nodes_online > 0 ? 'Connected' : 'No nodes'}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Fallback rate: {stats.fallback_rate.toFixed(1)}%
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
              {stats.nodes_online > 0 
                ? `Network operational. ${stats.nodes_online} nodes ready for inference.`
                : 'Network waiting for providers. Install a node to activate.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
