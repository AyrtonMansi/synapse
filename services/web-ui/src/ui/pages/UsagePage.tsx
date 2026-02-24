import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Activity, Server, Calendar, Download, AlertCircle } from 'lucide-react';
import { useToast } from '../../lib/toast';

interface UsageRecord {
  id: string;
  timestamp: string;
  model: string;
  tokens: number;
  cost: string;
  latency: number;
  status: 'success' | 'error';
}

type TimeRange = '24h' | '7d' | '30d';

export function UsagePage() {
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [showSampleData, setShowSampleData] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        // Try to fetch real usage data
        const response = await fetch('/api/v1/usage').catch(() => null);
        
        if (response?.ok) {
          const data = await response.json();
          setUsage(data.records || []);
        } else {
          // No backend - show empty state
          setUsage([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage data');
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [timeRange]);

  const generateSampleData = (): UsageRecord[] => [
    { id: '1', timestamp: new Date(Date.now() - 3600000).toISOString(), model: 'synapse-llama-3-70b', tokens: 1247, cost: '$0.023', latency: 1245, status: 'success' },
    { id: '2', timestamp: new Date(Date.now() - 7200000).toISOString(), model: 'synapse-mixtral-8x22b', tokens: 892, cost: '$0.018', latency: 892, status: 'success' },
    { id: '3', timestamp: new Date(Date.now() - 10800000).toISOString(), model: 'synapse-llama-3-8b', tokens: 456, cost: '$0.004', latency: 234, status: 'success' },
  ];

  const exportData = () => {
    const data = showSampleData ? generateSampleData() : usage;
    const csv = [
      ['ID', 'Timestamp', 'Model', 'Tokens', 'Cost', 'Latency (ms)', 'Status'].join(','),
      ...data.map(r => [r.id, r.timestamp, r.model, r.tokens, r.cost, r.latency, r.status].join(',')),
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synapse-usage-${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Usage data exported', 'success');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stats = [
    { label: 'Requests', value: showSampleData ? '3' : '0', icon: Activity },
    { label: 'Tokens', value: showSampleData ? '2,595' : '0', icon: TrendingUp },
    { label: 'Cost', value: showSampleData ? '$0.045' : '$0.00', icon: BarChart3 },
    { label: 'Avg Latency', value: showSampleData ? '790ms' : '-', icon: Server },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-charcoal-100 mb-2">Usage</h1>
          <p className="text-charcoal-400">Monitor your API usage and costs</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 animate-pulse">
              <div className="h-4 bg-charcoal-800 rounded w-1/2 mb-4" />
              <div className="h-8 bg-charcoal-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-charcoal-100 mb-2">Usage</h1>
          <p className="text-charcoal-400">Monitor your API usage and costs</p>
        </div>
        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-8 text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-400 mb-2">Failed to load usage data</h3>
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

  const displayData = showSampleData ? generateSampleData() : usage;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal-100 mb-2">Usage</h1>
          <p className="text-charcoal-400">Monitor your API usage and costs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-charcoal-900 rounded-lg border border-charcoal-800 p-1">
            {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-charcoal-800 text-charcoal-200'
                    : 'text-charcoal-500 hover:text-charcoal-300'
                }`}
              >
                {range === '24h' ? 'Last 24h' : range === '7d' ? 'Last 7 days' : 'Last 30 days'}
              </button>
            ))}
          </div>
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-3 py-2 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-800 rounded-lg text-sm text-charcoal-300 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <stat.icon size={20} className="text-charcoal-400" />
            </div>
            <div className="text-3xl font-semibold text-charcoal-100">{stat.value}</div>
            <div className="text-sm text-charcoal-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Usage Table */}
      <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-charcoal-800 flex items-center justify-between">
          <h3 className="font-medium text-charcoal-100">Request History</h3>
          {usage.length === 0 && !showSampleData && (
            <button
              onClick={() => setShowSampleData(true)}
              className="text-sm text-synapse-400 hover:text-synapse-300"
            >
              Show sample data
            </button>
          )}
        </div>
        
        {displayData.length > 0 ? (
          <table className="w-full">
            <thead className="bg-charcoal-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-500 uppercase">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-500 uppercase">Tokens</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-500 uppercase">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-500 uppercase">Latency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-charcoal-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {displayData.map((record) => (
                <tr key={record.id} className="hover:bg-charcoal-800/50">
                  <td className="px-6 py-4 text-sm text-charcoal-300">{formatDate(record.timestamp)}</td>
                  <td className="px-6 py-4 text-sm text-charcoal-300">{record.model}</td>
                  <td className="px-6 py-4 text-sm text-charcoal-300">{record.tokens.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-charcoal-300">{record.cost}</td>
                  <td className="px-6 py-4 text-sm text-charcoal-300">{record.latency}ms</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      record.status === 'success' 
                        ? 'bg-synapse-500/10 text-synapse-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Calendar size={48} className="text-charcoal-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-charcoal-300 mb-2">No usage data</h3>
            <p className="text-charcoal-500 max-w-md mx-auto">
              Start making API calls to see your usage history here. In local mode, usage is not persisted to the server.
            </p>
          </div>
        )}
      </div>

      {showSampleData && (
        <div className="mt-4 p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg">
          <p className="text-sm text-amber-400">
            Showing sample data. In production, this would display your actual API usage.
          </p>
        </div>
      )}
    </div>
  );
}
