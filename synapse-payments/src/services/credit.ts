/**
 * Credit Service
 * 
 * @module synapse-payments/services/credit
 * @description Manages credit balances, transactions, and quota enforcement
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../index';
import type { CreditBalance, CreditTransaction, CreditPackage, UserTier } from '../types';

export interface CreditConfig {
  creditsPerUsd: number;
  kycThreshold: number;
  maxPurchaseWithoutKyc: number;
}

export class CreditService {
  private config: CreditConfig;
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(config: CreditConfig, prisma: PrismaClient, redis: Redis) {
    this.config = config;
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Get user's credit balance
   */
  async getBalance(userId: string): Promise<CreditBalance> {
    // Try cache first
    const cached = await this.getCachedBalance(userId);
    if (cached) {
      return cached;
    }

    // Get from database
    let balance = await this.prisma.creditBalance.findUnique({
      where: { userId },
    });

    // Create if doesn't exist
    if (!balance) {
      balance = await this.prisma.creditBalance.create({
        data: {
          userId,
          totalCredits: 0,
          availableCredits: 0,
          reservedCredits: 0,
          lifetimePurchased: 0,
          lifetimeUsed: 0,
        },
      });
    }

    const result: CreditBalance = {
      userId: balance.userId,
      totalCredits: balance.totalCredits,
      availableCredits: balance.availableCredits,
      reservedCredits: balance.reservedCredits,
      lifetimePurchased: balance.lifetimePurchased,
      lifetimeUsed: balance.lifetimeUsed,
      lastPurchaseAt: balance.lastPurchaseAt || undefined,
      updatedAt: balance.updatedAt,
    };

    // Cache the result
    await this.cacheBalance(userId, result);

    return result;
  }

  /**
   * Add credits to user's balance
   */
  async addCredits(
    userId: string,
    amount: number,
    type: 'purchase' | 'bonus' | 'subscription' | 'promo' | 'adjustment',
    description: string,
    paymentId?: string
  ): Promise<CreditBalance> {
    // Validate KYC if needed
    if (type === 'purchase') {
      const kycCheck = await this.validateKycForPurchase(userId, amount);
      if (!kycCheck.valid) {
        throw new Error(kycCheck.reason);
      }
    }

    // Update balance
    const balance = await this.prisma.creditBalance.upsert({
      where: { userId },
      create: {
        userId,
        totalCredits: amount,
        availableCredits: amount,
        reservedCredits: 0,
        lifetimePurchased: type === 'purchase' || type === 'subscription' ? amount : 0,
        lifetimeUsed: 0,
        lastPurchaseAt: new Date(),
      },
      update: {
        totalCredits: { increment: amount },
        availableCredits: { increment: amount },
        lifetimePurchased:
          type === 'purchase' || type === 'subscription'
            ? { increment: amount }
            : undefined,
        lastPurchaseAt: new Date(),
      },
    });

    // Create transaction record
    await this.prisma.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceAfter: balance.totalCredits,
        paymentId,
        description,
      },
    });

    // Invalidate cache
    await this.invalidateBalanceCache(userId);

    logger.info('Credits added', {
      userId,
      amount,
      type,
      newBalance: balance.totalCredits,
    });

    return this.getBalance(userId);
  }

  /**
   * Deduct credits (for API usage)
   */
  async deductCredits(
    userId: string,
    amount: number,
    description: string,
    jobId?: string
  ): Promise<{ success: boolean; balance: CreditBalance; error?: string }> {
    // Check balance
    const currentBalance = await this.getBalance(userId);
    if (currentBalance.availableCredits < amount) {
      return {
        success: false,
        balance: currentBalance,
        error: 'Insufficient credits',
      };
    }

    // Update balance
    const balance = await this.prisma.creditBalance.update({
      where: { userId },
      data: {
        totalCredits: { decrement: amount },
        availableCredits: { decrement: amount },
        lifetimeUsed: { increment: amount },
      },
    });

    // Create transaction record
    await this.prisma.creditTransaction.create({
      data: {
        userId,
        type: 'usage',
        amount: -amount,
        balanceAfter: balance.totalCredits,
        jobId,
        description,
      },
    });

    // Invalidate cache
    await this.invalidateBalanceCache(userId);

    logger.info('Credits deducted', {
      userId,
      amount,
      newBalance: balance.totalCredits,
      jobId,
    });

    return {
      success: true,
      balance: await this.getBalance(userId),
    };
  }

  /**
   * Reserve credits for a pending operation
   */
  async reserveCredits(
    userId: string,
    amount: number,
    operationId: string
  ): Promise<{ success: boolean; reservationId?: string; error?: string }> {
    const balance = await this.getBalance(userId);

    if (balance.availableCredits < amount) {
      return {
        success: false,
        error: 'Insufficient credits',
      };
    }

    // Reserve in Redis (with TTL)
    const reservationId = `res:${userId}:${operationId}`;
    await this.redis.setex(
      reservationId,
      300, // 5 minute TTL
      JSON.stringify({ amount, timestamp: Date.now() })
    );

    // Update database
    await this.prisma.creditBalance.update({
      where: { userId },
      data: {
        availableCredits: { decrement: amount },
        reservedCredits: { increment: amount },
      },
    });

    // Invalidate cache
    await this.invalidateBalanceCache(userId);

    logger.info('Credits reserved', {
      userId,
      amount,
      reservationId,
    });

    return { success: true, reservationId };
  }

  /**
   * Release reserved credits
   */
  async releaseReservation(reservationId: string): Promise<void> {
    const data = await this.redis.get(reservationId);
    if (!data) return;

    const { amount } = JSON.parse(data);
    const [, userId] = reservationId.split(':');

    // Update database
    await this.prisma.creditBalance.update({
      where: { userId },
      data: {
        availableCredits: { increment: amount },
        reservedCredits: { decrement: amount },
      },
    });

    // Remove from Redis
    await this.redis.del(reservationId);

    // Invalidate cache
    await this.invalidateBalanceCache(userId);

    logger.info('Reservation released', { reservationId, userId, amount });
  }

  /**
   * Commit reserved credits (deduct permanently)
   */
  async commitReservation(
    reservationId: string,
    description: string,
    jobId?: string
  ): Promise<void> {
    const data = await this.redis.get(reservationId);
    if (!data) return;

    const { amount } = JSON.parse(data);
    const [, userId] = reservationId.split(':');

    // Update database
    const balance = await this.prisma.creditBalance.update({
      where: { userId },
      data: {
        reservedCredits: { decrement: amount },
        lifetimeUsed: { increment: amount },
      },
    });

    // Create transaction record
    await this.prisma.creditTransaction.create({
      data: {
        userId,
        type: 'usage',
        amount: -amount,
        balanceAfter: balance.totalCredits,
        jobId,
        description,
      },
    });

    // Remove from Redis
    await this.redis.del(reservationId);

    // Invalidate cache
    await this.invalidateBalanceCache(userId);

    logger.info('Reservation committed', { reservationId, userId, amount, jobId });
  }

  /**
   * Get credit transaction history
   */
  async getTransactionHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ transactions: CreditTransaction[]; total: number }> {
    const { limit = 50, offset = 0, type, startDate, endDate } = options;

    const where: any = { userId };
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.creditTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        type: t.type as any,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        paymentId: t.paymentId || undefined,
        jobId: t.jobId || undefined,
        description: t.description,
        metadata: (t.metadata as Record<string, any>) || {},
        createdAt: t.createdAt,
      })),
      total,
    };
  }

  /**
   * Get available credit packages
   */
  async getCreditPackages(tier?: UserTier): Promise<CreditPackage[]> {
    const where: any = { isActive: true };
    if (tier) where.tier = tier;

    const packages = await this.prisma.creditPackage.findMany({
      where,
      orderBy: { priceUsd: 'asc' },
    });

    return packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      credits: p.credits,
      priceUsd: Number(p.priceUsd),
      bonusCredits: p.bonusCredits,
      tier: p.tier as UserTier,
      isPopular: p.isPopular,
      isSubscription: p.isSubscription,
      stripePriceId: p.stripePriceId || undefined,
      metadata: (p.metadata as Record<string, any>) || {},
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Get a specific credit package
   */
  async getCreditPackage(packageId: string): Promise<CreditPackage | null> {
    const pkg = await this.prisma.creditPackage.findUnique({
      where: { id: packageId },
    });

    if (!pkg) return null;

    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      credits: pkg.credits,
      priceUsd: Number(pkg.priceUsd),
      bonusCredits: pkg.bonusCredits,
      tier: pkg.tier as UserTier,
      isPopular: pkg.isPopular,
      isSubscription: pkg.isSubscription,
      stripePriceId: pkg.stripePriceId || undefined,
      metadata: (pkg.metadata as Record<string, any>) || {},
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
    };
  }

  /**
   * Validate if user can make a purchase (KYC check)
   */
  async validateKycForPurchase(
    userId: string,
    amount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { creditBalance: true },
    });

    if (!user) {
      return { valid: false, reason: 'User not found' };
    }

    // Check lifetime purchases for KYC threshold
    const lifetimePurchased = user.creditBalance?.lifetimePurchased || 0;
    const lifetimePurchasedUsd = lifetimePurchased / this.config.creditsPerUsd;

    if (lifetimePurchasedUsd + amount > this.config.kycThreshold) {
      if (user.kycStatus !== 'verified') {
        return {
          valid: false,
          reason: `KYC verification required for purchases over $${this.config.kycThreshold}`,
        };
      }
    }

    // Check single purchase limit without KYC
    if (user.kycStatus !== 'verified' && amount > this.config.maxPurchaseWithoutKyc) {
      return {
        valid: false,
        reason: `Maximum purchase without KYC is $${this.config.maxPurchaseWithoutKyc}`,
      };
    }

    return { valid: true };
  }

  /**
   * Calculate credits for USD amount
   */
  calculateCredits(usdAmount: number): number {
    return Math.floor(usdAmount * this.config.creditsPerUsd);
  }

  /**
   * Calculate USD for credits
   */
  calculateUsd(credits: number): number {
    return credits / this.config.creditsPerUsd;
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  private async getCachedBalance(userId: string): Promise<CreditBalance | null> {
    const cached = await this.redis.get(`balance:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  private async cacheBalance(userId: string, balance: CreditBalance): Promise<void> {
    await this.redis.setex(
      `balance:${userId}`,
      60, // 1 minute TTL
      JSON.stringify(balance)
    );
  }

  private async invalidateBalanceCache(userId: string): Promise<void> {
    await this.redis.del(`balance:${userId}`);
  }
}