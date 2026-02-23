/**
 * Crypto Payment Routes
 * 
 * @module synapse-payments/routes/crypto
 * @description Routes for crypto payment processing
 */

import { Router } from 'express';
import { cryptoPaymentService } from '../index';
import { optionalAuthMiddleware } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * Get supported networks and tokens
 */
router.get('/networks', (_req, res) => {
  const networks = cryptoPaymentService.getSupportedNetworks();
  
  res.json({
    success: true,
    data: networks,
  });
});

/**
 * Create a crypto payment session
 */
router.post('/create-session', optionalAuthMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { amountUsd, token, chainId, userId } = req.body;

    if (!amountUsd || !token || !chainId) {
      throw new ValidationError('amountUsd, token, and chainId are required');
    }

    // Use authenticated user ID if available, otherwise use provided
    const effectiveUserId = req.user?.id || userId;
    if (!effectiveUserId) {
      throw new ValidationError('userId is required');
    }

    const session = await cryptoPaymentService.createPaymentSession(
      effectiveUserId,
      amountUsd,
      token,
      chainId
    );

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        paymentAddress: session.paymentAddress,
        requiredAmount: session.requiredAmount,
        token: session.token,
        chainId: session.chainId,
        expiryTime: session.expiryTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get payment session status
 */
router.get('/session/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await cryptoPaymentService.getSession(sessionId);

    if (!session) {
      throw new ValidationError('Session not found');
    }

    res.json({
      success: true,
      data: {
        id: session.id,
        status: session.status,
        amountUsd: session.amountUsd,
        creditsToReceive: session.creditsToReceive,
        paymentAddress: session.paymentAddress,
        token: session.token,
        chainId: session.chainId,
        txHash: session.txHash,
        confirmedAt: session.confirmedAt,
        expiryTime: session.expiryTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get payment instructions (with QR code)
 */
router.get('/session/:sessionId/instructions', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const instructions = await cryptoPaymentService.getPaymentInstructions(sessionId);

    res.json({
      success: true,
      data: instructions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel a payment session
 */
router.post('/session/:sessionId/cancel', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await cryptoPaymentService.cancelSession(sessionId);

    res.json({
      success: true,
      data: { message: 'Session cancelled' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify payment manually (admin or troubleshooting)
 */
router.post('/session/:sessionId/verify', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { txHash } = req.body;

    if (!txHash) {
      throw new ValidationError('txHash is required');
    }

    const success = await cryptoPaymentService.verifyPayment(sessionId, txHash);

    res.json({
      success: true,
      data: { verified: success },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Calculate token amount for USD value
 */
router.post('/calculate', async (req, res, next) => {
  try {
    const { amountUsd, token, chainId } = req.body;

    if (!amountUsd || !token || !chainId) {
      throw new ValidationError('amountUsd, token, and chainId are required');
    }

    // This would call a method on the service to calculate
    // For now, return estimated values
    const rates: Record<string, number> = {
      'ETH': 3000,
      'USDC': 1,
      'USDT': 1,
      'HSK': 0.001,
    };

    const tokenAmount = amountUsd / (rates[token] || 1);
    const credits = Math.floor(amountUsd * 1000);

    res.json({
      success: true,
      data: {
        amountUsd,
        token,
        tokenAmount,
        credits,
        rate: rates[token] || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;