import { useEffect, useState } from 'react';
import { Server, Zap, DollarSign } from 'lucide-react';
import type { YieldEstimate } from '../types';

interface NodesProps {
  apiUrl: string;
}

export function Nodes({ apiUrl }: NodesProps) {
  const [nodes, setNodes] = useState<YieldEstimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetch(`${apiUrl}/yield-estimate`);
        if (res.ok) {
          const data = await res.json();
          setNodes(data.estimates || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
    const interval = setInterval(fetchNodes, 5000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  if (loading) {
    return (
      <div>
        <h2 style={{ marginBottom: '24px', fontSize: '18px' }}>Network Nodes</h2>
        {[1, 2, 3].map(i => (
          <div key={i} className="node-card">
            <div className="skeleton" style={{ height: '20px', width: '30%', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '40px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="error-state">
        <Server size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3>No Nodes Online</h3>
        <p>The network is waiting for GPU providers. Run the install command to join.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '24px' 
      }}>
        <h2 style={{ fontSize: '18px', margin: 0 }}>Network Nodes</h2>
        <span className="badge badge-primary">{nodes.length} online</span>
      </div>

      {nodes.map((node, idx) => (
        <div key={idx} className="node-card fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
          <div className="node-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: 'var(--accent-primary)',
                boxShadow: '0 0 8px var(--accent-primary)'
              }} />
              <code className="node-id">{node.fingerprint.slice(0, 16)}...</code>
            </div>
            <span className="badge badge-secondary">{node.model}</span>
          </div>

          <div className="node-stats">
            <div className="node-stat">
              <div className="node-stat-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Zap size={14} />
                {node.tok_per_sec > 0 ? node.tok_per_sec : 'N/A'}
              </div>
              <div className="node-stat-label">tok/sec</div>
            </div>
            
            <div className="node-stat">
              <div className="node-stat-value" style={{ color: node.utilization_percent > 50 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                {node.utilization_percent.toFixed(0)}%
              </div>
              <div className="node-stat-label">utilization</div>
            </div>
            
            <div className="node-stat">
              <div className="node-stat-value">
                {(node.health_score * 100).toFixed(0)}%
              </div>
              <div className="node-stat-label">health</div>
            </div>
            
            <div className="node-stat">
              <div className="node-stat-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--accent-primary)' }}>
                <DollarSign size={14} />
                {node.estimated_revenue_per_day.expected.toFixed(0)}
              </div>
              <div className="node-stat-label">est. daily</div>
            </div>
          </div>

          <div style={{ 
            marginTop: '12px', 
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            <span>Hardware: {node.hardware}</span>
            <span>Jobs/hr: {node.jobs_per_hour.toFixed(1)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
