/**
 * KYC Routes
 * 
 * @module synapse-payments/routes/kyc
 * @description Routes for KYC verification
 */

import { Router } from 'express';
import { kycService } from '../index';
import { ValidationError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * Get user's KYC status
 */
router.get('/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const status = await kycService.getUserVerificationStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Start KYC verification
 */
router.post('/start', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { level = 'standard' } = req.body;

    const result = await kycService.createVerification(userId, level);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get verification details
 */
router.get('/verification/:verificationId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { verificationId } = req.params;
    const verification = await kycService.getVerification(verificationId);

    if (!verification) {
      throw new ValidationError('Verification not found');
    }

    // Ensure user can only see their own verifications
    if (verification.userId !== req.user!.id) {
      throw new ValidationError('Unauthorized');
    }

    res.json({
      success: true,
      data: verification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Webhook handler for KYC provider
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    
    await kycService.handleWebhook(req.body, signature);

    res.json({ received: true });
  } catch (error) {
    logger.error('KYC webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

export default router;