/**
 * Leaderboard Service
 * Handles leaderboard calculations and rankings
 */

import { JobMetric } from '../types';

export class LeaderboardService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Get top earners leaderboard
   */
  async getEarningsLeaderboard(limit: number = 100): Promise<{
    rank: number;
    nodeId: string;
    operator: string;
    name: string;
    score: number;
    earnings: string;
    jobsCompleted: number;
    uptime: number;
    region: string;
    tier: string;
    gpuModel: string;
    reputation: number;
    change24h: number;
  }[]> {
    const cacheKey = `leaderboard:earnings:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    // Get earnings in the last 7 days
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const earningsData = await this.db.jobMetrics.groupBy({
      by: ['nodeId'],
      where: {
        completedAt: { gte: startDate },
        status: 'completed',
      },
      _sum: { earnings: true },
      _count: { id: true },
    });

    // Get node details
    const nodeIds = earningsData.map((e: any) => e.nodeId);
    const nodes = await this.db.nodes.findMany({
      where: { id: { in: nodeIds } },
      include: { operator: true },
    });

    const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));

    // Get previous day's ranking for change calculation
    const previousRankings = await this.getPreviousRankings('earnings');

    // Calculate scores and sort
    const leaderboard = earningsData
      .map((e: any, index: number) => {
        const node = nodeMap.get(e.nodeId);
        if (!node) return null;

        const score = this.calculateEarningsScore(
          parseFloat(e._sum.earnings),
          e._count.id,
          node.uptime
        );

        const previousRank = previousRankings.get(e.nodeId);
        const change24h = previousRank ? previousRank - (index + 1) : 0;

        return {
          rank: index + 1,
          nodeId: e.nodeId,
          operator: node.operator.address,
          name: node.name,
          score,
          earnings: e._sum.earnings,
          jobsCompleted: e._count.id,
          uptime: node.uptime,
          region: node.region,
          tier: node.tier,
          gpuModel: node.gpuModel,
          reputation: node.reputation,
          change24h,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit)
      .map((entry: any, index: number) => ({ ...entry, rank: index + 1 }));

    await this.setCache(cacheKey, leaderboard, 300);
    await this.saveRankings('earnings', leaderboard);
    return leaderboard;
  }

  /**
   * Get reliability leaderboard
   */
  async getReliabilityLeaderboard(limit: number = 100): Promise<{
    rank: number;
    nodeId: string;
    operator: string;
    name: string;
    reliabilityScore: number;
    uptime: number;
    consecutiveSuccessfulJobs: number;
    failedJobs: number;
    averageResponseTime: number;
    lastFailure?: number;
    change24h: number;
  }[]> {
    const cacheKey = `leaderboard:reliability:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get job statistics for each node
    const jobStats = await this.db.jobMetrics.groupBy({
      by: ['nodeId', 'status'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: { id: true },
    });

    // Get node details with uptime
    const nodes = await this.db.nodes.findMany({
      where: { status: 'active' },
      include: { operator: true },
    });

    // Get previous rankings
    const previousRankings = await this.getPreviousRankings('reliability');

    const leaderboard = nodes
      .map((node: any, index: number) => {
        const nodeStats = jobStats.filter((s: any) => s.nodeId === node.id);
        const completed = nodeStats.find((s: any) => s.status === 'completed')?._count.id || 0;
        const failed = nodeStats.find((s: any) => s.status === 'failed')?._count.id || 0;
        const total = completed + failed;

        const reliabilityScore = total > 0 ? (completed / total) * 100 : 0;

        // Get consecutive successful jobs
        const consecutiveJobs = this.calculateConsecutiveJobs(node.id);

        // Get average response time
        const avgResponseTime = this.calculateAverageResponseTime(node.id);

        // Get last failure
        const lastFailure = this.getLastFailure(node.id);

        const previousRank = previousRankings.get(node.id);
        const change24h = previousRank ? previousRank - (index + 1) : 0;

        return {
          rank: index + 1,
          nodeId: node.id,
          operator: node.operator.address,
          name: node.name,
          reliabilityScore,
          uptime: node.uptime,
          consecutiveSuccessfulJobs: consecutiveJobs,
          failedJobs: failed,
          averageResponseTime: avgResponseTime,
          lastFailure,
          change24h,
        };
      })
      .sort((a: any, b: any) => b.reliabilityScore - a.reliabilityScore)
      .slice(0, limit)
      .map((entry: any, index: number) => ({ ...entry, rank: index + 1 }));

    await this.setCache(cacheKey, leaderboard, 300);
    await this.saveRankings('reliability', leaderboard);
    return leaderboard;
  }

  /**
   * Get speed leaderboard
   */
  async getSpeedLeaderboard(limit: number = 100): Promise<{
    rank: number;
    nodeId: string;
    operator: string;
    name: string;
    averageInferenceTime: number;
    fastestInferenceTime: number;
    tokensPerSecond: number;
    model: string;
    gpuModel: string;
    samples: number;
    change24h: number;
  }[]> {
    const cacheKey = `leaderboard:speed:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get inference times for completed jobs
    const jobMetrics = await this.db.jobMetrics.findMany({
      where: {
        completedAt: { gte: startDate },
        status: 'completed',
      },
      select: {
        nodeId: true,
        duration: true,
        totalTokens: true,
        model: true,
      },
    });

    // Group by node
    const nodeMetrics = new Map<string, any[]>();
    jobMetrics.forEach((job: any) => {
      const existing = nodeMetrics.get(job.nodeId) || [];
      existing.push(job);
      nodeMetrics.set(job.nodeId, existing);
    });

    // Get node details
    const nodeIds = Array.from(nodeMetrics.keys());
    const nodes = await this.db.nodes.findMany({
      where: { id: { in: nodeIds } },
      include: { operator: true },
    });

    const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));

    // Get previous rankings
    const previousRankings = await this.getPreviousRankings('speed');

    const leaderboard = Array.from(nodeMetrics.entries())
      .map(([nodeId, jobs], index) => {
        const node = nodeMap.get(nodeId);
        if (!node) return null;

        const durations = jobs.map((j: any) => j.duration);
        const totalTokens = jobs.reduce((sum: number, j: any) => sum + j.totalTokens, 0);
        const totalDuration = durations.reduce((sum: number, d: number) => sum + d, 0);

        const avgInference = this.average(durations);
        const fastestInference = Math.min(...durations);
        const tokensPerSec = totalDuration > 0 ? totalTokens / (totalDuration / 1000) : 0;

        const previousRank = previousRankings.get(nodeId);
        const change24h = previousRank ? previousRank - (index + 1) : 0;

        return {
          rank: index + 1,
          nodeId,
          operator: node.operator.address,
          name: node.name,
          averageInferenceTime: avgInference,
          fastestInferenceTime: fastestInference,
          tokensPerSecond: tokensPerSec,
          model: jobs[0]?.model || 'unknown',
          gpuModel: node.gpuModel,
          samples: jobs.length,
          change24h,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.averageInferenceTime - b.averageInferenceTime)
      .slice(0, limit)
      .map((entry: any, index: number) => ({ ...entry, rank: index + 1 }));

    await this.setCache(cacheKey, leaderboard, 300);
    await this.saveRankings('speed', leaderboard);
    return leaderboard;
  }

  /**
   * Get regional performance
   */
  async getRegionalPerformance(): Promise<{
    region: string;
    rank: number;
    nodeCount: number;
    averageUptime: number;
    averageLatency: number;
    totalJobs: number;
    totalEarnings: string;
    growthRate: number;
    status: 'expanding' | 'stable' | 'declining';
  }[]> {
    const cacheKey = 'leaderboard:regional';
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get nodes grouped by region
    const regions = await this.db.nodes.groupBy({
      by: ['region'],
      _count: { id: true },
      _avg: { uptime: true },
    });

    // Get job metrics by region
    const regionJobs = await this.db.jobMetrics.findMany({
      where: {
        completedAt: { gte: startDate },
        status: 'completed',
      },
      select: {
        nodeId: true,
        duration: true,
        earnings: true,
      },
    });

    // Get node regions
    const nodeIds = regionJobs.map((j: any) => j.nodeId);
    const nodes = await this.db.nodes.findMany({
      where: { id: { in: nodeIds } },
      select: { id: true, region: true },
    });
    const nodeRegions = new Map(nodes.map((n: any) => [n.id, n.region]));

    // Aggregate by region
    const regionStats = new Map<string, { jobs: number; earnings: number; latency: number[] }>();
    regionJobs.forEach((job: any) => {
      const region = nodeRegions.get(job.nodeId) || 'unknown';
      const current = regionStats.get(region) || { jobs: 0, earnings: 0, latency: [] };
      regionStats.set(region, {
        jobs: current.jobs + 1,
        earnings: current.earnings + parseFloat(job.earnings),
        latency: [...current.latency, job.duration],
      });
    });

    // Calculate growth (compare with previous period)
    const previousStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousJobs = await this.db.jobMetrics.count({
      where: {
        completedAt: {
          gte: previousStartDate,
          lt: startDate,
        },
        status: 'completed',
      },
    });
    const currentJobs = regionJobs.length;
    const growthRate = previousJobs > 0 ? ((currentJobs - previousJobs) / previousJobs) * 100 : 0;

    const leaderboard = regions
      .map((region: any, index: number) => {
        const stats = regionStats.get(region.region) || { jobs: 0, earnings: 0, latency: [] };
        const avgLatency = stats.latency.length > 0
          ? stats.latency.reduce((sum: number, l: number) => sum + l, 0) / stats.latency.length
          : 0;

        let status: 'expanding' | 'stable' | 'declining' = 'stable';
        if (growthRate > 10) status = 'expanding';
        else if (growthRate < -10) status = 'declining';

        return {
          region: region.region,
          rank: index + 1,
          nodeCount: region._count.id,
          averageUptime: region._avg.uptime || 0,
          averageLatency: avgLatency,
          totalJobs: stats.jobs,
          totalEarnings: stats.earnings.toFixed(6),
          growthRate,
          status,
        };
      })
      .sort((a: any, b: any) => b.totalJobs - a.totalJobs)
      .map((entry: any, index: number) => ({ ...entry, rank: index + 1 }));

    await this.setCache(cacheKey, leaderboard, 600);
    return leaderboard;
  }

  // Helper methods
  private calculateEarningsScore(earnings: number, jobs: number, uptime: number): number {
    const earningsWeight = 0.5;
    const jobsWeight = 0.3;
    const uptimeWeight = 0.2;

    const normalizedEarnings = Math.log(earnings + 1) * 10;
    const normalizedJobs = Math.log(jobs + 1) * 5;
    const normalizedUptime = uptime;

    return (
      normalizedEarnings * earningsWeight +
      normalizedJobs * jobsWeight +
      normalizedUptime * uptimeWeight
    );
  }

  private async calculateConsecutiveJobs(nodeId: string): Promise<number> {
    const jobs = await this.db.jobMetrics.findMany({
      where: { nodeId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { status: true },
    });

    let consecutive = 0;
    for (const job of jobs) {
      if (job.status === 'completed') {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }

  private async calculateAverageResponseTime(nodeId: string): Promise<number> {
    const jobs = await this.db.jobMetrics.findMany({
      where: {
        nodeId,
        status: 'completed',
      },
      take: 100,
      select: { queueTime: true },
    });

    if (jobs.length === 0) return 0;
    return jobs.reduce((sum: number, j: any) => sum + (j.queueTime || 0), 0) / jobs.length;
  }

  private async getLastFailure(nodeId: string): Promise<number | undefined> {
    const failure = await this.db.jobMetrics.findFirst({
      where: {
        nodeId,
        status: 'failed',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return failure ? new Date(failure.createdAt).getTime() : undefined;
  }

  private async getPreviousRankings(type: string): Promise<Map<string, number>> {
    // Get rankings from 24 hours ago
    const rankings = new Map<string, number>();
    // Implementation would query historical ranking data
    return rankings;
  }

  private async saveRankings(type: string, leaderboard: any[]) {
    // Save current rankings for change tracking
    // Implementation would store rankings in database
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
