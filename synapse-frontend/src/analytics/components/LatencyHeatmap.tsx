/**
 * Latency Heatmap Component
 * Visualizes API latency patterns over time
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LatencyHeatmapData } from '../types';

interface LatencyHeatmapProps {
  data: LatencyHeatmapData[];
}

export const LatencyHeatmap: React.FC<LatencyHeatmapProps> = ({ data }) => {
  // Process data for heatmap
  const heatmapCells = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Get unique time buckets and endpoints
    const timeBuckets = [...new Set(data.map((d) => d.timeBucket))].sort();
    const endpoints = [...new Set(data.map((d) => d.endpoint))].sort();

    // Find min and max values for normalization
    const allLatencies = data.flatMap((d) => d.latencies);
    const minLatency = Math.min(...allLatencies);
    const maxLatency = Math.max(...allLatencies);

    return timeBuckets.map((timeBucket) => {
      return endpoints.map((endpoint) => {
        const cell = data.find((d) => d.timeBucket === timeBucket && d.endpoint === endpoint);
        return {
          timeBucket,
          endpoint,
          value: cell?.averageLatency || 0,
          errorRate: cell?.errorRate || 0,
          intensity: cell
            ? (cell.averageLatency - minLatency) / (maxLatency - minLatency || 1)
            : 0,
        };
      });
    });
  }, [data]);

  const getColor = (intensity: number, errorRate: number) => {
    // Error rate affects color - higher errors = more red
    if (errorRate > 0.1) {
      return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
    }
    
    // Normal gradient from green to red based on latency
    if (intensity < 0.33) {
      return `rgba(34, 197, 94, ${0.3 + intensity * 0.7})`;
    } else if (intensity < 0.66) {
      return `rgba(245, 158, 11, ${0.3 + intensity * 0.7})`;
    } else {
      return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
    }
  };

  const formatTimeBucket = (bucket: string) => {
    const date = new Date(bucket);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatEndpoint = (endpoint: string) => {
    // Truncate long endpoint names
    if (endpoint.length > 20) {
      return endpoint.slice(0, 20) + '...';
    }
    return endpoint;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No latency data available
      </div>
    );
  }

  const timeBuckets = [...new Set(data.map((d) => d.timeBucket))].sort();
  const endpoints = [...new Set(data.map((d) => d.endpoint))].sort();

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max">
        {/* Header row with time buckets */}
        <div className="flex">
          <div className="w-32 flex-shrink-0" /> {/* Empty corner cell */}
          <div className="flex">
            {timeBuckets.map((bucket) => (
              <div
                key={bucket}
                className="w-16 text-center text-xs text-gray-500 py-2"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                {formatTimeBucket(bucket)}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap rows */}
        {endpoints.map((endpoint) => (
          <div key={endpoint} className="flex items-center">
            {/* Endpoint label */}
            <div className="w-32 flex-shrink-0 pr-4 text-right">
              <span className="text-xs text-gray-400 truncate" title={endpoint}>
                {formatEndpoint(endpoint)}
              </span>
            </div>

            {/* Heatmap cells */}
            <div className="flex">
              {timeBuckets.map((bucket) => {
                const cell = data.find(
                  (d) => d.timeBucket === bucket && d.endpoint === endpoint
                );
                const allLatencies = data.flatMap((d) => d.latencies);
                const minLatency = Math.min(...allLatencies);
                const maxLatency = Math.max(...allLatencies);
                const intensity = cell
                  ? (cell.averageLatency - minLatency) / (maxLatency - minLatency || 1)
                  : 0;

                return (
                  <motion.div
                    key={`${endpoint}-${bucket}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.random() * 0.3 }}
                    className="w-16 h-8 m-0.5 rounded cursor-pointer relative group"
                    style={{
                      backgroundColor: getColor(intensity, cell?.errorRate || 0),
                    }}
                    title={`${endpoint} @ ${formatTimeBucket(bucket)}: ${cell?.averageLatency.toFixed(0)}ms (errors: ${((cell?.errorRate || 0) * 100).toFixed(1)}%)`}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <p className="font-medium text-white">{endpoint}</p>
                      <p className="text-gray-400">{formatTimeBucket(bucket)}</p>
                      <p className="text-green-400">
                        Avg: {cell?.averageLatency.toFixed(0)}ms
                      </p>
                      <p className="text-yellow-400">
                        P95: {cell?.percentile95.toFixed(0)}ms
                      </p>
                      {cell && cell.errorRate > 0 && (
                        <p className="text-red-400">
                          Errors: {(cell.errorRate * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Low Latency</span>
          <div className="flex">
            <div className="w-6 h-4 bg-green-500/30" />
            <div className="w-6 h-4 bg-green-500/50" />
            <div className="w-6 h-4 bg-green-500/70" />
            <div className="w-6 h-4 bg-yellow-500/50" />
            <div className="w-6 h-4 bg-yellow-500/70" />
            <div className="w-6 h-4 bg-red-500/50" />
            <div className="w-6 h-4 bg-red-500/70" />
            <div className="w-6 h-4 bg-red-500/90" />
          </div>
          <span className="text-xs text-gray-500">High Latency</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/50" />
          <span className="text-xs text-gray-500">High Error Rate</span>
        </div>
      </div>
    </div>
  );
};
