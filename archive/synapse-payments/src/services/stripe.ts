/**
 * Stripe Service
 * 
 * @module synapse-payments/services/stripe
 * @description Handles all Stripe integration: payments, subscriptions, webhooks, refunds
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { TreasuryService } from './treasury';
import { logger } from '../index';
import type { PaymentConfig, CreditPackage, SubscriptionPlan } from '../types';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
}

export class StripeService {
  private stripe: Stripe;
  private config: StripeConfig;
  private prisma: PrismaClient;
  private treasury: TreasuryService;

  constructor(config: StripeConfig, prisma: PrismaClient, treasury: TreasuryService) {
    this.config = config;
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
    this.prisma = prisma;
    this.treasury = treasury;
  }

  // ============================================================================
  // CUSTOMER MANAGEMENT
  // ============================================================================

  /**
   * Create or retrieve a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<Stripe.Customer> {
    // Check if user already has a Stripe customer
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(user.stripeCustomerId);
        if (customer && !customer.deleted) {
          return customer as Stripe.Customer;
        }
      } catch (error) {
        logger.warn('Failed to retrieve existing Stripe customer, creating new one', { userId });
      }
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      metadata: {
        userId,
      },
    });

    // Update user with Stripe customer ID
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    logger.info('Created Stripe customer', { userId, customerId: customer.id });
    return customer;
  }

  /**
   * Update customer information
   */
  async updateCustomer(
    customerId: string,
    updates: Partial<Stripe.CustomerUpdateParams>
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, updates);
  }

  // ============================================================================
  // PAYMENT INTENTS
  // ============================================================================

  /**
   * Create a payment intent for one-time credit purchase
   */
  async createPaymentIntent(
    userId: string,
    email: string,
    creditPackage: CreditPackage,
    metadata: Record<string, any> = {}
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const customer = await this.getOrCreateCustomer(userId, email);

    // Create payment in database
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: creditPackage.priceUsd,
        currency: 'USD',
        paymentMethod: 'stripe',
        status: 'pending',
        creditsPurchased: creditPackage.credits + creditPackage.bonusCredits,
        creditsRate: 1000, // 1000 credits per $1
        metadata: {
          packageId: creditPackage.id,
          packageName: creditPackage.name,
          baseCredits: creditPackage.credits,
          bonusCredits: creditPackage.bonusCredits,
          ...metadata,
        },
      },
    });

    // Create Stripe payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(creditPackage.priceUsd * 100), // Convert to cents
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentId: payment.id,
        userId,
        credits: creditPackage.credits + creditPackage.bonusCredits,
      },
      description: `${creditPackage.name} - ${creditPackage.credits + creditPackage.bonusCredits} credits`,
    });

    // Update payment with Stripe ID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    logger.info('Created payment intent', {
      userId,
      paymentId: payment.id,
      paymentIntentId: paymentIntent.id,
      amount: creditPackage.priceUsd,
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  // ============================================================================
  // CHECKOUT SESSIONS
  // ============================================================================

  /**
   * Create a checkout session for credit purchase
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    creditPackage: CreditPackage,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string | null }> {
    const customer = await this.getOrCreateCustomer(userId, email);

    // Create payment in database
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: creditPackage.priceUsd,
        currency: 'USD',
        paymentMethod: 'stripe',
        status: 'pending',
        creditsPurchased: creditPackage.credits + creditPackage.bonusCredits,
        creditsRate: 1000,
        metadata: {
          packageId: creditPackage.id,
          packageName: creditPackage.name,
        },
      },
    });

    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: creditPackage.name,
              description: `${creditPackage.credits + creditPackage.bonusCredits} API credits`,
            },
            unit_amount: Math.round(creditPackage.priceUsd * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        paymentId: payment.id,
        userId,
        credits: creditPackage.credits + creditPackage.bonusCredits,
      },
    });

    logger.info('Created checkout session', {
      userId,
      paymentId: payment.id,
      sessionId: session.id,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  /**
   * Create a subscription
   */
  async createSubscription(
    userId: string,
    email: string,
    plan: SubscriptionPlan,
    paymentMethodId?: string
  ): Promise<{ subscriptionId: string; clientSecret?: string; status: string }> {
    const customer = await this.getOrCreateCustomer(userId, email);

    // Attach payment method if provided
    if (paymentMethodId) {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      await this.stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Create Stripe subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripePriceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId,
        tier: plan.tier,
        creditsPerPeriod: plan.monthlyCredits,
      },
    });

    // Create subscription in database
    await this.prisma.subscription.create({
      data: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: plan.stripePriceId,
        status: subscription.status as any,
        tier: plan.tier,
        creditsPerPeriod: plan.monthlyCredits,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Update user tier
    await this.prisma.user.update({
      where: { id: userId },
      data: { tier: plan.tier },
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;

    logger.info('Created subscription', {
      userId,
      subscriptionId: subscription.id,
      tier: plan.tier,
    });

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret || undefined,
      status: subscription.status,
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    stripeSubscriptionId: string,
    cancelImmediately: boolean = false
  ): Promise<Stripe.Subscription> {
    if (cancelImmediately) {
      return this.stripe.subscriptions.cancel(stripeSubscriptionId);
    } else {
      return this.stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    stripeSubscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    const itemId = subscription.items.data[0].id;

    return this.stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  // ============================================================================
  // REFUNDS
  // ============================================================================

  /**
   * Process a refund
   */
  async processRefund(
    paymentId: string,
    amount?: number, // If not provided, full refund
    reason?: string
  ): Promise<{ refundId: string; amount: number }> {
    // Get payment details
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'completed') {
      throw new Error('Can only refund completed payments');
    }

    if (!payment.stripeChargeId) {
      throw new Error('No Stripe charge found for this payment');
    }

    // Calculate refund amount
    const refundAmount = amount || Number(payment.amount);
    const alreadyRefunded = Number(payment.refundedAmount || 0);
    const maxRefundable = Number(payment.amount) - alreadyRefunded;

    if (refundAmount > maxRefundable) {
      throw new Error(`Maximum refundable amount is ${maxRefundable}`);
    }

    // Create Stripe refund
    const refund = await this.stripe.refunds.create({
      charge: payment.stripeChargeId,
      amount: Math.round(refundAmount * 100), // Convert to cents
      reason: 'requested_by_customer',
      metadata: {
        paymentId,
        reason: reason || 'Customer request',
      },
    });

    // Update payment in database
    const newRefundedAmount = alreadyRefunded + refundAmount;
    const isFullyRefunded = newRefundedAmount >= Number(payment.amount);

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundedAmount: newRefundedAmount,
        status: isFullyRefunded ? 'refunded' : 'partially_refunded',
        refundReason: reason,
      },
    });

    // Create refund record
    await this.prisma.refund.create({
      data: {
        paymentId,
        amount: refundAmount,
        reason,
        stripeRefundId: refund.id,
        status: 'completed',
        processedAt: new Date(),
      },
    });

    // Deduct credits from user
    await this.treasury.deductCredits(
      payment.userId,
      Math.floor((refundAmount / Number(payment.amount)) * payment.creditsPurchased),
      `Refund for payment ${paymentId}`
    );

    logger.info('Processed refund', {
      paymentId,
      refundId: refund.id,
      amount: refundAmount,
    });

    return {
      refundId: refund.id,
      amount: refundAmount,
    };
  }

  /**
   * Get refund details
   */
  async getRefund(refundId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.retrieve(refundId);
  }

  // ============================================================================
  // WEBHOOK HANDLING
  // ============================================================================

  /**
   * Verify webhook signature
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.webhookSecret
    );
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    logger.info('Processing Stripe webhook', { type: event.type, id: event.id });

    // Store webhook event
    await this.prisma.webhookEvent.create({
      data: {
        provider: 'stripe',
        eventType: event.type,
        payload: event as any,
      },
    });

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        logger.info('Unhandled Stripe webhook event', { type: event.type });
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const paymentId = paymentIntent.metadata.paymentId;
    if (!paymentId) return;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.status === 'completed') return;

    // Update payment status
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'completed',
        stripeChargeId: paymentIntent.latest_charge as string,
        completedAt: new Date(),
      },
    });

    // Mint/transfer credits to user
    await this.treasury.mintCredits(
      payment.userId,
      payment.creditsPurchased,
      `Purchase via Stripe: ${paymentId}`
    );

    logger.info('Payment completed, credits issued', {
      paymentId,
      userId: payment.userId,
      credits: payment.creditsPurchased,
    });
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const paymentId = paymentIntent.metadata.paymentId;
    if (!paymentId) return;

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'failed',
        metadata: {
          ...paymentIntent.metadata,
          failureMessage: paymentIntent.last_payment_error?.message,
        },
      },
    });

    logger.warn('Payment failed', { paymentId, error: paymentIntent.last_payment_error?.message });
  }

  /**
   * Handle successful invoice payment (subscriptions)
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string },
    });

    if (!subscription) return;

    // Add subscription credits
    await this.treasury.mintCredits(
      subscription.userId,
      subscription.creditsPerPeriod,
      `Monthly subscription: ${subscription.stripeSubscriptionId}`
    );

    // Update subscription period
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: new Date(invoice.period_start * 1000),
        currentPeriodEnd: new Date(invoice.period_end * 1000),
      },
    });

    logger.info('Subscription payment succeeded, credits issued', {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      credits: subscription.creditsPerPeriod,
    });
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: invoice.subscription as string },
      data: { status: 'past_due' },
    });

    logger.warn('Subscription payment failed', {
      subscriptionId: invoice.subscription,
      attemptCount: invoice.attempt_count,
    });
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status as any,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    logger.info('Subscription updated', {
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    });

    // Downgrade user tier
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: { tier: 'free' },
    });

    logger.info('Subscription canceled', {
      subscriptionId: subscription.id,
      userId: sub.userId,
    });
  }

  /**
   * Handle charge refunded
   */
  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { stripeChargeId: charge.id },
    });

    if (!payment) return;

    const refundAmount = charge.amount_refunded / 100; // Convert from cents

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: refundAmount,
        status: refundAmount >= Number(payment.amount) ? 'refunded' : 'partially_refunded',
      },
    });

    logger.info('Charge refunded processed', {
      paymentId: payment.id,
      refundAmount,
    });
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.payment_status !== 'paid') return;

    const paymentId = session.metadata?.paymentId;
    if (!paymentId) return;

    // This is handled by payment_intent.succeeded for the actual payment
    // But we can update the payment with the session info if needed
    logger.info('Checkout session completed', {
      sessionId: session.id,
      paymentId,
    });
  }

  // ============================================================================
  // BILLING PORTAL
  // ============================================================================

  /**
   * Create a billing portal session
   */
  async createBillingPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  // ============================================================================
  // PRODUCTS & PRICES (for setup)
  // ============================================================================

  /**
   * Create a product and price for a credit package
   */
  async createCreditPackageProduct(
    creditPackage: CreditPackage
  ): Promise<{ productId: string; priceId: string }> {
    // Create product
    const product = await this.stripe.products.create({
      name: creditPackage.name,
      description: creditPackage.description,
      metadata: {
        packageId: creditPackage.id,
        credits: creditPackage.credits,
        bonusCredits: creditPackage.bonusCredits,
      },
    });

    // Create price
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(creditPackage.priceUsd * 100),
      currency: 'usd',
    });

    logger.info('Created Stripe product for credit package', {
      packageId: creditPackage.id,
      productId: product.id,
      priceId: price.id,
    });

    return {
      productId: product.id,
      priceId: price.id,
    };
  }

  /**
   * Create a subscription plan in Stripe
   */
  async createSubscriptionPlan(
    plan: SubscriptionPlan
  ): Promise<{ productId: string; priceId: string }> {
    const product = await this.stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        tier: plan.tier,
        monthlyCredits: plan.monthlyCredits,
      },
    });

    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.priceUsd * 100),
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    logger.info('Created Stripe subscription plan', {
      tier: plan.tier,
      productId: product.id,
      priceId: price.id,
    });

    return {
      productId: product.id,
      priceId: price.id,
    };
  }

  getPublishableKey(): string {
    return this.config.publishableKey;
  }
}