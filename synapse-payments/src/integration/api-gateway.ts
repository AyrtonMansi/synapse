/**
 * API Gateway Integration
 * 
 * @module synapse-payments/integration/api-gateway
 * @description Integration utilities for Synapse API Gateway
 */

import axios from 'axios';
import { logger } from '../index';

export interface ApiGatewayConfig {
  baseUrl: string;
  apiKey: string;
}

export class ApiGatewayIntegration {
  private config: ApiGatewayConfig;
  private client: any;

  constructor(config: ApiGatewayConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Sync user tier with API Gateway
   */
  async syncUserTier(userId: string, tier: string): Promise<void> {
    try {
      await this.client.post('/users/sync-tier', {
        userId,
        tier,
      });
      
      logger.info('User tier synced with API Gateway', { userId, tier });
    } catch (error) {
      logger.error('Failed to sync user tier:', error);
      throw error;
    }
  }

  /**
   * Notify API Gateway of credit update
   */
  async notifyCreditUpdate(userId: string, balance: number): Promise<void> {
    try {
      await this.client.post('/users/credit-update', {
        userId,
        balance,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to notify credit update:', error);
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    userId?: string;
    tier?: string;
  }> {
    try {
      const response = await this.client.post('/auth/validate-key', {
        apiKey,
      });
      
      return response.data;
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Report job completion with credit usage
   */
  async reportJobCompletion(
    jobId: string,
    userId: string,
    creditsUsed: number
  ): Promise<void> {
    try {
      await this.client.post('/jobs/completed', {
        jobId,
        userId,
        creditsUsed,
      });
    } catch (error) {
      logger.error('Failed to report job completion:', error);
    }
  }
}