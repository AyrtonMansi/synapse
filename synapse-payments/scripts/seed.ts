/**
 * Database Seeding Script
 * 
 * Seeds the database with default credit packages and test data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Credit Packages
  const creditPackages = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for trying out Synapse',
      credits: 10000,
      priceUsd: 10,
      bonusCredits: 0,
      tier: 'free',
      isPopular: false,
      isActive: true,
    },
    {
      id: 'growth',
      name: 'Growth',
      description: 'Best for small projects',
      credits: 50000,
      priceUsd: 45,
      bonusCredits: 5000,
      tier: 'basic',
      isPopular: true,
      isActive: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For serious developers',
      credits: 200000,
      priceUsd: 160,
      bonusCredits: 40000,
      tier: 'pro',
      isPopular: false,
      isActive: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for large teams',
      credits: 1000000,
      priceUsd: 700,
      bonusCredits: 300000,
      tier: 'enterprise',
      isPopular: false,
      isActive: true,
    },
  ];

  for (const pkg of creditPackages) {
    await prisma.creditPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
    console.log(`✅ Credit package: ${pkg.name}`);
  }

  // Subscription Plans (stored in code, but could be in DB)
  console.log('✅ Subscription plans configured');

  // Test User (for development)
  if (process.env.NODE_ENV === 'development') {
    const testUser = await prisma.user.upsert({
      where: { email: 'test@synapse.network' },
      update: {},
      create: {
        email: 'test@synapse.network',
        tier: 'pro',
        kycStatus: 'verified',
        kycVerifiedAt: new Date(),
      },
    });

    // Give test user some credits
    await prisma.creditBalance.upsert({
      where: { userId: testUser.id },
      update: {
        totalCredits: 100000,
        availableCredits: 100000,
      },
      create: {
        userId: testUser.id,
        totalCredits: 100000,
        availableCredits: 100000,
        reservedCredits: 0,
        lifetimePurchased: 100000,
        lifetimeUsed: 0,
      },
    });

    console.log('✅ Test user created: test@synapse.network');
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });