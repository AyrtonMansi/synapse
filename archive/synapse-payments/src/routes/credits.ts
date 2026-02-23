/**
 * Credits Routes
 * 
 * @module synapse-payments/routes/credits
 * @description Routes for credit balance and transaction management
 */

import { Router } from 'express';
import { creditService } from '../index';
import { ValidationError, KycRequiredError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * Get user's credit balance
 */
router.get('/balance', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const balance = await creditService.getBalance(userId);

    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get credit transaction history
 */
router.get('/transactions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { limit = 50, offset = 0, type, startDate, endDate } = req.query;

    const result = await creditService.getTransactionHistory(userId, {
      limit: Number(limit),
      offset: Number(offset),
      type: type as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: result.transactions,
      meta: {
        total: result.total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available credit packages
 */
router.get('/packages', async (req: AuthenticatedRequest, res, next) => {
  try {
    const tier = req.user?.tier;
    const packages = await creditService.getCreditPackages(tier);

    res.json({
      success: true,
      data: packages,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reserve credits for an operation
 */
router.post('/reserve', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { amount, operationId } = req.body;

    if (!amount || !operationId) {
      throw new ValidationError('amount and operationId are required');
    }

    const result = await creditService.reserveCredits(userId, amount, operationId);

    if (!result.success) {
      res.status(402).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: result.error,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        reservationId: result.reservationId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Release reserved credits
 */
router.post('/release', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      throw new ValidationError('reservationId is required');
    }

    await creditService.releaseReservation(reservationId);

    res.json({
      success: true,
      data: { released: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Spend reserved credits (confirm usage)
 */
router.post('/spend', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { reservationId, description, jobId } = req.body;

    if (!reservationId) {
      throw new ValidationError('reservationId is required');
    }

    await creditService.commitReservation(reservationId, description || 'API usage', jobId);

    res.json({
      success: true,
      data: { spent: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Calculate credits for USD amount
 */
router.post('/calculate', (req: AuthenticatedRequest, res) => {
  const { usdAmount } = req.body;

  if (!usdAmount || usdAmount <= 0) {
    throw new ValidationError('Valid usdAmount is required');
  }

  const credits = creditService.calculateCredits(usdAmount);
  const kycCheck = { valid: true }; // Would actually check

  res.json({
    success: true,
    data: {
      usdAmount,
      credits,
      kycRequired: !kycCheck.valid,
    },
  });
});

/**
 * Check KYC requirement for purchase
 */
router.get('/kyc-check', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { amount } = req.query;

    if (!amount) {
      throw new ValidationError('amount is required');
    }

    const kycCheck = await creditService.validateKycForPurchase(
      userId,
      Number(amount)
    );

    res.json({
      success: true,
      data: {
        canPurchase: kycCheck.valid,
        reason: kycCheck.reason,
        kycRequired: !kycCheck.valid,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;