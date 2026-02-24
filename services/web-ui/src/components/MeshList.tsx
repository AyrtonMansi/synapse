import { useState, useEffect } from 'react';

interface MeshNode {
  fingerprint: string;
  status: 'online' | 'degraded' | 'offline';
  model: string;
  throughput: number;
  health: number;
  jobs: number;
}

export function MeshList() {
  const [nodes, setNodes] = useState<MeshNode[]>([]);

  useEffect(() => {
    // Generate initial nodes
    const models = ['deepseek-v3', 'claude-opus', 'gpt-4', 'llama-3-70b'];
    const initial: MeshNode[] = Array.from({ length: 8 }, () => ({
      fingerprint: `node_${Math.random().toString(16).slice(2, 10)}`,
      status: Math.random() > 0.1 ? 'online' : Math.random() > 0.5 ? 'degraded' : 'offline',
      model: models[Math.floor(Math.random() * models.length)],
      throughput: Math.floor(Math.random() * 500) + 100,
      health: Math.floor(Math.random() * 30) + 70,
      jobs: Math.floor(Math.random() * 1000),
    }));
    setNodes(initial);

    // Update nodes periodically
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        throughput: Math.max(0, node.throughput + (Math.random() - 0.5) * 50),
        health: Math.min(100, Math.max(0, node.health + (Math.random() - 0.5) * 5)),
        jobs: node.jobs + (node.status === 'online' ? Math.floor(Math.random() * 3) : 0),
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const onlineCount = nodes.filter(n => n.status === 'online').length;
  const totalThroughput = nodes.reduce((acc, n) => acc + n.throughput, 0);

  return (
    <div className="terminal-window" style={{ height: '100%' }}>
      <div className="terminal-header">
        <span>mesh.status</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', color: '#666' }}>
          <span>nodes: <span style={{ color: '#0f0' }}>{onlineCount}/{nodes.length}</span></span>
          <span>capacity: <span style={{ color: '#0f0' }}>{Math.round(totalThroughput)} tok/s</span></span>
        </div>
      </div>
      
      <div className="terminal-body">
        <div className="node-list">
          {nodes.map((node) => (
            <div key={node.fingerprint} className="node-entry">
              <div className={`node-health ${node.status}`} />
              <span className="node-fingerprint">{node.fingerprint}</span>
              <span className="node-model">{node.model}</span>
              <span style={{ color: '#666', fontSize: '10px' }}>
                health:{node.health.toFixed(0)}%
              </span>
              <span style={{ color: '#666', fontSize: '10px' }}>
                jobs:{node.jobs}
              </span>
              <span className="node-throughput">
                {node.throughput.toFixed(0)} tok/s
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
