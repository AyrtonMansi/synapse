/**
 * Request Logger Middleware
 * 
 * @module synapse-payments/middleware/requestLogger
 * @description Logs all incoming requests
 */

import type { Response, NextFunction } from 'express';
import crypto from 'crypto';
import type { AuthenticatedRequest } from '../types';
import { logger } from '../index';

export function requestLogger(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID
  req.requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response time on finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, 'Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId: req.requestId,
    });
  });

  next();
}