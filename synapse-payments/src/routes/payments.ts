/**
 * Payments Routes
 * 
 * @module synapse-payments/routes/payments
 * @description Protected routes for payment management
 */

import { Router } from 'express';
import { prisma } from '../index';
import { stripeService, cryptoPaymentService } from '../index';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * Get user's payment history
 */
router.get('/history', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { limit = 20, offset = 0, status } = req.query;

    const where: any = { userId };
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
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

/**
 * Get specific payment details
 */
router.get('/:paymentId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user!.id;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    // Ensure user can only see their own payments
    if (payment.userId !== userId) {
      throw new AuthorizationError();
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Request a refund
 */
router.post('/:paymentId/refund', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user!.id;
    const { amount, reason } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    if (payment.userId !== userId) {
      throw new AuthorizationError();
    }

    if (payment.paymentMethod !== 'stripe') {
      throw new ValidationError('Refunds only supported for Stripe payments');
    }

    // Process refund through Stripe
    const result = await stripeService.processRefund(
      paymentId,
      amount,
      reason
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
 * Get refund status
 */
router.get('/:paymentId/refunds', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user!.id;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    if (payment.userId !== userId) {
      throw new AuthorizationError();
    }

    res.json({
      success: true,
      data: payment.refunds,
    });
  } catch (error) {
    next(error);
  }
});

export default router;