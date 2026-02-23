/**
 * Node Service
 * Handles node operations and monitoring
 */

import axios from 'axios';
import {Node, NodeStatus, LogEntry, NodeLogs} from '@types/index';
import {logService} from './logService';

const API_BASE_URL = 'https://api.synapse.network/v1';

class NodeService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  async getNodes(): Promise<Node[]> {
    try {
      // Simulated data - replace with actual API call
      const mockNodes: Node[] = [
        {
          id: 'node-001',
          name: 'Main Validator',
          status: 'online',
          type: 'validator',
          version: '1.2.3',
          uptime: 86400 * 15, // 15 days
          cpuUsage: 45,
          memoryUsage: 62,
          diskUsage: 78,
          networkIn: 1024 * 1024 * 50,
          networkOut: 1024 * 1024 * 30,
          peersConnected: 24,
          lastSyncedBlock: 1547293,
          totalBlocks: 1547293,
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            city: 'San Francisco',
            country: 'USA',
          },
          rewards: 1250.5,
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'node-002',
          name: 'Backup Node',
          status: 'syncing',
          type: 'full',
          version: '1.2.3',
          uptime: 3600 * 4,
          cpuUsage: 32,
          memoryUsage: 48,
          diskUsage: 65,
          networkIn: 1024 * 1024 * 20,
          networkOut: 1024 * 1024 * 15,
          peersConnected: 18,
          lastSyncedBlock: 1547000,
          totalBlocks: 1547293,
          rewards: 875.25,
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: new Date().toISOString(),
        },
      ];

      logService.info('Fetched nodes', {count: mockNodes.length});
      return mockNodes;
    } catch (error) {
      logService.error('Failed to fetch nodes', error);
      throw error;
    }
  }

  async getNode(nodeId: string): Promise<Node> {
    try {
      const response = await this.api.get(`/nodes/${nodeId}`);
      return response.data;
    } catch (error) {
      logService.error(`Failed to fetch node ${nodeId}`, error);
      throw error;
    }
  }

  async startNode(nodeId: string): Promise<void> {
    try {
      await this.api.post(`/nodes/${nodeId}/start`);
      logService.info(`Node ${nodeId} started`);
    } catch (error) {
      logService.error(`Failed to start node ${nodeId}`, error);
      throw error;
    }
  }

  async stopNode(nodeId: string): Promise<void> {
    try {
      await this.api.post(`/nodes/${nodeId}/stop`);
      logService.info(`Node ${nodeId} stopped`);
    } catch (error) {
      logService.error(`Failed to stop node ${nodeId}`, error);
      throw error;
    }
  }

  async emergencyStopNode(nodeId: string): Promise<void> {
    try {
      // Emergency stop bypasses normal shutdown procedure
      await this.api.post(`/nodes/${nodeId}/emergency-stop`, {}, {
        timeout: 5000, // Short timeout for emergency
      });
      logService.info(`Node ${nodeId} emergency stopped`);
    } catch (error) {
      // Even if API fails, we consider it stopped for UI purposes
      logService.warn(`Emergency stop API failed for node ${nodeId}`, error);
      // Don't throw - this is an emergency
    }
  }

  async restartNode(nodeId: string): Promise<void> {
    try {
      await this.api.post(`/nodes/${nodeId}/restart`);
      logService.info(`Node ${nodeId} restarted`);
    } catch (error) {
      logService.error(`Failed to restart node ${nodeId}`, error);
      throw error;
    }
  }

  async updateSettings(nodeId: string, settings: any): Promise<void> {
    try {
      await this.api.put(`/nodes/${nodeId}/settings`, settings);
      logService.info(`Node ${nodeId} settings updated`);
    } catch (error) {
      logService.error(`Failed to update node ${nodeId} settings`, error);
      throw error;
    }
  }

  async getLogs(nodeId: string, limit: number = 100): Promise<LogEntry[]> {
    try {
      // Simulated logs - replace with actual API call
      const logs: LogEntry[] = [];
      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['info', 'info', 'debug', 'warn', 'info'];
      const messages = [
        'Block sync completed',
        'Connected to peer network',
        'Memory usage: 62%',
        'High latency detected on peer connection',
        'Transaction pool cleared',
        'New block added to chain',
        'Validator set updated',
        'Network consensus reached',
      ];

      for (let i = 0; i < limit; i++) {
        const timestamp = new Date(Date.now() - i * 60000).toISOString();
        logs.push({
          id: `log-${nodeId}-${i}`,
          timestamp,
          level: levels[Math.floor(Math.random() * levels.length)],
          message: messages[Math.floor(Math.random() * messages.length)],
          source: 'node-core',
          metadata: {
            nodeId,
            blockHeight: 1547293 - i,
          },
        });
      }

      return logs;
    } catch (error) {
      logService.error(`Failed to fetch logs for node ${nodeId}`, error);
      throw error;
    }
  }

  async getMetrics(nodeId: string): Promise<Partial<Node>> {
    try {
      const response = await this.api.get(`/nodes/${nodeId}/metrics`);
      return response.data;
    } catch (error) {
      logService.error(`Failed to fetch metrics for node ${nodeId}`, error);
      throw error;
    }
  }

  subscribeToUpdates(
    nodeId: string,
    callback: (metrics: Partial<Node>) => void,
  ): () => void {
    // In a real app, this would use WebSocket
    const interval = setInterval(async () => {
      try {
        const metrics = await this.getMetrics(nodeId);
        callback(metrics);
      } catch (error) {
        logService.error(`Failed to get metrics update for ${nodeId}`, error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }
}

export const nodeService = new NodeService();
