/**
 * Admin Routes
 * 
 * @module synapse-payments/routes/admin
 * @description Admin-only routes for system management
 */

import { Router } from 'express';
import { prisma, stripeService, treasuryService, creditService, kycService, receiptService } from '../index';
import { adminAuthMiddleware } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();

// Apply admin middleware to all routes
router.use(adminAuthMiddleware);

/**
 * Get system statistics
 */
router.get('/stats', async (_req, res, next) => {
  try {
    const [
      totalUsers,
      totalPayments,
      totalRevenue,
      totalCredits,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.payment.count(),
      prisma.payment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      }),
      prisma.creditBalance.aggregate({
        _sum: { totalCredits: true },
      }),
      prisma.subscription.count({
        where: { status: 'active' },
      }),
    ]);

    // Get treasury stats
    const treasuryStats = await treasuryService.getTreasuryStats();

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
        },
        payments: {
          total: totalPayments,
          revenue: totalRevenue._sum.amount || 0,
        },
        credits: {
          totalIssued: totalCredits._sum.totalCredits || 0,
        },
        subscriptions: {
          active: activeSubscriptions,
        },
        treasury: treasuryStats,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all payments (with filters)
 */
router.get('/payments', async (req, res, next) => {
  try {
    const { status, method, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (method) where.paymentMethod = method;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
      meta: { total, limit: Number(limit), offset: Number(offset) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Process refund (admin override)
 */
router.post('/refund', async (req, res, next) => {
  try {
    const { paymentId, amount, reason } = req.body;

    if (!paymentId) {
      throw new ValidationError('paymentId is required');
    }

    const result = await stripeService.processRefund(paymentId, amount, reason);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Approve KYC verification
 */
router.post('/kyc/approve', async (req, res, next) => {
  try {
    const { verificationId, adminId } = req.body;

    if (!verificationId) {
      throw new ValidationError('verificationId is required');
    }

    await kycService.approveVerification(verificationId, adminId);

    res.json({
      success: true,
      data: { approved: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reject KYC verification
 */
router.post('/kyc/reject', async (req, res, next) => {
  try {
    const { verificationId, reason, adminId } = req.body;

    if (!verificationId || !reason) {
      throw new ValidationError('verificationId and reason are required');
    }

    await kycService.rejectVerification(verificationId, reason, adminId);

    res.json({
      success: true,
      data: { rejected: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Adjust user credits (admin override)
 */
router.post('/credits/adjust', async (req, res, next) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined || !reason) {
      throw new ValidationError('userId, amount, and reason are required');
    }

    const balance = await creditService.addCredits(
      userId,
      amount,
      'adjustment',
      reason
    );

    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get pending KYC verifications
 */
router.get('/kyc/pending', async (_req, res, next) => {
  try {
    const verifications = await prisma.kycVerification.findMany({
      where: { status: 'pending' },
      include: { user: { select: { email: true, createdAt: true } } },
      orderBy: { submittedAt: 'asc' },
    });

    res.json({
      success: true,
      data: verifications,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Generate admin tax report
 */
router.post('/tax-report', async (req, res, next) => {
  try {
    const { year, quarter } = req.body;

    if (!year) {
      throw new ValidationError('year is required');
    }

    const report = await receiptService.generateAdminTaxReport(year, quarter);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get treasury status
 */
router.get('/treasury', async (_req, res, next) => {
  try {
    const stats = await treasuryService.getTreasuryStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Emergency treasury operations
 */
router.post('/treasury/emergency', async (req, res, next) => {
  try {
    const { operation, to, amount } = req.body;

    if (operation === 'withdraw') {
      if (!to || !amount) {
        throw new ValidationError('to and amount are required for withdrawal');
      }

      const txHash = await treasuryService.emergencyWithdraw(to, BigInt(amount));

      res.json({
        success: true,
        data: { txHash },
      });
    } else {
      throw new ValidationError('Unknown operation');
    }
  } catch (error) {
    next(error);
  }
});

export default router;