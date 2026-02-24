import { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, Server, Globe, Database } from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  demo_mode: boolean;
  dependencies: {
    api: { status: 'connected' | 'disconnected'; latency?: number; error?: string };
    ws: { status: 'connected' | 'disconnected' };
  };
}

export function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const start = Date.now();
        const response = await fetch('/api/v1/health');
        const latency = Date.now() - start;
        const data = await response.json();

        setHealth({
          status: response.ok ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          version: data.version || '1.0.0',
          environment: import.meta.env.MODE,
          demo_mode: data.mode === 'demo',
          dependencies: {
            api: { status: 'connected', latency },
            ws: { status: 'disconnected' }, // TODO: WebSocket health check
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHealth({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          version: 'unknown',
          environment: import.meta.env.MODE,
          demo_mode: true,
          dependencies: {
            api: { status: 'disconnected', error: 'Failed to connect' },
            ws: { status: 'disconnected' },
          },
        });
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-synapse-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-charcoal-400">Checking system health...</p>
        </div>
      </div>
    );
  }

  const statusColors = {
    healthy: 'text-synapse-500',
    degraded: 'text-amber-500',
    unhealthy: 'text-red-500',
  };

  const statusBg = {
    healthy: 'bg-synapse-500/10 border-synapse-500/30',
    degraded: 'bg-amber-500/10 border-amber-500/30',
    unhealthy: 'bg-red-500/10 border-red-500/30',
  };

  return (
    <div className="min-h-screen bg-charcoal-950 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Activity size={28} className="text-synapse-500" />
          <h1 className="text-3xl font-semibold text-charcoal-100">System Health</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Overall Status */}
        <div className={`mb-8 p-6 rounded-xl border ${statusBg[health?.status || 'healthy']}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {health?.status === 'healthy' ? (
                <CheckCircle size={32} className="text-synapse-500" />
              ) : (
                <XCircle size={32} className={statusColors[health?.status || 'healthy']} />
              )}
              <div>
                <h2 className={`text-xl font-semibold capitalize ${statusColors[health?.status || 'healthy']}`}>
                  {health?.status}
                </h2>
                <p className="text-charcoal-400 text-sm">
                  Last checked: {new Date(health?.timestamp || '').toLocaleString()}
                </p>
              </div>
            </div>
            {health?.demo_mode && (
              <span className="px-3 py-1 bg-amber-950/50 text-amber-400 text-sm rounded-full">
                Demo Mode
              </span>
            )}
          </div>
        </div>

        {/* System Info */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Server size={20} className="text-charcoal-400" />
              <span className="text-charcoal-400 text-sm">Version</span>
            </div>
            <p className="text-xl font-medium text-charcoal-100">{health?.version}</p>
          </div>

          <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Globe size={20} className="text-charcoal-400" />
              <span className="text-charcoal-400 text-sm">Environment</span>
            </div>
            <p className="text-xl font-medium text-charcoal-100">{health?.environment}</p>
          </div>
        </div>

        {/* Dependencies */}
        <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-charcoal-800">
            <h3 className="font-medium text-charcoal-100">Dependencies</h3>
          </div>

          <div className="divide-y divide-charcoal-800">
            {/* API */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${
                  health?.dependencies.api.status === 'connected' ? 'bg-synapse-500' : 'bg-red-500'
                }`} />
                <div>
                  <p className="text-charcoal-200 font-medium">API Gateway</p>
                  <p className="text-sm text-charcoal-500">
                    {health?.dependencies.api.status === 'connected' 
                      ? `Latency: ${health.dependencies.api.latency}ms`
                      : health?.dependencies.api.error || 'Disconnected'
                    }
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                health?.dependencies.api.status === 'connected'
                  ? 'bg-synapse-500/20 text-synapse-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {health?.dependencies.api.status}
              </span>
            </div>

            {/* WebSocket */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${
                  health?.dependencies.ws.status === 'connected' ? 'bg-synapse-500' : 'bg-amber-500'
                }`} />
                <div>
                  <p className="text-charcoal-200 font-medium">WebSocket</p>
                  <p className="text-sm text-charcoal-500">Real-time updates</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                health?.dependencies.ws.status === 'connected'
                  ? 'bg-synapse-500/20 text-synapse-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {health?.dependencies.ws.status}
              </span>
            </div>

            {/* Database */}
            <div className="px-6 py-4 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-4">
                <Database size={16} className="text-charcoal-500" />
                <div>
                  <p className="text-charcoal-400 font-medium">Database</p>
                  <p className="text-sm text-charcoal-600">N/A in demo mode</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs rounded bg-charcoal-800 text-charcoal-500">
                disabled
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-charcoal-500">
          <p>Synapse Gateway Health Monitor</p>
          <p className="mt-1">Auto-refreshes every 30 seconds</p>
        </div>
      </div>
    </div>
  );
}
