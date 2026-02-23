/**
 * Analytics Controller
 * HTTP request handlers for analytics endpoints
 */

import { Request, Response } from 'express';
import { NetworkAnalyticsService } from '../services/networkAnalytics';
import { EconomicAnalyticsService } from '../services/economicAnalytics';
import { PerformanceAnalyticsService } from '../services/performanceAnalytics';
import { LeaderboardService } from '../services/leaderboardService';

export class AnalyticsController {
  private networkService: NetworkAnalyticsService;
  private economicService: EconomicAnalyticsService;
  private performanceService: PerformanceAnalyticsService;
  private leaderboardService: LeaderboardService;

  constructor(db: any) {
    this.networkService = new NetworkAnalyticsService(db);
    this.economicService = new EconomicAnalyticsService(db);
    this.performanceService = new PerformanceAnalyticsService(db);
    this.leaderboardService = new LeaderboardService(db);
  }

  // ============================================================================
  // Network Analytics
  // ============================================================================

  async getNetworkStats(req: Request, res: Response) {
    try {
      const stats = await this.networkService.getNetworkStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch network stats' });
    }
  }

  async getGeographicDistribution(req: Request, res: Response) {
    try {
      const distribution = await this.networkService.getGeographicDistribution();
      res.json(distribution);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch geographic distribution' });
    }
  }

  async getGPUUtilization(req: Request, res: Response) {
    try {
      const range = this.parseTimeRange(req.query.range as string);
      const utilization = await this.networkService.getGPUUtilization(range);
      res.json(utilization);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch GPU utilization' });
    }
  }

  async getJobCompletionMetrics(req: Request, res: Response) {
    try {
      const range = this.parseTimeRange(req.query.period as string);
      const metrics = await this.networkService.getJobCompletionMetrics(range);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch job metrics' });
    }
  }

  // ============================================================================
  // Economic Metrics
  // ============================================================================

  async getTokenPrice(req: Request, res: Response) {
    try {
      const price = await this.economicService.getTokenPrice();
      res.json(price);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch token price' });
    }
  }

  async getPriceHistory(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const history = await this.economicService.getPriceHistory(days);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch price history' });
    }
  }

  async getTradingVolume(req: Request, res: Response) {
    try {
      const period = (req.query.period as string) || '24h';
      const volume = await this.economicService.getTradingVolume(period);
      res.json(volume);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trading volume' });
    }
  }

  async getEarningsDistribution(req: Request, res: Response) {
    try {
      const period = (req.query.period as string) || '24h';
      const distribution = await this.economicService.getEarningsDistribution(period);
      res.json(distribution);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch earnings distribution' });
    }
  }

  async getStakingPools(req: Request, res: Response) {
    try {
      const pools = await this.economicService.getStakingPools();
      res.json(pools);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch staking pools' });
    }
  }

  async calculateStaking(req: Request, res: Response) {
    try {
      const { amount, poolId, duration } = req.body;
      const calculation = await this.economicService.calculateStaking({
        amount,
        poolId,
        duration,
      });
      res.json(calculation);
    } catch (error) {
      res.status(500).json({ error: 'Failed to calculate staking rewards' });
    }
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  async getAPILatencies(req: Request, res: Response) {
    try {
      const range = this.parseTimeRange(req.query.range as string);
      const latencies = await this.performanceService.getAPILatencies(range);
      res.json(latencies);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch API latencies' });
    }
  }

  async getLatencyHeatmap(req: Request, res: Response) {
    try {
      const range = this.parseTimeRange(req.query.range as string);
      const endpoint = req.query.endpoint as string | undefined;
      const heatmap = await this.performanceService.getLatencyHeatmap(range, endpoint);
      res.json(heatmap);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch latency heatmap' });
    }
  }

  async getModelPerformance(req: Request, res: Response) {
    try {
      const performance = await this.performanceService.getModelPerformance();
      res.json(performance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch model performance' });
    }
  }

  async getErrorRates(req: Request, res: Response) {
    try {
      const range = this.parseTimeRange(req.query.range as string);
      const errors = await this.performanceService.getErrorRates(range);
      res.json(errors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch error rates' });
    }
  }

  async getCapacityForecast(req: Request, res: Response) {
    try {
      const forecast = await this.performanceService.getCapacityForecast();
      res.json(forecast);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch capacity forecast' });
    }
  }

  // ============================================================================
  // Leaderboards
  // ============================================================================

  async getEarningsLeaderboard(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const leaderboard = await this.leaderboardService.getEarningsLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch earnings leaderboard' });
    }
  }

  async getReliabilityLeaderboard(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const leaderboard = await this.leaderboardService.getReliabilityLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch reliability leaderboard' });
    }
  }

  async getSpeedLeaderboard(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const leaderboard = await this.leaderboardService.getSpeedLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch speed leaderboard' });
    }
  }

  async getRegionalPerformance(req: Request, res: Response) {
    try {
      const performance = await this.leaderboardService.getRegionalPerformance();
      res.json(performance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch regional performance' });
    }
  }

  // ============================================================================
  // System Health
  // ============================================================================

  async getSystemHealth(req: Request, res: Response) {
    try {
      // This would check various service health endpoints
      const health = {
        overall: 'healthy' as const,
        services: [
          { name: 'API Gateway', status: 'healthy' as const, latency: 25, uptime: 99.99, lastCheck: Date.now() },
          { name: 'Job Router', status: 'healthy' as const, latency: 15, uptime: 99.95, lastCheck: Date.now() },
          { name: 'Node Registry', status: 'healthy' as const, latency: 20, uptime: 99.98, lastCheck: Date.now() },
          { name: 'Payment Service', status: 'healthy' as const, latency: 30, uptime: 99.97, lastCheck: Date.now() },
          { name: 'Inference API', status: 'healthy' as const, latency: 45, uptime: 99.92, lastCheck: Date.now() },
        ],
        incidents: [],
      };
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch system health' });
    }
  }

  // ============================================================================
  // Alerts
  // ============================================================================

  async getAlerts(req: Request, res: Response) {
    try {
      // Fetch user alerts
      const alerts = [
        {
          id: '1',
          name: 'High Latency Alert',
          metric: 'api_latency',
          condition: 'gt',
          threshold: 1000,
          enabled: true,
          notifyChannels: ['email'],
        },
      ];
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  }

  async createAlert(req: Request, res: Response) {
    try {
      const alert = req.body;
      // Save alert to database
      res.status(201).json({ id: Date.now().toString(), ...alert });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create alert' });
    }
  }

  async updateAlert(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      // Update alert in database
      res.json({ id, ...updates });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update alert' });
    }
  }

  async deleteAlert(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Delete alert from database
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete alert' });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private parseTimeRange(range: string = '24h') {
    const now = new Date();
    let start: Date;
    let granularity: '1m' | '5m' | '15m' | '1h' | '1d' = '5m';

    switch (range) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        granularity = '1m';
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        granularity = '5m';
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        granularity = '1h';
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        granularity = '1d';
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        granularity = '1d';
        break;
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start, end: now, granularity };
  }
}
