/**
 * Stripe Routes
 * 
 * @module synapse-payments/routes/stripe
 * @description Public routes for Stripe integration
 */

import { Router } from 'express';
import { stripeService } from '../index';
import { logger } from '../index';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();

/**
 * Get Stripe publishable key
 * Used by frontend to initialize Stripe.js
 */
router.get('/config', (_req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: stripeService.getPublishableKey(),
    },
  });
});

/**
 * Create payment intent
 * Frontend calls this to start a payment
 */
router.post('/create-payment-intent', async (req, res, next) => {
  try {
    const { userId, email, packageId, metadata } = req.body;

    if (!userId || !email || !packageId) {
      throw new ValidationError('userId, email, and packageId are required');
    }

    // Get credit package
    const creditPackage = await getCreditPackage(packageId);
    if (!creditPackage) {
      throw new ValidationError('Invalid package ID');
    }

    const result = await stripeService.createPaymentIntent(
      userId,
      email,
      creditPackage,
      metadata
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
 * Create checkout session
 * For Stripe Checkout (redirect flow)
 */
router.post('/create-checkout-session', async (req, res, next) => {
  try {
    const { userId, email, packageId, successUrl, cancelUrl } = req.body;

    if (!userId || !email || !packageId || !successUrl || !cancelUrl) {
      throw new ValidationError('All fields are required');
    }

    const creditPackage = await getCreditPackage(packageId);
    if (!creditPackage) {
      throw new ValidationError('Invalid package ID');
    }

    const result = await stripeService.createCheckoutSession(
      userId,
      email,
      creditPackage,
      successUrl,
      cancelUrl
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
 * Stripe webhook handler
 * Receives events from Stripe
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new ValidationError('Stripe signature required');
    }

    const event = stripeService.constructWebhookEvent(req.body, signature);
    
    // Process event asynchronously
    stripeService.handleWebhookEvent(event).catch((error) => {
      logger.error('Error handling webhook event:', error);
    });

    // Acknowledge receipt immediately
    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

/**
 * Get checkout session status
 */
router.get('/session/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await stripeService.getCheckoutSession(sessionId);

    res.json({
      success: true,
      data: {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
        customer: session.customer,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get payment intent status
 */
router.get('/payment-intent/:paymentIntentId', async (req, res, next) => {
  try {
    const { paymentIntentId } = req.params;
    const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);

    res.json({
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customer: paymentIntent.customer,
        metadata: paymentIntent.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get credit package
async function getCreditPackage(packageId: string) {
  // Default packages - in production, fetch from database
  const packages: Record<string, any> = {
    'starter': {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for trying out Synapse',
      credits: 10000,
      priceUsd: 10,
      bonusCredits: 0,
      tier: 'free',
      isPopular: false,
      isSubscription: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'growth': {
      id: 'growth',
      name: 'Growth',
      description: 'Best for small projects',
      credits: 50000,
      priceUsd: 45,
      bonusCredits: 5000,
      tier: 'basic',
      isPopular: true,
      isSubscription: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'pro': {
      id: 'pro',
      name: 'Pro',
      description: 'For serious developers',
      credits: 200000,
      priceUsd: 160,
      bonusCredits: 40000,
      tier: 'pro',
      isPopular: false,
      isSubscription: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'enterprise': {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for large teams',
      credits: 1000000,
      priceUsd: 700,
      bonusCredits: 300000,
      tier: 'enterprise',
      isPopular: false,
      isSubscription: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return packages[packageId] || null;
}

export default router;