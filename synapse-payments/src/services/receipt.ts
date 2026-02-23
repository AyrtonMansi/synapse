/**
 * Receipt Service
 * 
 * @module synapse-payments/services/receipt
 * @description Generates receipts and handles tax reporting
 */

import { PrismaClient } from '@prisma/client';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as csv from 'fast-csv';
import { Readable, Writable } from 'stream';
import { logger } from '../index';
import type { Receipt, ReceiptItem, TaxReport, TaxTransaction } from '../types';

export interface ReceiptConfig {
  companyName: string;
  companyAddress: string;
  taxId: string;
  receiptBucket?: string; // S3 bucket for storing PDFs
}

export class ReceiptService {
  private config: ReceiptConfig;
  private prisma: PrismaClient;

  constructor(config: ReceiptConfig, prisma: PrismaClient) {
    this.config = config;
    this.prisma = prisma;
  }

  /**
   * Generate a receipt for a payment
   */
  async generateReceipt(paymentId: string): Promise<Receipt> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Check if receipt already exists
    const existingReceipt = await this.prisma.receipt.findUnique({
      where: { paymentId },
    });

    if (existingReceipt) {
      return this.mapReceiptToType(existingReceipt);
    }

    // Generate receipt number
    const receiptNumber = await this.generateReceiptNumber();

    // Create receipt items
    const items: ReceiptItem[] = [
      {
        description: `${payment.metadata?.packageName || 'API Credits'} - ${payment.creditsPurchased} credits`,
        quantity: 1,
        unitPrice: Number(payment.amount),
        total: Number(payment.amount),
      },
    ];

    // Calculate totals
    const subtotal = Number(payment.amount);
    const tax = 0; // Digital products typically not taxed
    const total = subtotal + tax;

    // Create receipt record
    const receipt = await this.prisma.receipt.create({
      data: {
        paymentId,
        userId: payment.userId,
        receiptNumber,
        items: items as any,
        subtotal,
        tax,
        total,
        currency: payment.currency,
        billingAddress: payment.user?.metadata?.billingAddress || null,
      },
    });

    // Generate PDF
    const pdfBuffer = await this.generatePDFReceipt(receipt as any, items, payment.user);

    // In production, upload to S3 and store URL
    // For now, we'll just store locally or return buffer
    const pdfUrl = await this.storeReceiptPDF(receipt.id, pdfBuffer);

    // Update receipt with PDF URL
    await this.prisma.receipt.update({
      where: { id: receipt.id },
      data: { pdfUrl },
    });

    // Update payment with receipt URL
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { receiptUrl: pdfUrl },
    });

    logger.info('Receipt generated', {
      receiptId: receipt.id,
      paymentId,
      receiptNumber,
    });

    return this.mapReceiptToType({ ...receipt, pdfUrl });
  }

  /**
   * Get a receipt by ID
   */
  async getReceipt(receiptId: string): Promise<Receipt | null> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) return null;

    return this.mapReceiptToType(receipt);
  }

  /**
   * Get receipt by payment ID
   */
  async getReceiptByPayment(paymentId: string): Promise<Receipt | null> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { paymentId },
    });

    if (!receipt) return null;

    return this.mapReceiptToType(receipt);
  }

  /**
   * Get user's receipts
   */
  async getUserReceipts(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ receipts: Receipt[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const [receipts, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where: { userId },
        orderBy: { issuedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.receipt.count({ where: { userId } }),
    ]);

    return {
      receipts: receipts.map((r) => this.mapReceiptToType(r)),
      total,
    };
  }

  /**
   * Generate tax report for a user
   */
  async generateTaxReport(
    userId: string,
    year: number,
    quarter?: number
  ): Promise<TaxReport> {
    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (quarter) {
      startDate = new Date(year, (quarter - 1) * 3, 1);
      endDate = new Date(year, quarter * 3, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    // Get all payments in the period
    const payments = await this.prisma.payment.findMany({
      where: {
        userId,
        status: 'completed',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get all refunds in the period
    const refunds = await this.prisma.refund.findMany({
      where: {
        payment: { userId },
        status: 'completed',
        processedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate totals
    let totalRevenue = 0;
    let totalRefunds = 0;
    let totalTaxCollected = 0;

    const transactions: TaxTransaction[] = [];

    for (const payment of payments) {
      totalRevenue += Number(payment.amount);
      
      transactions.push({
        date: payment.createdAt,
        type: 'sale',
        amount: Number(payment.amount),
        tax: 0,
        currency: payment.currency,
        country: 'USA', // Default, should be from user metadata
        taxRate: 0,
      });
    }

    for (const refund of refunds) {
      totalRefunds += Number(refund.amount);
      
      transactions.push({
        date: refund.processedAt || refund.createdAt,
        type: 'refund',
        amount: Number(refund.amount),
        tax: 0,
        currency: 'USD',
        country: 'USA',
        taxRate: 0,
      });
    }

    // Create tax report record
    const taxReport = await this.prisma.taxReport.create({
      data: {
        userId,
        year,
        quarter: quarter || null,
        totalRevenue,
        totalRefunds,
        totalTaxCollected,
        transactionIds: payments.map((p) => p.id),
      },
    });

    // Generate PDF report
    const pdfBuffer = await this.generateTaxReportPDF(
      taxReport as any,
      transactions,
      userId
    );

    // Generate CSV report
    const csvBuffer = await this.generateTaxReportCSV(transactions);

    // Store files
    const pdfUrl = await this.storeTaxReportPDF(taxReport.id, pdfBuffer);
    const csvUrl = await this.storeTaxReportCSV(taxReport.id, csvBuffer);

    // Update report with URLs
    await this.prisma.taxReport.update({
      where: { id: taxReport.id },
      data: { pdfUrl, csvUrl },
    });

    logger.info('Tax report generated', {
      reportId: taxReport.id,
      userId,
      year,
      quarter,
      totalRevenue,
      totalRefunds,
    });

    return {
      id: taxReport.id,
      userId: taxReport.userId || undefined,
      year: taxReport.year,
      quarter: taxReport.quarter || undefined,
      totalRevenue: Number(taxReport.totalRevenue),
      totalRefunds: Number(taxReport.totalRefunds),
      totalTaxCollected: Number(taxReport.totalTaxCollected),
      transactions,
      generatedAt: taxReport.generatedAt,
      pdfUrl,
      csvUrl,
    };
  }

  /**
   * Get tax report for admin (all users)
   */
  async generateAdminTaxReport(
    year: number,
    quarter?: number
  ): Promise<TaxReport> {
    // Similar to user report but aggregates all payments
    let startDate: Date;
    let endDate: Date;

    if (quarter) {
      startDate = new Date(year, (quarter - 1) * 3, 1);
      endDate = new Date(year, quarter * 3, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const refunds = await this.prisma.refund.findMany({
      where: {
        status: 'completed',
        processedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

    const taxReport = await this.prisma.taxReport.create({
      data: {
        year,
        quarter: quarter || null,
        totalRevenue,
        totalRefunds,
        totalTaxCollected: 0,
        transactionIds: payments.map((p) => p.id),
      },
    });

    logger.info('Admin tax report generated', {
      reportId: taxReport.id,
      year,
      quarter,
      totalRevenue,
      totalRefunds,
      transactionCount: payments.length,
    });

    return {
      id: taxReport.id,
      year: taxReport.year,
      quarter: taxReport.quarter || undefined,
      totalRevenue: Number(taxReport.totalRevenue),
      totalRefunds: Number(taxReport.totalRefunds),
      totalTaxCollected: Number(taxReport.totalTaxCollected),
      transactions: [],
      generatedAt: taxReport.generatedAt,
    };
  }

  // ============================================================================
  // PDF GENERATION
  // ============================================================================

  private async generatePDFReceipt(
    receipt: any,
    items: ReceiptItem[],
    user: any
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    // Header
    page.drawText(this.config.companyName, {
      x: 50,
      y,
      size: 24,
      font: boldFont,
    });

    y -= 30;
    page.drawText(this.config.companyAddress, {
      x: 50,
      y,
      size: 10,
      font,
    });

    y -= 15;
    page.drawText(`Tax ID: ${this.config.taxId}`, {
      x: 50,
      y,
      size: 10,
      font,
    });

    // Receipt title
    y -= 40;
    page.drawText('RECEIPT', {
      x: 50,
      y,
      size: 20,
      font: boldFont,
    });

    // Receipt details
    y -= 30;
    page.drawText(`Receipt #: ${receipt.receiptNumber}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    y -= 20;
    page.drawText(`Date: ${receipt.issuedAt.toLocaleDateString()}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    // Customer info
    y -= 40;
    page.drawText('Bill To:', {
      x: 50,
      y,
      size: 12,
      font: boldFont,
    });

    y -= 20;
    page.drawText(user.email, {
      x: 50,
      y,
      size: 10,
      font,
    });

    // Items table
    y -= 50;
    
    // Table header
    page.drawText('Description', { x: 50, y, size: 10, font: boldFont });
    page.drawText('Qty', { x: 300, y, size: 10, font: boldFont });
    page.drawText('Price', { x: 370, y, size: 10, font: boldFont });
    page.drawText('Total', { x: 450, y, size: 10, font: boldFont });

    y -= 20;

    // Table items
    for (const item of items) {
      page.drawText(item.description, { x: 50, y, size: 10, font });
      page.drawText(item.quantity.toString(), { x: 300, y, size: 10, font });
      page.drawText(`$${item.unitPrice.toFixed(2)}`, { x: 370, y, size: 10, font });
      page.drawText(`$${item.total.toFixed(2)}`, { x: 450, y, size: 10, font });
      y -= 20;
    }

    // Totals
    y -= 20;
    page.drawLine({
      start: { x: 350, y },
      end: { x: 550, y },
      thickness: 1,
    });

    y -= 20;
    page.drawText(`Subtotal: $${receipt.subtotal.toFixed(2)}`, {
      x: 380,
      y,
      size: 12,
      font,
    });

    y -= 20;
    page.drawText(`Tax: $${receipt.tax.toFixed(2)}`, {
      x: 380,
      y,
      size: 12,
      font,
    });

    y -= 25;
    page.drawText(`Total: $${receipt.total.toFixed(2)}`, {
      x: 380,
      y,
      size: 14,
      font: boldFont,
    });

    // Footer
    y -= 60;
    page.drawText('Thank you for your business!', {
      x: 50,
      y,
      size: 10,
      font,
    });

    y -= 20;
    page.drawText('For questions about this receipt, please contact support@synapse.network', {
      x: 50,
      y,
      size: 8,
      font,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private async generateTaxReportPDF(
    report: any,
    transactions: TaxTransaction[],
    userId: string
  ): Promise<Buffer> {
    // Similar to receipt PDF but for tax report
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    // Header
    page.drawText(`${this.config.companyName} - Tax Report`, {
      x: 50,
      y,
      size: 20,
      font: boldFont,
    });

    y -= 30;
    const period = report.quarter 
      ? `Q${report.quarter} ${report.year}` 
      : `Year ${report.year}`;
    page.drawText(`Reporting Period: ${period}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    // Summary
    y -= 50;
    page.drawText('Summary', { x: 50, y, size: 14, font: boldFont });

    y -= 25;
    page.drawText(`Total Revenue: $${report.totalRevenue.toFixed(2)}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    y -= 20;
    page.drawText(`Total Refunds: $${report.totalRefunds.toFixed(2)}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    y -= 20;
    page.drawText(`Net Revenue: $${(report.totalRevenue - report.totalRefunds).toFixed(2)}`, {
      x: 50,
      y,
      size: 12,
      font: boldFont,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private async generateTaxReportCSV(transactions: TaxTransaction[]): Promise<Buffer> {
    const rows = transactions.map((t) => ({
      Date: t.date.toISOString().split('T')[0],
      Type: t.type,
      Amount: t.amount.toFixed(2),
      Tax: t.tax.toFixed(2),
      Currency: t.currency,
      Country: t.country,
      'Tax Rate': t.taxRate,
    }));

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      csv.write(rows, { headers: true })
        .pipe(writable)
        .on('finish', () => {
          resolve(Buffer.concat(chunks));
        })
        .on('error', reject);
    });
  }

  // ============================================================================
  // STORAGE (placeholder - integrate with S3 in production)
  // ============================================================================

  private async storeReceiptPDF(receiptId: string, buffer: Buffer): Promise<string> {
    // In production, upload to S3
    // return `https://${bucket}.s3.amazonaws.com/receipts/${receiptId}.pdf`;
    return `/receipts/${receiptId}.pdf`;
  }

  private async storeTaxReportPDF(reportId: string, buffer: Buffer): Promise<string> {
    return `/tax-reports/${reportId}.pdf`;
  }

  private async storeTaxReportCSV(reportId: string, buffer: Buffer): Promise<string> {
    return `/tax-reports/${reportId}.csv`;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private async generateReceiptNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Get count of receipts this month
    const count = await this.prisma.receipt.count({
      where: {
        issuedAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), 1),
        },
      },
    });

    return `SYN-${year}${month}-${(count + 1).toString().padStart(5, '0')}`;
  }

  private mapReceiptToType(receipt: any): Receipt {
    return {
      id: receipt.id,
      paymentId: receipt.paymentId,
      userId: receipt.userId,
      receiptNumber: receipt.receiptNumber,
      issuedAt: receipt.issuedAt,
      items: receipt.items as ReceiptItem[],
      subtotal: Number(receipt.subtotal),
      tax: Number(receipt.tax),
      total: Number(receipt.total),
      currency: receipt.currency,
      billingAddress: receipt.billingAddress || undefined,
      pdfUrl: receipt.pdfUrl || undefined,
      metadata: (receipt.metadata as Record<string, any>) || {},
    };
  }
}