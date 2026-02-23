/**
 * Network Analytics Service
 * Handles network metrics and node statistics
 */

import { NodeMetric, JobMetric, TimeRange, AggregationResult } from '../types';

export class NetworkAnalyticsService {
  private db: any; // Database connection

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Get current network statistics
   */
  async getNetworkStats() {
    const cacheKey = 'network:stats';
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const [
      totalNodes,
      activeNodes,
      onlineNodes,
      syncingNodes,
      maintenanceNodes,
      totalGPUs,
      totalTFLOPS,
    ] = await Promise.all([
      this.db.nodes.count(),
      this.db.nodes.count({ where: { status: 'active' } }),
      this.db.nodes.count({ where: { status: 'online' } }),
      this.db.nodes.count({ where: { status: 'syncing' } }),
      this.db.nodes.count({ where: { status: 'maintenance' } }),
      this.db.nodes.aggregate({ _sum: { gpuCount: true } }),
      this.db.nodes.aggregate({ _sum: { tflops: true } }),
    ]);

    // Calculate network utilization
    const recentMetrics = await this.db.nodeMetrics.findMany({
      where: {
        timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { gpuUtilization: true },
    });

    const avgUtilization = recentMetrics.length
      ? recentMetrics.reduce((sum: number, m: any) => sum + m.gpuUtilization, 0) / recentMetrics.length
      : 0;

    const stats = {
      totalNodes,
      activeNodes,
      onlineNodes,
      syncingNodes,
      maintenanceNodes,
      totalGPUCount: totalGPUs._sum.gpuCount || 0,
      totalTFLOPS: totalTFLOPS._sum.tflops || 0,
      networkUtilization: avgUtilization,
      lastUpdated: Date.now(),
    };

    await this.setCache(cacheKey, stats, 30); // 30 seconds TTL
    return stats;
  }

  /**
   * Get geographic distribution of nodes
   */
  async getGeographicDistribution() {
    const cacheKey = 'network:geographic';
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const nodes = await this.db.nodes.groupBy({
      by: ['region', 'country', 'city'],
      _count: { id: true },
      _sum: { gpuCount: true, tflops: true },
    });

    const regionCoords: Record<string, { lat: number; lng: number }> = {
      'us-east': { lat: 39.0, lng: -77.0 },
      'us-west': { lat: 37.0, lng: -122.0 },
      'us-central': { lat: 41.0, lng: -93.0 },
      'eu-west': { lat: 53.0, lng: -8.0 },
      'eu-central': { lat: 50.0, lng: 10.0 },
      'eu-north': { lat: 59.0, lng: 18.0 },
      'ap-south': { lat: 19.0, lng: 72.0 },
      'ap-southeast': { lat: 1.0, lng: 103.0 },
      'ap-northeast': { lat: 35.0, lng: 139.0 },
      'sa-east': { lat: -23.0, lng: -46.0 },
      'af-south': { lat: -33.0, lng: 18.0 },
      'me-south': { lat: 25.0, lng: 55.0 },
    };

    const distribution = nodes.map((node: any) => {
      const coords = regionCoords[node.region] || { lat: 0, lng: 0 };
      return {
        id: `${node.region}-${node.city}`,
        lat: coords.lat,
        lng: coords.lng,
        region: node.region,
        country: node.country,
        city: node.city,
        nodeCount: node._count.id,
        gpuCount: node._sum.gpuCount || 0,
        tflops: node._sum.tflops || 0,
        utilization: Math.random() * 100, // Calculate from actual metrics
        status: 'healthy' as const,
      };
    });

    await this.setCache(cacheKey, distribution, 60); // 1 minute TTL
    return distribution;
  }

  /**
   * Get GPU utilization over time
   */
  async getGPUUtilization(timeRange: TimeRange) {
    const cacheKey = `network:gpu:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const metrics = await this.db.nodeMetrics.findMany({
      where: {
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by time buckets
    const buckets = this.groupByTimeBucket(metrics, timeRange.granularity);
    
    const utilization = Array.from(buckets.entries()).map(([timestamp, items]) => {
      const gpuUtils = items.map((m: NodeMetric) => m.gpuUtilization);
      return {
        timestamp: new Date(timestamp).getTime(),
        totalGPUs: items.length,
        activeGPUs: items.filter((m: NodeMetric) => m.gpuUtilization > 0).length,
        averageUtilization: this.average(gpuUtils),
        utilizationByTier: this.aggregateByTier(items),
        utilizationByRegion: this.aggregateByRegion(items),
      };
    });

    await this.setCache(cacheKey, utilization, 300); // 5 minutes TTL
    return utilization;
  }

  /**
   * Get job completion metrics
   */
  async getJobCompletionMetrics(timeRange: TimeRange) {
    const cacheKey = `network:jobs:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const jobs = await this.db.jobMetrics.findMany({
      where: {
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
    });

    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j: JobMetric) => j.status === 'completed').length;
    const failedJobs = jobs.filter((j: JobMetric) => j.status === 'failed').length;
    const cancelledJobs = jobs.filter((j: JobMetric) => j.status === 'cancelled').length;

    const completedJobDetails = jobs.filter((j: JobMetric) => j.status === 'completed');
    const avgDuration = completedJobDetails.length
      ? completedJobDetails.reduce((sum: number, j: JobMetric) => sum + j.duration, 0) / completedJobDetails.length
      : 0;
    const avgQueueTime = completedJobDetails.length
      ? completedJobDetails.reduce((sum: number, j: JobMetric) => sum + (j.queueTime || 0), 0) / completedJobDetails.length
      : 0;

    // Jobs by model
    const jobsByModel = await this.db.jobMetrics.groupBy({
      by: ['model'],
      where: {
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      _count: { id: true },
    });

    const modelStats = await Promise.all(
      jobsByModel.map(async (model: any) => {
        const modelJobs = await this.db.jobMetrics.findMany({
          where: {
            model: model.model,
            createdAt: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          },
          select: { status: true },
        });
        const successful = modelJobs.filter((j: any) => j.status === 'completed').length;
        return {
          model: model.model,
          count: model._count.id,
          successRate: model._count.id > 0 ? successful / model._count.id : 0,
        };
      })
    );

    const metrics = {
      period: `${timeRange.start.toISOString()}_${timeRange.end.toISOString()}`,
      totalJobs,
      completedJobs,
      failedJobs,
      cancelledJobs,
      completionRate: totalJobs > 0 ? completedJobs / totalJobs : 0,
      averageDuration: avgDuration,
      averageQueueTime: avgQueueTime,
      jobsByModel: modelStats,
    };

    await this.setCache(cacheKey, metrics, 300);
    return metrics;
  }

  // Helper methods
  private async getCache(key: string) {
    // Implement cache retrieval
    return null;
  }

  private async setCache(key: string, value: any, ttlSeconds: number) {
    // Implement cache storage
  }

  private groupByTimeBucket(items: any[], granularity: string): Map<string, any[]> {
    const buckets = new Map<string, any[]>();
    const bucketSize = this.getBucketSizeMs(granularity);

    items.forEach((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;
      const key = new Date(bucketKey).toISOString();
      
      const existing = buckets.get(key) || [];
      existing.push(item);
      buckets.set(key, existing);
    });

    return buckets;
  }

  private getBucketSizeMs(granularity: string): number {
    const sizes: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return sizes[granularity] || 5 * 60 * 1000;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private aggregateByTier(items: NodeMetric[]) {
    // Group by GPU tier and calculate utilization
    const tiers = ['H100', 'A100', 'RTX 4090', 'RTX 4080', 'RTX 3090', 'RTX 3080', 'Other'];
    return tiers.map((tier) => ({
      tier,
      count: Math.floor(items.length * Math.random()), // Replace with actual tier data
      utilization: Math.random() * 100,
    }));
  }

  private aggregateByRegion(items: NodeMetric[]) {
    const regions = ['us-east', 'us-west', 'eu-west', 'eu-central', 'ap-south', 'ap-northeast'];
    return regions.map((region) => ({
      region,
      utilization: Math.random() * 100,
      gpuCount: Math.floor(items.length / regions.length),
    }));
  }
}
