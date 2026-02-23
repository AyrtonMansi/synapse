/**
 * Payment Service Tests
 * 
 * @module synapse-payments/tests/payments
 * @description Unit and integration tests for payment service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis-mock';
import { CreditService } from '../src/services/credit';
import { TreasuryService } from '../src/services/treasury';

const prisma = new PrismaClient();
const redis = new Redis();

describe('Credit Service', () => {
  let creditService: CreditService;
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    creditService = new CreditService(
      {
        creditsPerUsd: 1000,
        kycThreshold: 1000,
        maxPurchaseWithoutKyc: 500,
      },
      prisma,
      redis as any
    );
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.creditTransaction.deleteMany({ where: { userId: testUserId } });
    await prisma.creditBalance.deleteMany({ where: { userId: testUserId } });
  });

  it('should create initial balance for new user', async () => {
    const balance = await creditService.getBalance(testUserId);
    
    expect(balance.userId).toBe(testUserId);
    expect(balance.totalCredits).toBe(0);
    expect(balance.availableCredits).toBe(0);
  });

  it('should add credits to user balance', async () => {
    await creditService.addCredits(
      testUserId,
      1000,
      'purchase',
      'Test purchase'
    );

    const balance = await creditService.getBalance(testUserId);
    
    expect(balance.totalCredits).toBe(1000);
    expect(balance.availableCredits).toBe(1000);
    expect(balance.lifetimePurchased).toBe(1000);
  });

  it('should deduct credits from user balance', async () => {
    // Add credits first
    await creditService.addCredits(testUserId, 1000, 'purchase', 'Test');

    // Deduct credits
    const result = await creditService.deductCredits(
      testUserId,
      500,
      'API usage'
    );

    expect(result.success).toBe(true);
    expect(result.balance.availableCredits).toBe(500);
    expect(result.balance.lifetimeUsed).toBe(500);
  });

  it('should fail to deduct more credits than available', async () => {
    await creditService.addCredits(testUserId, 100, 'purchase', 'Test');

    const result = await creditService.deductCredits(
      testUserId,
      200,
      'API usage'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient credits');
  });

  it('should reserve and release credits', async () => {
    await creditService.addCredits(testUserId, 1000, 'purchase', 'Test');

    const reserveResult = await creditService.reserveCredits(
      testUserId,
      500,
      'test-operation'
    );

    expect(reserveResult.success).toBe(true);
    expect(reserveResult.reservationId).toBeDefined();

    // Check balance updated
    const balance = await creditService.getBalance(testUserId);
    expect(balance.availableCredits).toBe(500);
    expect(balance.reservedCredits).toBe(500);

    // Release reservation
    await creditService.releaseReservation(reserveResult.reservationId!);

    const updatedBalance = await creditService.getBalance(testUserId);
    expect(updatedBalance.availableCredits).toBe(1000);
    expect(updatedBalance.reservedCredits).toBe(0);
  });

  it('should calculate credits correctly', () => {
    const credits = creditService.calculateCredits(10);
    expect(credits).toBe(10000); // 1000 credits per USD
  });
});

describe('Credit Packages', () => {
  let creditService: CreditService;

  beforeAll(async () => {
    creditService = new CreditService(
      { creditsPerUsd: 1000, kycThreshold: 1000, maxPurchaseWithoutKyc: 500 },
      prisma,
      redis as any
    );

    // Seed test packages
    await prisma.creditPackage.createMany({
      data: [
        {
          id: 'test-starter',
          name: 'Test Starter',
          description: 'Test package',
          credits: 10000,
          priceUsd: 10,
          bonusCredits: 0,
          tier: 'free',
          isPopular: false,
          isActive: true,
        },
        {
          id: 'test-pro',
          name: 'Test Pro',
          description: 'Test pro package',
          credits: 100000,
          priceUsd: 100,
          bonusCredits: 10000,
          tier: 'pro',
          isPopular: true,
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('should retrieve active credit packages', async () => {
    const packages = await creditService.getCreditPackages();
    
    expect(packages.length).toBeGreaterThan(0);
    expect(packages.every(p => p.isActive)).toBe(true);
  });

  it('should filter packages by tier', async () => {
    const proPackages = await creditService.getCreditPackages('pro');
    
    expect(proPackages.every(p => p.tier === 'pro')).toBe(true);
  });
});

describe('KYC Validation', () => {
  let creditService: CreditService;
  const testUserId = 'kyc-test-user';

  beforeAll(async () => {
    creditService = new CreditService(
      { creditsPerUsd: 1000, kycThreshold: 1000, maxPurchaseWithoutKyc: 500 },
      prisma,
      redis as any
    );
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.creditBalance.deleteMany({ where: { userId: testUserId } });
  });

  it('should allow small purchases without KYC', async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'test@example.com',
        kycStatus: 'none',
      },
    });

    const result = await creditService.validateKycForPurchase(testUserId, 100);
    
    expect(result.valid).toBe(true);
  });

  it('should block large purchases without KYC', async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'test@example.com',
        kycStatus: 'none',
      },
    });

    const result = await creditService.validateKycForPurchase(testUserId, 600);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Maximum purchase without KYC');
  });

  it('should allow large purchases with verified KYC', async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'test@example.com',
        kycStatus: 'verified',
        kycVerifiedAt: new Date(),
      },
    });

    const result = await creditService.validateKycForPurchase(testUserId, 2000);
    
    expect(result.valid).toBe(true);
  });
});