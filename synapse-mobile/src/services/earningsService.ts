/**
 * Earnings Service
 * Handles earnings tracking and reward claims
 */

import axios from 'axios';
import {
  EarningsData,
  DailyEarning,
  MonthlyEarning,
} from '@types/index';
import {logService} from './logService';

const API_BASE_URL = 'https://api.synapse.network/v1';

class EarningsService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  async getEarnings(
    walletAddress: string,
    currency: string = 'SYN',
  ): Promise<EarningsData> {
    try {
      // Simulated data - replace with actual API call
      const earnings: EarningsData = {
        totalEarned: 45250.75,
        pendingRewards: 1250.5,
        claimedRewards: 44000.25,
        currency,
        dailyEarnings: this.generateDailyEarnings(30),
        monthlyEarnings: this.generateMonthlyEarnings(12),
      };

      logService.info('Fetched earnings', {walletAddress, currency});
      return earnings;
    } catch (error) {
      logService.error('Failed to fetch earnings', error);
      throw error;
    }
  }

  async getDailyEarnings(
    walletAddress: string,
    days: number = 30,
  ): Promise<DailyEarning[]> {
    try {
      return this.generateDailyEarnings(days);
    } catch (error) {
      logService.error('Failed to fetch daily earnings', error);
      throw error;
    }
  }

  async getMonthlyEarnings(
    walletAddress: string,
    months: number = 12,
  ): Promise<MonthlyEarning[]> {
    try {
      return this.generateMonthlyEarnings(months);
    } catch (error) {
      logService.error('Failed to fetch monthly earnings', error);
      throw error;
    }
  }

  async claimRewards(
    walletAddress: string,
    amount?: number,
  ): Promise<{amountClaimed: number; transactionHash: string}> {
    try {
      // In real implementation, this would:
      // 1. Create a transaction to claim rewards
      // 2. Sign it with the connected wallet
      // 3. Broadcast to the network

      const amountClaimed = amount || 1250.5;

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      logService.info('Rewards claimed', {walletAddress, amount: amountClaimed});

      return {
        amountClaimed,
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      };
    } catch (error) {
      logService.error('Failed to claim rewards', error);
      throw error;
    }
  }

  async getRewardHistory(
    walletAddress: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<any[]> {
    try {
      const response = await this.api.get(
        `/earnings/${walletAddress}/history?page=${page}&limit=${limit}`,
      );
      return response.data;
    } catch (error) {
      logService.error('Failed to fetch reward history', error);
      throw error;
    }
  }

  async getProjectedEarnings(
    walletAddress: string,
    days: number = 30,
  ): Promise<{total: number; daily: number}> {
    try {
      // Calculate based on current performance
      const response = await this.api.get(
        `/earnings/${walletAddress}/projected?days=${days}`,
      );
      return response.data;
    } catch (error) {
      logService.error('Failed to fetch projected earnings', error);
      throw error;
    }
  }

  private generateDailyEarnings(days: number): DailyEarning[] {
    const earnings: DailyEarning[] = [];
    const baseAmount = 40;

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Add some variation
      const variation = (Math.random() - 0.5) * 20;
      const amount = Math.max(0, baseAmount + variation);

      earnings.push({
        date: date.toISOString().split('T')[0],
        amount: Number(amount.toFixed(2)),
        nodes: Math.floor(Math.random() * 3) + 1,
      });
    }

    return earnings.reverse();
  }

  private generateMonthlyEarnings(months: number): MonthlyEarning[] {
    const earnings: MonthlyEarning[] = [];
    const baseAmount = 1200;

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const variation = (Math.random() - 0.5) * 400;
      const amount = Math.max(0, baseAmount + variation);
      const prevAmount = i > 0 ? earnings[i - 1]?.amount || baseAmount : baseAmount;
      const growth = ((amount - prevAmount) / prevAmount) * 100;

      earnings.unshift({
        month: date.toISOString().slice(0, 7),
        amount: Number(amount.toFixed(2)),
        growth: Number(growth.toFixed(2)),
      });
    }

    return earnings;
  }
}

export const earningsService = new EarningsService();
