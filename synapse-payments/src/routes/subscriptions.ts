/**
 * Subscriptions Routes
 * 
 * @module synapse-payments/routes/subscriptions
 * @description Routes for subscription management
 */

import { Router } from 'express';
import { prisma, stripeService } from '../index';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler';
import type { AuthenticatedRequest, SubscriptionPlan } from '../types';

const router = Router();

// Default subscription plans
const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic-monthly',
    name: 'Basic Plan',
    description: 'Perfect for individuals and small projects',
    tier: 'basic',
    monthlyCredits: 50000,
    priceUsd: 39,
    stripePriceId: 'price_basic_monthly', // Replace with actual Stripe price ID
    features: [
      '50,000 credits per month',
      'Basic support',
      'Standard API access',
      'Community Discord access',
    ],
    isActive: true,
  },
  {
    id: 'pro-monthly',
    name: 'Pro Plan',
    description: 'For professional developers and teams',
    tier: 'pro',
    monthlyCredits: 200000,
    priceUsd: 149,
    stripePriceId: 'price_pro_monthly', // Replace with actual Stripe price ID
    features: [
      '200,000 credits per month',
      'Priority support',
      'Advanced API features',
      'Private Discord channel',
      'Early access to new models',
    ],
    isActive: true,
  },
  {
    id: 'enterprise-monthly',
    name: 'Enterprise Plan',
    description: 'For large teams with custom needs',
    tier: 'enterprise',
    monthlyCredits: 1000000,
    priceUsd: 599,
    stripePriceId: 'price_enterprise_monthly', // Replace with actual Stripe price ID
    features: [
      '1,000,000 credits per month',
      'Dedicated support',
      'Custom model deployments',
      'SLA guarantees',
      'Custom integrations',
    ],
    isActive: true,
  },
];

/**
 * Get available subscription plans
 */
router.get('/plans', (_req, res) => {
  res.json({
    success: true,
    data: SUBSCRIPTION_PLANS.filter(p => p.isActive),
  });
});

/**
 * Get user's current subscription
 */
router.get('/current', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a subscription
 */
router.post('/create', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { planId, paymentMethodId } = req.body;

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      throw new ValidationError('Invalid plan ID');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const result = await stripeService.createSubscription(
      userId,
      user.email,
      plan,
      paymentMethodId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel subscription
 */
router.post('/cancel', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { immediately } = req.body;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundError('Active subscription');
    }

    await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately
    );

    // Update local record
    if (immediately) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { tier: 'free' },
      });
    } else {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      });
    }

    res.json({
      success: true,
      data: {
        canceled: true,
        effectiveDate: immediately ? 'immediately' : 'end of billing period',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update subscription (change plan)
 */
router.post('/update', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { newPlanId } = req.body;

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === newPlanId);
    if (!plan) {
      throw new ValidationError('Invalid plan ID');
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundError('Active subscription');
    }

    await stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      plan.stripePriceId
    );

    // Update local record
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        stripePriceId: plan.stripePriceId,
        tier: plan.tier,
        creditsPerPeriod: plan.monthlyCredits,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { tier: plan.tier },
    });

    res.json({
      success: true,
      data: { updated: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get billing portal URL
 */
router.get('/billing-portal', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { returnUrl } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeCustomerId) {
      throw new ValidationError('No Stripe customer found');
    }

    const result = await stripeService.createBillingPortalSession(
      user.stripeCustomerId,
      returnUrl as string || `${process.env.FRONTEND_URL}/account`
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get subscription history
 */
router.get('/history', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { limit = 20, offset = 0 } = req.query;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.subscription.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      data: subscriptions,
      meta: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;