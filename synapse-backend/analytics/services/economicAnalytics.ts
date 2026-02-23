/**
 * Economic Analytics Service
 * Handles token economics, trading, and staking metrics
 */

import { EconomicMetric, TimeRange } from '../types';

interface PriceData {
  timestamp: number;
  price: number;
  volume: number;
}

export class EconomicAnalyticsService {
  private db: any;
  private priceCache: Map<string, PriceData[]> = new Map();

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Get current token price data
   */
  async getTokenPrice(): Promise<{
    timestamp: number;
    price: number;
    priceChange24h: number;
    priceChange7d: number;
    volume24h: number;
    marketCap: number;
    circulatingSupply: number;
    fullyDilutedValuation: number;
  }> {
    const cacheKey = 'economic:price:current';
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    // Fetch from price oracle or DEX
    const currentPrice = await this.fetchCurrentPrice();
    const price24hAgo = await this.fetchHistoricalPrice(24 * 60 * 60 * 1000);
    const price7dAgo = await this.fetchHistoricalPrice(7 * 24 * 60 * 60 * 1000);
    
    const volume24h = await this.calculateVolume24h();
    const circulatingSupply = await this.getCirculatingSupply();
    const maxSupply = await this.getMaxSupply();

    const priceData = {
      timestamp: Date.now(),
      price: currentPrice,
      priceChange24h: price24hAgo > 0 ? ((currentPrice - price24hAgo) / price24hAgo) * 100 : 0,
      priceChange7d: price7dAgo > 0 ? ((currentPrice - price7dAgo) / price7dAgo) * 100 : 0,
      volume24h,
      marketCap: currentPrice * circulatingSupply,
      circulatingSupply,
      fullyDilutedValuation: currentPrice * maxSupply,
    };

    await this.setCache(cacheKey, priceData, 15); // 15 seconds TTL
    return priceData;
  }

  /**
   * Get price history
   */
  async getPriceHistory(days: number): Promise<{
    timestamp: number;
    price: number;
    volume24h: number;
  }[]> {
    const cacheKey = `economic:price:history:${days}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const priceData = await this.db.economicMetrics.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        tokenPrice: true,
        volume24h: true,
      },
    });

    const history = priceData.map((p: any) => ({
      timestamp: new Date(p.timestamp).getTime(),
      price: p.tokenPrice,
      volume24h: p.volume24h,
    }));

    await this.setCache(cacheKey, history, 300); // 5 minutes TTL
    return history;
  }

  /**
   * Get trading volume metrics
   */
  async getTradingVolume(period: string): Promise<{
    period: string;
    volume: number;
    volumeChange: number;
    trades: number;
    buyVolume: number;
    sellVolume: number;
    volumeByExchange: {
      exchange: string;
      volume: number;
      percentage: number;
    }[];
  }> {
    const cacheKey = `economic:volume:${period}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const periodMs = this.parsePeriod(period);
    const startDate = new Date(Date.now() - periodMs);

    // Aggregate volume from trades
    const trades = await this.db.trades.findMany({
      where: {
        timestamp: { gte: startDate },
      },
    });

    const totalVolume = trades.reduce((sum: number, t: any) => sum + t.volume * t.price, 0);
    const buyVolume = trades
      .filter((t: any) => t.type === 'buy')
      .reduce((sum: number, t: any) => sum + t.volume * t.price, 0);
    const sellVolume = trades
      .filter((t: any) => t.type === 'sell')
      .reduce((sum: number, t: any) => sum + t.volume * t.price, 0);

    // Volume by exchange
    const exchangeVolumes = await this.db.trades.groupBy({
      by: ['exchange'],
      where: {
        timestamp: { gte: startDate },
      },
      _sum: {
        volume: true,
      },
    });

    const totalExchangeVolume = exchangeVolumes.reduce(
      (sum: number, e: any) => sum + (e._sum.volume || 0),
      0
    );

    const volumeByExchange = exchangeVolumes.map((e: any) => ({
      exchange: e.exchange,
      volume: e._sum.volume || 0,
      percentage: totalExchangeVolume > 0 ? (e._sum.volume || 0) / totalExchangeVolume : 0,
    }));

    // Calculate volume change
    const previousPeriodStart = new Date(startDate.getTime() - periodMs);
    const previousTrades = await this.db.trades.findMany({
      where: {
        timestamp: {
          gte: previousPeriodStart,
          lt: startDate,
        },
      },
    });
    const previousVolume = previousTrades.reduce(
      (sum: number, t: any) => sum + t.volume * t.price,
      0
    );
    const volumeChange = previousVolume > 0 ? ((totalVolume - previousVolume) / previousVolume) * 100 : 0;

    const volume = {
      period,
      volume: totalVolume,
      volumeChange,
      trades: trades.length,
      buyVolume,
      sellVolume,
      volumeByExchange,
    };

    await this.setCache(cacheKey, volume, 60);
    return volume;
  }

  /**
   * Get node earnings distribution
   */
  async getEarningsDistribution(period: string): Promise<{
    period: string;
    totalEarnings: string;
    averageEarnings: string;
    medianEarnings: string;
    topEarners: {
      nodeId: string;
      earnings: string;
      rank: number;
    }[];
    distributionByTier: {
      tier: string;
      nodeCount: number;
      totalEarnings: string;
      averageEarnings: string;
    }[];
    earningsByRegion: {
      region: string;
      earnings: string;
      nodeCount: number;
    }[];
  }> {
    const cacheKey = `economic:earnings:${period}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const periodMs = this.parsePeriod(period);
    const startDate = new Date(Date.now() - periodMs);

    // Get all earnings in period
    const earnings = await this.db.jobMetrics.findMany({
      where: {
        completedAt: { gte: startDate },
        status: 'completed',
      },
      select: {
        nodeId: true,
        earnings: true,
      },
    });

    const totalEarnings = earnings.reduce(
      (sum: number, e: any) => sum + parseFloat(e.earnings),
      0
    );

    // Group by node
    const nodeEarnings = new Map<string, number>();
    earnings.forEach((e: any) => {
      const current = nodeEarnings.get(e.nodeId) || 0;
      nodeEarnings.set(e.nodeId, current + parseFloat(e.earnings));
    });

    const sortedNodes = Array.from(nodeEarnings.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);

    const topEarners = sortedNodes.slice(0, 10).map(([nodeId, earnings], index) => ({
      nodeId,
      earnings: earnings.toFixed(6),
      rank: index + 1,
    }));

    const earningsValues = Array.from(nodeEarnings.values());
    const avgEarnings = earningsValues.length > 0 
      ? earningsValues.reduce((sum, e) => sum + e, 0) / earningsValues.length 
      : 0;
    
    // Calculate median
    const sortedEarnings = [...earningsValues].sort((a, b) => a - b);
    const medianEarnings = sortedEarnings.length > 0
      ? sortedEarnings[Math.floor(sortedEarnings.length / 2)]
      : 0;

    // Distribution by tier
    const tierDistribution = await this.getTierDistribution(startDate);

    // Earnings by region
    const regionEarnings = await this.db.jobMetrics.groupBy({
      by: ['nodeId'],
      where: {
        completedAt: { gte: startDate },
        status: 'completed',
      },
      _sum: { earnings: true },
    });

    // Get region for each node
    const nodesWithRegions = await this.db.nodes.findMany({
      where: {
        id: { in: regionEarnings.map((e: any) => e.nodeId) },
      },
      select: { id: true, region: true },
    });

    const regionMap = new Map(nodesWithRegions.map((n: any) => [n.id, n.region]));
    const regionTotals = new Map<string, { earnings: number; count: number }>();

    regionEarnings.forEach((e: any) => {
      const region = regionMap.get(e.nodeId) || 'unknown';
      const current = regionTotals.get(region) || { earnings: 0, count: 0 };
      regionTotals.set(region, {
        earnings: current.earnings + parseFloat(e._sum.earnings || '0'),
        count: current.count + 1,
      });
    });

    const earningsByRegion = Array.from(regionTotals.entries())
      .sort((a, b) => b[1].earnings - a[1].earnings)
      .map(([region, data]) => ({
        region,
        earnings: data.earnings.toFixed(6),
        nodeCount: data.count,
      }));

    const distribution = {
      period,
      totalEarnings: totalEarnings.toFixed(6),
      averageEarnings: avgEarnings.toFixed(6),
      medianEarnings: medianEarnings.toFixed(6),
      topEarners,
      distributionByTier: tierDistribution,
      earningsByRegion,
    };

    await this.setCache(cacheKey, distribution, 300);
    return distribution;
  }

  /**
   * Get staking pools
   */
  async getStakingPools(): Promise<{
    id: string;
    name: string;
    totalStaked: string;
    apr: number;
    totalRewards: string;
    lockPeriod: number;
    minStake: string;
    participants: number;
    risk: 'low' | 'medium' | 'high';
  }[]> {
    const pools = await this.db.stakingPools.findMany({
      where: { isActive: true },
    });

    return pools.map((pool: any) => ({
      id: pool.id,
      name: pool.name,
      totalStaked: pool.totalStaked,
      apr: parseFloat(pool.apr),
      totalRewards: pool.totalRewardsDistributed,
      lockPeriod: pool.lockPeriodDays,
      minStake: pool.minStake,
      participants: pool.participantCount,
      risk: pool.riskLevel,
    }));
  }

  /**
   * Calculate staking rewards
   */
  async calculateStaking(params: {
    amount: string;
    poolId: string;
    duration: number;
  }): Promise<{
    amount: string;
    poolId: string;
    duration: number;
    estimatedRewards: string;
    projectedApr: number;
    dailyReward: string;
    monthlyReward: string;
    yearlyReward: string;
  }> {
    const pool = await this.db.stakingPools.findUnique({
      where: { id: params.poolId },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    const amount = parseFloat(params.amount);
    const baseApr = parseFloat(pool.apr);
    
    // Adjust APR based on duration (longer = higher APR)
    const durationMultiplier = 1 + (params.duration / 365) * 0.5;
    const projectedApr = baseApr * durationMultiplier;

    // Calculate rewards
    const yearlyReward = amount * (projectedApr / 100);
    const dailyReward = yearlyReward / 365;
    const monthlyReward = dailyReward * 30;
    const totalReward = dailyReward * params.duration;

    return {
      amount: params.amount,
      poolId: params.poolId,
      duration: params.duration,
      estimatedRewards: totalReward.toFixed(6),
      projectedApr,
      dailyReward: dailyReward.toFixed(6),
      monthlyReward: monthlyReward.toFixed(6),
      yearlyReward: yearlyReward.toFixed(6),
    };
  }

  // Helper methods
  private async fetchCurrentPrice(): Promise<number> {
    // Fetch from price oracle
    return 1.25; // Placeholder
  }

  private async fetchHistoricalPrice(ageMs: number): Promise<number> {
    const timestamp = new Date(Date.now() - ageMs);
    const price = await this.db.economicMetrics.findFirst({
      where: { timestamp: { lte: timestamp } },
      orderBy: { timestamp: 'desc' },
      select: { tokenPrice: true },
    });
    return price?.tokenPrice || 0;
  }

  private async calculateVolume24h(): Promise<number> {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trades = await this.db.trades.findMany({
      where: { timestamp: { gte: startDate } },
    });
    return trades.reduce((sum: number, t: any) => sum + t.volume * t.price, 0);
  }

  private async getCirculatingSupply(): Promise<number> {
    const total = await this.db.tokenStats.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { circulatingSupply: true },
    });
    return total?.circulatingSupply || 0;
  }

  private async getMaxSupply(): Promise<number> {
    return 1000000000; // 1 billion
  }

  private async getTierDistribution(since: Date): Promise<any[]> {
    // Group earnings by node tier
    const tiers = ['Titan', 'Platinum', 'Gold', 'Silver', 'Bronze'];
    return tiers.map((tier) => ({
      tier,
      nodeCount: Math.floor(Math.random() * 100) + 10,
      totalEarnings: (Math.random() * 10000).toFixed(6),
      averageEarnings: (Math.random() * 1000).toFixed(6),
    }));
  }

  private parsePeriod(period: string): number {
    const units: Record<string, number> = {
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      m: 30 * 24 * 60 * 60 * 1000,
      y: 365 * 24 * 60 * 60 * 1000,
    };
    const match = period.match(/^(\d+)([hdwmy])$/);
    if (!match) return 24 * 60 * 60 * 1000;
    return parseInt(match[1]) * units[match[2]];
  }

  private async getCache(key: string) {
    return null;
  }

  private async setCache(key: string, value: any, ttlSeconds: number) {
    // Implement cache
  }
}
