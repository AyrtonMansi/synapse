/**
 * Receipt Routes
 * 
 * @module synapse-payments/routes/receipts
 * @description Routes for receipt generation and retrieval
 */

import { Router } from 'express';
import { receiptService } from '../index';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * Get user's receipts
 */
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await receiptService.getUserReceipts(userId, {
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({
      success: true,
      data: result.receipts,
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
 * Generate receipt for a payment
 */
router.post('/generate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { paymentId } = req.body;

    if (!paymentId) {
      throw new ValidationError('paymentId is required');
    }

    const receipt = await receiptService.generateReceipt(paymentId);

    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get receipt by ID
 */
router.get('/:receiptId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { receiptId } = req.params;
    const receipt = await receiptService.getReceipt(receiptId);

    if (!receipt) {
      throw new NotFoundError('Receipt');
    }

    // Ensure user can only see their own receipts
    if (receipt.userId !== req.user!.id) {
      throw new ValidationError('Unauthorized');
    }

    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get receipt by payment ID
 */
router.get('/payment/:paymentId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { paymentId } = req.params;
    const receipt = await receiptService.getReceiptByPayment(paymentId);

    if (!receipt) {
      throw new NotFoundError('Receipt');
    }

    // Ensure user can only see their own receipts
    if (receipt.userId !== req.user!.id) {
      throw new ValidationError('Unauthorized');
    }

    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Generate tax report
 */
router.post('/tax-report', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { year, quarter } = req.body;

    if (!year) {
      throw new ValidationError('year is required');
    }

    const report = await receiptService.generateTaxReport(
      userId,
      year,
      quarter
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get tax reports
 */
router.get('/tax-reports', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { year } = req.query;

    // Get tax reports from database
    const reports = await prisma.taxReport.findMany({
      where: {
        userId,
        ...(year && { year: Number(year) }),
      },
      orderBy: { generatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
});

export default router;