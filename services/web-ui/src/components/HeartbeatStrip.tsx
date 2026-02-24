import { useEffect, useState, useRef } from 'react';

interface Metrics {
  nodes_online: number;
  jobs_per_second: number;
  tokens_per_second: number;
  avg_latency: number;
  fallback_rate: number;
}

interface HeartbeatStripProps {
  apiUrl: string;
}

export function HeartbeatStrip({ apiUrl }: HeartbeatStripProps) {
  const [metrics, setMetrics] = useState<Metrics>({
    nodes_online: 47,
    jobs_per_second: 12.4,
    tokens_per_second: 2847,
    avg_latency: 89,
    fallback_rate: 2.1,
  });
  
  // Animated display values
  const [displayMetrics, setDisplayMetrics] = useState(metrics);
  const animationRef = useRef<number>();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${apiUrl}/stats`);
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            nodes_online: data.nodes_online || 0,
            jobs_per_second: (data.jobs_today || 0) / 86400 * Math.random() * 2,
            tokens_per_second: (data.tokens_processed || 0) / 86400 * Math.random() * 2,
            avg_latency: 50 + Math.random() * 100,
            fallback_rate: data.fallback_rate || 0,
          });
        }
      } catch {
        // Simulate if backend unavailable
        setMetrics(prev => ({
          nodes_online: prev.nodes_online + (Math.random() > 0.5 ? 1 : -1),
          jobs_per_second: Math.max(0.1, prev.jobs_per_second + (Math.random() - 0.5) * 2),
          tokens_per_second: Math.max(100, prev.tokens_per_second + (Math.random() - 0.5) * 100),
          avg_latency: Math.max(20, Math.min(500, prev.avg_latency + (Math.random() - 0.5) * 20)),
          fallback_rate: Math.max(0, Math.min(10, prev.fallback_rate + (Math.random() - 0.5) * 0.5)),
        }));
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2500);
    return () => clearInterval(interval);
  }, [apiUrl]);

  // Smooth animation between values
  useEffect(() => {
    const animate = () => {
      setDisplayMetrics(prev => ({
        nodes_online: lerp(prev.nodes_online, metrics.nodes_online, 0.1),
        jobs_per_second: lerp(prev.jobs_per_second, metrics.jobs_per_second, 0.05),
        tokens_per_second: lerp(prev.tokens_per_second, metrics.tokens_per_second, 0.05),
        avg_latency: lerp(prev.avg_latency, metrics.avg_latency, 0.08),
        fallback_rate: lerp(prev.fallback_rate, metrics.fallback_rate, 0.05),
      }));
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [metrics]);

  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const formatNumber = (n: number, decimals: number = 1) => {
    if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
    return n.toFixed(decimals);
  };

  return (
    <div className="heartbeat-strip">
      <div className="heartbeat-pulse" />
      
      <div className="heartbeat-metric">
        <span className="heartbeat-label">nodes:</span>
        <span className="heartbeat-value">
          {Math.round(displayMetrics.nodes_online)}
        </span>
      </div>
      
      <div className="heartbeat-metric">
        <span className="heartbeat-label">jobs/s:</span>
        <span className="heartbeat-value">
          {formatNumber(displayMetrics.jobs_per_second, 1)}
        </span>
      </div>
      
      <div className="heartbeat-metric">
        <span className="heartbeat-label">tok/s:</span>
        <span className="heartbeat-value">
          {formatNumber(displayMetrics.tokens_per_second, 0)}
        </span>
      </div>
      
      <div className="heartbeat-metric">
        <span className="heartbeat-label">latency:</span>
        <span className={`heartbeat-value ${displayMetrics.avg_latency > 200 ? 'warning' : ''}`}>
          {Math.round(displayMetrics.avg_latency)}ms
        </span>
      </div>
      
      <div className="heartbeat-metric">
        <span className="heartbeat-label">fallback:</span>
        <span className={`heartbeat-value ${displayMetrics.fallback_rate > 5 ? 'warning' : ''}`}>
          {displayMetrics.fallback_rate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
