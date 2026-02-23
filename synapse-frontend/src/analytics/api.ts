/**
 * Analytics API Client
 * Synapse Protocol
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  NetworkStats,
  GeographicNode,
  GPUUtilization,
  JobCompletionMetrics,
  TokenPriceData,
  TradingVolume,
  NodeEarningsDistribution,
  StakingPool,
  StakingCalculation,
  APILatencyMetrics,
  LatencyHeatmapData,
  ModelPerformance,
  ErrorRateMetrics,
  CapacityForecast,
  NodeLeaderboardEntry,
  ReliabilityLeaderboardEntry,
  SpeedLeaderboardEntry,
  RegionalPerformance,
  SystemHealth,
  AlertConfig,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ============================================================================
// API Client
// ============================================================================

class AnalyticsAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Network Analytics
  async getNetworkStats(): Promise<NetworkStats> {
    return this.fetch('/analytics/network/stats');
  }

  async getGeographicDistribution(): Promise<GeographicNode[]> {
    return this.fetch('/analytics/network/geographic');
  }

  async getGPUUtilization(timeRange: string): Promise<GPUUtilization[]> {
    return this.fetch(`/analytics/network/gpu-utilization?range=${timeRange}`);
  }

  async getJobCompletionMetrics(period: string): Promise<JobCompletionMetrics> {
    return this.fetch(`/analytics/network/jobs?period=${period}`);
  }

  // Economic Metrics
  async getTokenPrice(): Promise<TokenPriceData> {
    return this.fetch('/analytics/economics/price');
  }

  async getPriceHistory(days: number): Promise<TokenPriceData[]> {
    return this.fetch(`/analytics/economics/price-history?days=${days}`);
  }

  async getTradingVolume(period: string): Promise<TradingVolume> {
    return this.fetch(`/analytics/economics/volume?period=${period}`);
  }

  async getEarningsDistribution(period: string): Promise<NodeEarningsDistribution> {
    return this.fetch(`/analytics/economics/earnings?period=${period}`);
  }

  async getStakingPools(): Promise<StakingPool[]> {
    return this.fetch('/analytics/economics/staking-pools');
  }

  async calculateStaking(params: {
    amount: string;
    poolId: string;
    duration: number;
  }): Promise<StakingCalculation> {
    return this.fetch('/analytics/economics/staking-calculate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Performance Monitoring
  async getAPILatencies(timeRange: string): Promise<APILatencyMetrics[]> {
    return this.fetch(`/analytics/performance/latency?range=${timeRange}`);
  }

  async getLatencyHeatmap(
    timeRange: string,
    endpoint?: string
  ): Promise<LatencyHeatmapData[]> {
    const query = endpoint ? `&endpoint=${endpoint}` : '';
    return this.fetch(`/analytics/performance/latency-heatmap?range=${timeRange}${query}`);
  }

  async getModelPerformance(): Promise<ModelPerformance[]> {
    return this.fetch('/analytics/performance/models');
  }

  async getErrorRates(timeRange: string): Promise<ErrorRateMetrics[]> {
    return this.fetch(`/analytics/performance/errors?range=${timeRange}`);
  }

  async getCapacityForecast(): Promise<CapacityForecast> {
    return this.fetch('/analytics/performance/capacity-forecast');
  }

  // Leaderboards
  async getEarningsLeaderboard(limit: number = 100): Promise<NodeLeaderboardEntry[]> {
    return this.fetch(`/analytics/leaderboard/earnings?limit=${limit}`);
  }

  async getReliabilityLeaderboard(limit: number = 100): Promise<ReliabilityLeaderboardEntry[]> {
    return this.fetch(`/analytics/leaderboard/reliability?limit=${limit}`);
  }

  async getSpeedLeaderboard(limit: number = 100): Promise<SpeedLeaderboardEntry[]> {
    return this.fetch(`/analytics/leaderboard/speed?limit=${limit}`);
  }

  async getRegionalPerformance(): Promise<RegionalPerformance[]> {
    return this.fetch('/analytics/leaderboard/regional');
  }

  // System Health
  async getSystemHealth(): Promise<SystemHealth> {
    return this.fetch('/analytics/health');
  }

  // Alerts
  async getAlerts(): Promise<AlertConfig[]> {
    return this.fetch('/analytics/alerts');
  }

  async createAlert(alert: Omit<AlertConfig, 'id'>): Promise<AlertConfig> {
    return this.fetch('/analytics/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  }

  async updateAlert(id: string, alert: Partial<AlertConfig>): Promise<AlertConfig> {
    return this.fetch(`/analytics/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(alert),
    });
  }

  async deleteAlert(id: string): Promise<void> {
    return this.fetch(`/analytics/alerts/${id}`, {
      method: 'DELETE',
    });
  }
}

export const analyticsAPI = new AnalyticsAPI();

// ============================================================================
// React Query Hooks
// ============================================================================

// Network Analytics Hooks
export const useNetworkStats = () => {
  return useQuery({
    queryKey: ['analytics', 'network', 'stats'],
    queryFn: () => analyticsAPI.getNetworkStats(),
    refetchInterval: 30000, // 30 seconds
  });
};

export const useGeographicDistribution = () => {
  return useQuery({
    queryKey: ['analytics', 'network', 'geographic'],
    queryFn: () => analyticsAPI.getGeographicDistribution(),
    refetchInterval: 60000, // 1 minute
  });
};

export const useGPUUtilization = (timeRange: string = '24h') => {
  return useQuery({
    queryKey: ['analytics', 'network', 'gpu', timeRange],
    queryFn: () => analyticsAPI.getGPUUtilization(timeRange),
    refetchInterval: 30000,
  });
};

export const useJobCompletionMetrics = (period: string = '24h') => {
  return useQuery({
    queryKey: ['analytics', 'network', 'jobs', period],
    queryFn: () => analyticsAPI.getJobCompletionMetrics(period),
    refetchInterval: 60000,
  });
};

// Economic Metrics Hooks
export const useTokenPrice = () => {
  return useQuery({
    queryKey: ['analytics', 'economics', 'price'],
    queryFn: () => analyticsAPI.getTokenPrice(),
    refetchInterval: 15000, // 15 seconds
  });
};

export const usePriceHistory = (days: number = 30) => {
  return useQuery({
    queryKey: ['analytics', 'economics', 'price-history', days],
    queryFn: () => analyticsAPI.getPriceHistory(days),
    refetchInterval: 300000, // 5 minutes
  });
};

export const useTradingVolume = (period: string = '24h') => {
  return useQuery({
    queryKey: ['analytics', 'economics', 'volume', period],
    queryFn: () => analyticsAPI.getTradingVolume(period),
    refetchInterval: 60000,
  });
};

export const useEarningsDistribution = (period: string = '24h') => {
  return useQuery({
    queryKey: ['analytics', 'economics', 'earnings', period],
    queryFn: () => analyticsAPI.getEarningsDistribution(period),
    refetchInterval: 300000,
  });
};

export const useStakingPools = () => {
  return useQuery({
    queryKey: ['analytics', 'economics', 'staking-pools'],
    queryFn: () => analyticsAPI.getStakingPools(),
    refetchInterval: 300000,
  });
};

export const useStakingCalculation = () => {
  return useMutation({
    mutationFn: (params: { amount: string; poolId: string; duration: number }) =>
      analyticsAPI.calculateStaking(params),
  });
};

// Performance Monitoring Hooks
export const useAPILatencies = (timeRange: string = '24h') => {
  return useQuery({
    queryKey: ['analytics', 'performance', 'latency', timeRange],
    queryFn: () => analyticsAPI.getAPILatencies(timeRange),
    refetchInterval: 30000,
  });
};

export const useLatencyHeatmap = (timeRange: string = '24h', endpoint?: string) => {
  return useQuery({
    queryKey: ['analytics', 'performance', 'heatmap', timeRange, endpoint],
    queryFn: () => analyticsAPI.getLatencyHeatmap(timeRange, endpoint),
    refetchInterval: 60000,
  });
};

export const useModelPerformance = () => {
  return useQuery({
    queryKey: ['analytics', 'performance', 'models'],
    queryFn: () => analyticsAPI.getModelPerformance(),
    refetchInterval: 60000,
  });
};

export const useErrorRates = (timeRange: string = '24h') => {
  return useQuery({
    queryKey: ['analytics', 'performance', 'errors', timeRange],
    queryFn: () => analyticsAPI.getErrorRates(timeRange),
    refetchInterval: 30000,
  });
};

export const useCapacityForecast = () => {
  return useQuery({
    queryKey: ['analytics', 'performance', 'forecast'],
    queryFn: () => analyticsAPI.getCapacityForecast(),
    refetchInterval: 3600000, // 1 hour
  });
};

// Leaderboard Hooks
export const useEarningsLeaderboard = (limit: number = 100) => {
  return useQuery({
    queryKey: ['analytics', 'leaderboard', 'earnings', limit],
    queryFn: () => analyticsAPI.getEarningsLeaderboard(limit),
    refetchInterval: 300000,
  });
};

export const useReliabilityLeaderboard = (limit: number = 100) => {
  return useQuery({
    queryKey: ['analytics', 'leaderboard', 'reliability', limit],
    queryFn: () => analyticsAPI.getReliabilityLeaderboard(limit),
    refetchInterval: 300000,
  });
};

export const useSpeedLeaderboard = (limit: number = 100) => {
  return useQuery({
    queryKey: ['analytics', 'leaderboard', 'speed', limit],
    queryFn: () => analyticsAPI.getSpeedLeaderboard(limit),
    refetchInterval: 300000,
  });
};

export const useRegionalPerformance = () => {
  return useQuery({
    queryKey: ['analytics', 'leaderboard', 'regional'],
    queryFn: () => analyticsAPI.getRegionalPerformance(),
    refetchInterval: 600000, // 10 minutes
  });
};

// System Health Hook
export const useSystemHealth = () => {
  return useQuery({
    queryKey: ['analytics', 'health'],
    queryFn: () => analyticsAPI.getSystemHealth(),
    refetchInterval: 30000,
  });
};

// Alert Hooks
export const useAlerts = () => {
  return useQuery({
    queryKey: ['analytics', 'alerts'],
    queryFn: () => analyticsAPI.getAlerts(),
  });
};

export const useCreateAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alert: Omit<AlertConfig, 'id'>) => analyticsAPI.createAlert(alert),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'alerts'] });
    },
  });
};

export const useUpdateAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, alert }: { id: string; alert: Partial<AlertConfig> }) =>
      analyticsAPI.updateAlert(id, alert),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'alerts'] });
    },
  });
};

export const useDeleteAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyticsAPI.deleteAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'alerts'] });
    },
  });
};
