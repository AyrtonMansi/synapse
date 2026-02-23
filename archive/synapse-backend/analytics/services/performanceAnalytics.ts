/**
 * Performance Analytics Service
 * Handles API latency, model performance, and system capacity
 */

import { APIMetric, TimeRange } from '../types';

export class PerformanceAnalyticsService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Get API latency metrics
   */
  async getAPILatencies(timeRange: TimeRange): Promise<{
    timestamp: number;
    endpoint: string;
    method: string;
    p50: number;
    p95: number;
    p99: number;
    average: number;
    min: number;
    max: number;
    requestCount: number;
    errorCount: number;
  }[]> {
    const cacheKey = `performance:latency:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const metrics = await this.db.apiMetrics.findMany({
      where: {
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by time bucket and endpoint
    const buckets = this.groupByTimeAndEndpoint(metrics, timeRange.granularity);
    
    const latencies = Array.from(buckets.entries()).map(([key, items]) => {
      const [timestamp, endpoint, method] = key.split('|');
      const latencies = items.map((m: APIMetric) => m.latency);
      
      return {
        timestamp: new Date(timestamp).getTime(),
        endpoint,
        method,
        ...this.calculatePercentiles(latencies),
        requestCount: items.length,
        errorCount: items.filter((m: APIMetric) => m.statusCode >= 400).length,
      };
    });

    await this.setCache(cacheKey, latencies, 60);
    return latencies;
  }

  /**
   * Get latency heatmap data
   */
  async getLatencyHeatmap(
    timeRange: TimeRange,
    endpoint?: string
  ): Promise<{
    timeBucket: string;
    endpoint: string;
    latencies: number[];
    averageLatency: number;
    percentile95: number;
    errorRate: number;
  }[]> {
    const cacheKey = `performance:heatmap:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}:${endpoint || 'all'}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const where: any = {
      timestamp: {
        gte: timeRange.start,
        lte: timeRange.end,
      },
    };
    if (endpoint) {
      where.endpoint = endpoint;
    }

    const metrics = await this.db.apiMetrics.findMany({
      where,
      orderBy: { timestamp: 'asc' },
    });

    // Group by time bucket and endpoint
    const buckets = this.groupByTimeAndEndpoint(metrics, '15m');
    
    const heatmapData = Array.from(buckets.entries()).map(([key, items]) => {
      const [timeBucket, ep] = key.split('|');
      const latencies = items.map((m: APIMetric) => m.latency);
      const errors = items.filter((m: APIMetric) => m.statusCode >= 400).length;
      
      return {
        timeBucket,
        endpoint: ep,
        latencies,
        averageLatency: this.average(latencies),
        percentile95: this.calculatePercentile(latencies, 95),
        errorRate: errors / items.length,
      };
    });

    await this.setCache(cacheKey, heatmapData, 300);
    return heatmapData;
  }

  /**
   * Get model performance metrics
   */
  async getModelPerformance(): Promise<{
    model: string;
    version: string;
    totalRequests: number;
    averageLatency: number;
    p95Latency: number;
    tokensPerSecond: number;
    successRate: number;
    costPerToken: number;
    userSatisfaction: number;
    lastUpdated: number;
  }[]> {
    const cacheKey = 'performance:models';
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const jobs = await this.db.jobMetrics.findMany({
      where: {
        status: 'completed',
        completedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    // Group by model
    const modelGroups = new Map<string, any[]>();
    jobs.forEach((job: any) => {
      const existing = modelGroups.get(job.model) || [];
      existing.push(job);
      modelGroups.set(job.model, existing);
    });

    const models = await Promise.all(
      Array.from(modelGroups.entries()).map(async ([model, jobs]) => {
        const latencies = jobs.map((j: any) => j.duration);
        const totalTokens = jobs.reduce((sum: number, j: any) => sum + j.totalTokens, 0);
        const totalTime = jobs.reduce((sum: number, j: any) => sum + j.duration, 0);
        
        // Calculate user satisfaction from ratings
        const ratings = await this.db.jobRatings.findMany({
          where: {
            jobId: { in: jobs.map((j: any) => j.id) },
          },
        });
        const avgRating = ratings.length > 0
          ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length
          : 4.0;

        return {
          model,
          version: jobs[0]?.modelVersion || '1.0',
          totalRequests: jobs.length,
          averageLatency: this.average(latencies),
          p95Latency: this.calculatePercentile(latencies, 95),
          tokensPerSecond: totalTime > 0 ? totalTokens / (totalTime / 1000) : 0,
          successRate: jobs.length > 0 ? 1 : 0, // Calculate from actual success/failure
          costPerToken: 0.0001, // Get from pricing config
          userSatisfaction: avgRating / 5,
          lastUpdated: Date.now(),
        };
      })
    );

    await this.setCache(cacheKey, models, 300);
    return models;
  }

  /**
   * Get error rate metrics
   */
  async getErrorRates(timeRange: TimeRange): Promise<{
    timestamp: number;
    totalRequests: number;
    errorCount: number;
    errorRate: number;
    errorsByType: {
      type: string;
      count: number;
      percentage: number;
    }[];
    errorsByEndpoint: {
      endpoint: string;
      count: number;
      errorRate: number;
    }[];
  }[]> {
    const cacheKey = `performance:errors:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const metrics = await this.db.apiMetrics.findMany({
      where: {
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by time bucket
    const buckets = this.groupByTimeBucket(metrics, timeRange.granularity);
    
    const errorRates = Array.from(buckets.entries()).map(([timestamp, items]) => {
      const totalRequests = items.length;
      const errors = items.filter((m: APIMetric) => m.statusCode >= 400);
      const errorCount = errors.length;

      // Categorize errors
      const errorTypes = new Map<string, number>();
      errors.forEach((e: APIMetric) => {
        let type = 'other';
        if (e.statusCode >= 500) type = '5xx';
        else if (e.statusCode >= 400) type = '4xx';
        if (e.error?.includes('timeout')) type = 'timeout';
        if (e.error?.includes('rate limit')) type = 'rate_limit';
        
        errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
      });

      const errorsByType = Array.from(errorTypes.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: errorCount > 0 ? count / errorCount : 0,
      }));

      // Errors by endpoint
      const endpointErrors = new Map<string, { count: number; total: number }>();
      items.forEach((m: APIMetric) => {
        const current = endpointErrors.get(m.endpoint) || { count: 0, total: 0 };
        endpointErrors.set(m.endpoint, {
          count: current.count + (m.statusCode >= 400 ? 1 : 0),
          total: current.total + 1,
        });
      });

      const errorsByEndpoint = Array.from(endpointErrors.entries())
        .filter(([_, data]) => data.count > 0)
        .map(([endpoint, data]) => ({
          endpoint,
          count: data.count,
          errorRate: data.total > 0 ? data.count / data.total : 0,
        }));

      return {
        timestamp: new Date(timestamp).getTime(),
        totalRequests,
        errorCount,
        errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
        errorsByType,
        errorsByEndpoint,
      };
    });

    await this.setCache(cacheKey, errorRates, 60);
    return errorRates;
  }

  /**
   * Get capacity forecast
   */
  async getCapacityForecast(): Promise<{
    timestamp: number;
    currentCapacity: number;
    predictedCapacity: number[];
    confidence: number[];
    timeHorizon: string[];
    growthRate: number;
    recommendedActions: string[];
  }> {
    const cacheKey = 'performance:forecast';
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    // Get historical capacity data
    const historicalData = await this.db.capacityMetrics.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Get current capacity
    const currentCapacity = await this.calculateCurrentCapacity();

    // Simple linear regression for forecasting
    const forecast = this.forecastCapacity(historicalData, 30);

    const forecastData = {
      timestamp: Date.now(),
      currentCapacity,
      predictedCapacity: forecast.values,
      confidence: forecast.confidence,
      timeHorizon: forecast.dates,
      growthRate: forecast.growthRate,
      recommendedActions: this.generateRecommendations(currentCapacity, forecast),
    };

    await this.setCache(cacheKey, forecastData, 3600); // 1 hour TTL
    return forecastData;
  }

  // Helper methods
  private async calculateCurrentCapacity(): Promise<number> {
    const nodes = await this.db.nodes.count({ where: { status: 'active' } });
    const avgCapacity = await this.db.nodes.aggregate({
      where: { status: 'active' },
      _avg: { tflops: true },
    });
    return nodes * (avgCapacity._avg.tflops || 0);
  }

  private forecastCapacity(historicalData: any[], days: number) {
    // Simple trend-based forecasting
    const values: number[] = [];
    const confidence: number[] = [];
    const dates: string[] = [];
    
    // Calculate average growth rate
    const growthRate = historicalData.length > 1
      ? (historicalData[historicalData.length - 1].capacity - historicalData[0].capacity) / historicalData.length
      : 0;

    let lastValue = historicalData.length > 0 
      ? historicalData[historicalData.length - 1].capacity 
      : 1000;

    for (let i = 1; i <= days; i++) {
      const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split('T')[0]);
      
      // Predict with growth rate and some randomness
      lastValue = lastValue * (1 + growthRate / 100 + (Math.random() - 0.5) * 0.02);
      values.push(lastValue);
      
      // Confidence decreases with time
      confidence.push(Math.max(50, 95 - i * 1.5));
    }

    return { values, confidence, dates, growthRate: growthRate * 30 }; // Monthly growth
  }

  private generateRecommendations(
    currentCapacity: number,
    forecast: { values: number[]; growthRate: number }
  ): string[] {
    const recommendations: string[] = [];
    
    const maxPredicted = Math.max(...forecast.values);
    const capacityRatio = maxPredicted / currentCapacity;

    if (capacityRatio > 1.5) {
      recommendations.push('Scale up compute nodes in high-demand regions');
      recommendations.push('Consider increasing incentives for node operators');
    }
    
    if (forecast.growthRate > 10) {
      recommendations.push('Rapid growth detected - prepare for 2x capacity in 3 months');
    }
    
    if (capacityRatio < 0.8) {
      recommendations.push('Overcapacity detected - optimize resource allocation');
    }

    if (recommendations.length === 0) {
      recommendations.push('Capacity stable - maintain current operations');
    }

    return recommendations;
  }

  private groupByTimeAndEndpoint(items: any[], granularity: string): Map<string, any[]> {
    const buckets = new Map<string, any[]>();
    const bucketSize = this.getBucketSizeMs(granularity);

    items.forEach((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;
      const key = `${new Date(bucketKey).toISOString()}|${item.endpoint}|${item.method}`;
      
      const existing = buckets.get(key) || [];
      existing.push(item);
      buckets.set(key, existing);
    });

    return buckets;
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

  private calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number; average: number; min: number; max: number } {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      p50: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
      average: this.average(values),
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
    };
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private async getCache(key: string) {
    return null;
  }

  private async setCache(key: string, value: any, ttlSeconds: number) {
    // Implement cache
  }
}
