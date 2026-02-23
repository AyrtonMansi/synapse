/**
 * Network Analytics Dashboard
 * Displays real-time network statistics and metrics
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, Activity, CheckCircle, Clock, TrendingUp, Users } from 'lucide-react';
import { StatCard } from './StatCard';
import { SystemHealthMonitor } from './SystemHealthMonitor';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalJobs: number;
  completedJobs: number;
  averageLatency: number;
  networkUtilization: number;
}

async function fetchNetworkStats(): Promise<NetworkStats> {
  // TODO: Replace with actual API call
  return {
    totalNodes: 1247,
    activeNodes: 1189,
    totalJobs: 45231,
    completedJobs: 44987,
    averageLatency: 45,
    networkUtilization: 72,
  };
}

export function NetworkAnalyticsDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['network-stats'],
    queryFn: fetchNetworkStats,
    refetchInterval: 30000,
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load network stats" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-mono font-bold text-terminal-text">
          <span className="text-terminal-accent">$</span> network-stats
        </h2>
        <SystemHealthMonitor />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Server}
          title="Total Nodes"
          value={data.totalNodes.toLocaleString()}
          subtitle="Network size"
          trend={12}
          color="blue"
        />
        <StatCard
          icon={Activity}
          title="Active Nodes"
          value={data.activeNodes.toLocaleString()}
          subtitle={`${((data.activeNodes / data.totalNodes) * 100).toFixed(1)}% online`}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          title="Total Jobs"
          value={data.totalJobs.toLocaleString()}
          subtitle="All time"
          trend={8}
          color="purple"
        />
        <StatCard
          icon={CheckCircle}
          title="Completed Jobs"
          value={data.completedJobs.toLocaleString()}
          subtitle={`${((data.completedJobs / data.totalJobs) * 100).toFixed(1)}% success rate`}
          color="emerald"
        />
        <StatCard
          icon={Clock}
          title="Avg Latency"
          value={`${data.averageLatency}ms`}
          subtitle="Global average"
          trend={-5}
          color="cyan"
        />
        <StatCard
          icon={Users}
          title="Network Utilization"
          value={`${data.networkUtilization}%`}
          subtitle="Current load"
          color="yellow"
        />
      </div>
    </div>
  );
}
