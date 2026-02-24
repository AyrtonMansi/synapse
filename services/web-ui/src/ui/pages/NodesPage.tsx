import { useState, useEffect } from 'react';
import { Server, Plus, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  model: string;
  throughput: string;
  latency: number;
  location: string;
  uptime: string;
}

export function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call - in production this would fetch from backend
    const fetchNodes = async () => {
      try {
        setLoading(true);
        // Try to fetch real nodes, fallback to empty
        const response = await fetch('/api/v1/nodes').catch(() => null);
        
        if (response?.ok) {
          const data = await response.json();
          setNodes(data.nodes || []);
        } else {
          // No backend - show empty state
          setNodes([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load nodes');
        setNodes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, []);

  const getStatusIcon = (status: Node['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle size={16} className="text-synapse-500" />;
      case 'busy':
        return <Clock size={16} className="text-amber-500" />;
      case 'offline':
        return <XCircle size={16} className="text-red-500" />;
    }
  };

  const getStatusClass = (status: Node['status']) => {
    switch (status) {
      case 'online':
        return 'bg-synapse-500/10 text-synapse-400 border-synapse-500/30';
      case 'busy':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'offline':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-charcoal-100">Nodes</h1>
            <p className="text-charcoal-400">Manage connected compute nodes</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 animate-pulse">
              <div className="h-6 bg-charcoal-800 rounded w-1/4 mb-4" />
              <div className="h-4 bg-charcoal-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-charcoal-100">Nodes</h1>
            <p className="text-charcoal-400">Manage connected compute nodes</p>
          </div>
        </div>
        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-8 text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-400 mb-2">Failed to load nodes</h3>
          <p className="text-red-400/80 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-charcoal-100">Nodes</h1>
            <p className="text-charcoal-400">Manage connected compute nodes</p>
          </div>
        </div>
        <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl p-12 text-center">
          <Server size={48} className="text-charcoal-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-charcoal-300 mb-2">No nodes connected</h3>
          <p className="text-charcoal-500 mb-6 max-w-md mx-auto">
            Connect your first node to start processing inference requests on the Synapse network.
          </p>
          <a 
            href="/gateway/run-node"
            className="inline-flex items-center gap-2 px-4 py-2 bg-synapse-600 hover:bg-synapse-500 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            Run a Node
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal-100">Nodes</h1>
          <p className="text-charcoal-400">{nodes.length} node{nodes.length !== 1 ? 's' : ''} connected</p>
        </div>
        <a 
          href="/gateway/run-node"
          className="inline-flex items-center gap-2 px-4 py-2 bg-synapse-600 hover:bg-synapse-500 text-white rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add Node
        </a>
      </div>

      <div className="space-y-4">
        {nodes.map(node => (
          <div key={node.id} className="bg-charcoal-900 border border-charcoal-800 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${getStatusClass(node.status)}`}>
                  <Server size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-charcoal-100">{node.name}</h3>
                  <p className="text-sm text-charcoal-500">{node.id}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full border flex items-center gap-1.5 ${getStatusClass(node.status)}`}>
                {getStatusIcon(node.status)}
                {node.status}
              </span>
            </div>
            
            <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-charcoal-800">
              <div>
                <p className="text-xs text-charcoal-500 uppercase tracking-wider">Model</p>
                <p className="text-sm text-charcoal-300 mt-1">{node.model}</p>
              </div>
              <div>
                <p className="text-xs text-charcoal-500 uppercase tracking-wider">Throughput</p>
                <p className="text-sm text-charcoal-300 mt-1">{node.throughput}</p>
              </div>
              <div>
                <p className="text-xs text-charcoal-500 uppercase tracking-wider">Latency</p>
                <p className="text-sm text-charcoal-300 mt-1">{node.latency}ms</p>
              </div>
              <div>
                <p className="text-xs text-charcoal-500 uppercase tracking-wider">Uptime</p>
                <p className="text-sm text-charcoal-300 mt-1">{node.uptime}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
