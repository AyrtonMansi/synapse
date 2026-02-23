/**
 * Realtime Analytics Service
 * Handles real-time data streaming and WebSocket updates
 */

import { EventEmitter } from 'events';
import { AnalyticsEvent, AlertEvent } from '../types';

export class RealtimeAnalyticsService extends EventEmitter {
  private db: any;
  private connections: Map<string, any> = new Map();
  private metricsBuffer: Map<string, any[]> = new Map();
  private alertRules: Map<string, any> = new Map();

  constructor(db: any) {
    super();
    this.db = db;
    this.startMetricCollection();
  }

  /**
   * Subscribe a client to real-time updates
   */
  subscribe(clientId: string, channels: string[], socket: any) {
    this.connections.set(clientId, { socket, channels });
    
    // Send initial data
    channels.forEach((channel) => {
      this.sendInitialData(clientId, channel);
    });
  }

  /**
   * Unsubscribe a client
   */
  unsubscribe(clientId: string) {
    this.connections.delete(clientId);
  }

  /**
   * Broadcast metric update to subscribed clients
   */
  broadcast(channel: string, data: any) {
    this.connections.forEach((client, clientId) => {
      if (client.channels.includes(channel)) {
        client.socket.emit(channel, data);
      }
    });
  }

  /**
   * Process and store analytics event
   */
  async processEvent(event: AnalyticsEvent) {
    // Store event
    await this.storeEvent(event);

    // Check alert conditions
    await this.checkAlerts(event);

    // Broadcast to relevant channels
    this.broadcastEvent(event);
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: {
    id: string;
    metric: string;
    condition: 'gt' | 'lt' | 'eq';
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    channels: string[];
  }) {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string) {
    this.alertRules.delete(ruleId);
  }

  /**
   * Get live metrics snapshot
   */
  async getLiveMetrics(): Promise<{
    network: any;
    economic: any;
    performance: any;
    timestamp: number;
  }> {
    const [networkStats, tokenPrice, recentLatencies] = await Promise.all([
      this.getLatestNetworkStats(),
      this.getLatestTokenPrice(),
      this.getRecentLatencies(),
    ]);

    return {
      network: networkStats,
      economic: tokenPrice,
      performance: {
        avgLatency: recentLatencies.length > 0
          ? recentLatencies.reduce((sum, l) => sum + l, 0) / recentLatencies.length
          : 0,
        requestRate: recentLatencies.length,
      },
      timestamp: Date.now(),
    };
  }

  // Private methods

  private startMetricCollection() {
    // Collect metrics every 5 seconds
    setInterval(() => this.collectMetrics(), 5000);
    
    // Broadcast updates every 10 seconds
    setInterval(() => this.broadcastUpdates(), 10000);
  }

  private async collectMetrics() {
    try {
      // Collect network metrics
      const networkMetrics = await this.collectNetworkMetrics();
      this.bufferMetric('network', networkMetrics);

      // Collect performance metrics
      const performanceMetrics = await this.collectPerformanceMetrics();
      this.bufferMetric('performance', performanceMetrics);

      // Emit for internal processing
      this.emit('metrics:collected', {
        network: networkMetrics,
        performance: performanceMetrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async broadcastUpdates() {
    const metrics = await this.getLiveMetrics();
    
    this.broadcast('metrics:live', metrics);
    
    // Also broadcast specific channel updates
    this.broadcast('network:stats', metrics.network);
    this.broadcast('economic:price', metrics.economic);
    this.broadcast('performance:overview', metrics.performance);
  }

  private async collectNetworkMetrics() {
    const activeNodes = await this.db.nodes.count({ where: { status: 'active' } });
    const recentJobs = await this.db.jobMetrics.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    return {
      activeNodes,
      recentJobs,
      timestamp: Date.now(),
    };
  }

  private async collectPerformanceMetrics() {
    const recentRequests = await this.db.apiMetrics.findMany({
      where: {
        timestamp: { gte: new Date(Date.now() - 60000) },
      },
      select: { latency: true, statusCode: true },
    });

    const latencies = recentRequests.map((r: any) => r.latency);
    const errors = recentRequests.filter((r: any) => r.statusCode >= 400).length;

    return {
      requestCount: recentRequests.length,
      avgLatency: latencies.length > 0
        ? latencies.reduce((sum: number, l: number) => sum + l, 0) / latencies.length
        : 0,
      errorRate: recentRequests.length > 0 ? errors / recentRequests.length : 0,
      timestamp: Date.now(),
    };
  }

  private bufferMetric(type: string, data: any) {
    const buffer = this.metricsBuffer.get(type) || [];
    buffer.push(data);
    
    // Keep only last 1000 entries
    if (buffer.length > 1000) {
      buffer.shift();
    }
    
    this.metricsBuffer.set(type, buffer);
  }

  private async storeEvent(event: AnalyticsEvent) {
    await this.db.analyticsEvents.create({
      data: {
        type: event.type,
        timestamp: event.timestamp,
        data: event.data,
        metadata: event.metadata,
      },
    });
  }

  private async checkAlerts(event: AnalyticsEvent) {
    for (const [ruleId, rule] of this.alertRules) {
      if (event.type !== rule.metric) continue;

      const value = this.extractMetricValue(event.data, rule.metric);
      if (value === undefined) continue;

      let triggered = false;
      switch (rule.condition) {
        case 'gt':
          triggered = value > rule.threshold;
          break;
        case 'lt':
          triggered = value < rule.threshold;
          break;
        case 'eq':
          triggered = value === rule.threshold;
          break;
      }

      if (triggered) {
        const alert: AlertEvent = {
          alertId: ruleId,
          metric: rule.metric,
          threshold: rule.threshold,
          actualValue: value,
          severity: rule.severity,
          timestamp: new Date(),
        };

        this.emit('alert:triggered', alert);
        this.broadcast('alert', alert);

        // Store alert
        await this.db.alerts.create({
          data: {
            ruleId,
            severity: rule.severity,
            message: `Alert: ${rule.metric} ${rule.condition} ${rule.threshold} (actual: ${value})`,
            timestamp: new Date(),
          },
        });
      }
    }
  }

  private broadcastEvent(event: AnalyticsEvent) {
    // Map event types to channels
    const channelMap: Record<string, string[]> = {
      'job:completed': ['jobs', 'network'],
      'job:failed': ['jobs', 'network', 'alerts'],
      'node:joined': ['nodes', 'network'],
      'node:left': ['nodes', 'network'],
      'price:update': ['economic'],
      'api:request': ['performance'],
      'api:error': ['performance', 'alerts'],
    };

    const channels = channelMap[event.type] || ['all'];
    channels.forEach((channel) => {
      this.broadcast(channel, event);
    });
  }

  private sendInitialData(clientId: string, channel: string) {
    const client = this.connections.get(clientId);
    if (!client) return;

    // Send cached data based on channel
    const buffer = this.metricsBuffer.get(channel);
    if (buffer && buffer.length > 0) {
      client.socket.emit(`${channel}:history`, buffer.slice(-100));
    }
  }

  private extractMetricValue(data: any, metric: string): number | undefined {
    const parts = metric.split('.');
    let value = data;
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    return typeof value === 'number' ? value : undefined;
  }

  private async getLatestNetworkStats() {
    // Get from cache or query
    return {
      activeNodes: 0,
      totalJobs: 0,
    };
  }

  private async getLatestTokenPrice() {
    // Get from cache or query
    return {
      price: 0,
      change24h: 0,
    };
  }

  private async getRecentLatencies() {
    const metrics = await this.db.apiMetrics.findMany({
      where: {
        timestamp: { gte: new Date(Date.now() - 60000) },
      },
      select: { latency: true },
      take: 100,
    });
    return metrics.map((m: any) => m.latency);
  }
}
