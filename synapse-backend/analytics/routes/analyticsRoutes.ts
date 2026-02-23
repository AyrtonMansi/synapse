/**
 * Analytics Routes
 * API route definitions for analytics endpoints
 */

import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';

export const createAnalyticsRoutes = (db: any): Router => {
  const router = Router();
  const controller = new AnalyticsController(db);

  // ============================================================================
  // Network Analytics
  // ============================================================================

  router.get('/network/stats', (req, res) => controller.getNetworkStats(req, res));
  router.get('/network/geographic', (req, res) => controller.getGeographicDistribution(req, res));
  router.get('/network/gpu-utilization', (req, res) => controller.getGPUUtilization(req, res));
  router.get('/network/jobs', (req, res) => controller.getJobCompletionMetrics(req, res));

  // ============================================================================
  // Economic Metrics
  // ============================================================================

  router.get('/economics/price', (req, res) => controller.getTokenPrice(req, res));
  router.get('/economics/price-history', (req, res) => controller.getPriceHistory(req, res));
  router.get('/economics/volume', (req, res) => controller.getTradingVolume(req, res));
  router.get('/economics/earnings', (req, res) => controller.getEarningsDistribution(req, res));
  router.get('/economics/staking-pools', (req, res) => controller.getStakingPools(req, res));
  router.post('/economics/staking-calculate', (req, res) => controller.calculateStaking(req, res));

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  router.get('/performance/latency', (req, res) => controller.getAPILatencies(req, res));
  router.get('/performance/latency-heatmap', (req, res) => controller.getLatencyHeatmap(req, res));
  router.get('/performance/models', (req, res) => controller.getModelPerformance(req, res));
  router.get('/performance/errors', (req, res) => controller.getErrorRates(req, res));
  router.get('/performance/capacity-forecast', (req, res) => controller.getCapacityForecast(req, res));

  // ============================================================================
  // Leaderboards
  // ============================================================================

  router.get('/leaderboard/earnings', (req, res) => controller.getEarningsLeaderboard(req, res));
  router.get('/leaderboard/reliability', (req, res) => controller.getReliabilityLeaderboard(req, res));
  router.get('/leaderboard/speed', (req, res) => controller.getSpeedLeaderboard(req, res));
  router.get('/leaderboard/regional', (req, res) => controller.getRegionalPerformance(req, res));

  // ============================================================================
  // System Health
  // ============================================================================

  router.get('/health', (req, res) => controller.getSystemHealth(req, res));

  // ============================================================================
  // Alerts
  // ============================================================================

  router.get('/alerts', (req, res) => controller.getAlerts(req, res));
  router.post('/alerts', (req, res) => controller.createAlert(req, res));
  router.put('/alerts/:id', (req, res) => controller.updateAlert(req, res));
  router.delete('/alerts/:id', (req, res) => controller.deleteAlert(req, res));

  return router;
};
