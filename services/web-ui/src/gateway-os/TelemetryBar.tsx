interface TelemetryBarProps {
  nodesOnline: number;
  queueDepth: number;
  fallbackRate: number;
  latency: number;
  jobsToday: number;
  wallet?: string;
}

export function TelemetryBar({ 
  nodesOnline, 
  queueDepth, 
  fallbackRate, 
  latency, 
  jobsToday,
  wallet 
}: TelemetryBarProps) {
  const formatWallet = (w: string) => {
    if (w.includes('@')) return w;
    return `${w.slice(0, 6)}...${w.slice(-4)}`;
  };

  const health = nodesOnline > 0 && fallbackRate < 5 ? 'online' : 
                 fallbackRate > 10 ? 'degraded' : 'offline';

  return (
    <div className="telemetry-bar">
      <div className="telemetry-metric">
        <div className="telemetry-pulse" />
        <span className="telemetry-label">Network:</span>
        <span className={`telemetry-value ${health === 'degraded' ? 'warning' : 'active'}`}>
          {health === 'online' ? 'ONLINE' : health === 'degraded' ? 'DEGRADED' : 'OFFLINE'}
        </span>
      </div>
      
      <div className="telemetry-metric">
        <span className="telemetry-label">Nodes:</span>
        <span className="telemetry-value active">{nodesOnline}</span>
      </div>
      
      <div className="telemetry-metric">
        <span className="telemetry-label">Queue:</span>
        <span className={`telemetry-value ${queueDepth > 5 ? 'warning' : ''}`}>
          {queueDepth}
        </span>
      </div>
      
      <div className="telemetry-metric">
        <span className="telemetry-label">Latency:</span>
        <span className={`telemetry-value ${latency > 200 ? 'warning' : ''}`}>
          {Math.round(latency)}ms
        </span>
      </div>
      
      <div className="telemetry-metric">
        <span className="telemetry-label">Fallback:</span>
        <span className={`telemetry-value ${fallbackRate > 5 ? 'warning' : ''}`}>
          {fallbackRate.toFixed(1)}%
        </span>
      </div>
      
      <div className="telemetry-metric">
        <span className="telemetry-label">Jobs:</span>
        <span className="telemetry-value">{jobsToday.toLocaleString()}</span>
      </div>
      
      {wallet && (
        <div className="telemetry-metric" style={{ marginLeft: 'auto' }}>
          <span className="telemetry-label">Wallet:</span>
          <span className="telemetry-value" style={{ color: '#0ff' }}>
            {formatWallet(wallet)}
          </span>
        </div>
      )}
    </div>
  );
}
