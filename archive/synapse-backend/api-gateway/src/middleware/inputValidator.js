/**
 * Input Validation Middleware
 * Validates all incoming requests for security and correctness
 */

const { body, param, query, validationResult } = require('express-validator');
const { ethers } = require('ethers');

// Validation chains
const validateWalletAddress = [
  param('address')
    .optional()
    .custom((value) => {
      if (!ethers.isAddress(value)) {
        throw new Error('Invalid Ethereum address format');
      }
      return true;
    })
    .normalizeEmail()
    .trim(),
  
  body('address')
    .optional()
    .custom((value) => {
      if (!ethers.isAddress(value)) {
        throw new Error('Invalid Ethereum address format');
      }
      return true;
    })
];

const validateJobRequest = [
  body('jobType')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Job type must be alphanumeric with underscores/hyphens'),
  
  body('inputCid')
    .notEmpty()
    .trim()
    .matches(/^[a-zA-Z0-9]+$/)
    .isLength({ min: 46, max: 100 })
    .withMessage('Invalid IPFS CID format'),
  
  body('payment')
    .notEmpty()
    .isObject()
    .withMessage('Payment must be an object'),
  
  body('payment.amount')
    .notEmpty()
    .isString()
    .matches(/^\d+$/)
    .withMessage('Payment amount must be a numeric string'),
  
  body('payment.token')
    .notEmpty()
    .custom((value) => {
      if (!ethers.isAddress(value)) {
        throw new Error('Invalid token address');
      }
      return true;
    }),
  
  body('requirements')
    .optional()
    .isObject()
    .custom((value) => {
      if (value.gpu && typeof value.gpu !== 'string') {
        throw new Error('GPU requirement must be a string');
      }
      if (value.minVram && (typeof value.minVram !== 'number' || value.minVram < 0)) {
        throw new Error('Min VRAM must be a positive number');
      }
      if (value.maxPrice && (typeof value.maxPrice !== 'number' || value.maxPrice < 0)) {
        throw new Error('Max price must be a positive number');
      }
      return true;
    }),
  
  body('metadata')
    .optional()
    .isObject()
    .custom((value) => {
      const size = JSON.stringify(value).length;
      if (size > 10000) {
        throw new Error('Metadata object too large (max 10KB)');
      }
      return true;
    })
];

const validateSiweMessage = [
  body('message')
    .notEmpty()
    .trim()
    .isLength({ min: 100, max: 2000 })
    .withMessage('Invalid SIWE message format'),
  
  body('signature')
    .notEmpty()
    .trim()
    .matches(/^0x[a-fA-F0-9]{130}$/)
    .withMessage('Invalid Ethereum signature format')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sort')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort must be asc or desc')
];

const validateNodeRegistration = [
  body('nodeId')
    .notEmpty()
    .trim()
    .isLength({ min: 10, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid node ID format'),
  
  body('gpuModel')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 100 })
    .escape()
    .withMessage('GPU model is required'),
  
  body('vram')
    .notEmpty()
    .isInt({ min: 1, max: 1000 })
    .withMessage('VRAM must be between 1 and 1000 GB'),
  
  body('tflops')
    .notEmpty()
    .isFloat({ min: 0.1, max: 10000 })
    .withMessage('TFLOPS must be a positive number'),
  
  body('region')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 50 })
    .isIn(['us-east', 'us-west', 'eu-west', 'eu-central', 'ap-south', 'ap-northeast', 'ap-southeast', 'sa-east'])
    .withMessage('Invalid region specified'),
  
  body('pricePerHour')
    .notEmpty()
    .isString()
    .matches(/^\d+$/)
    .withMessage('Price must be a numeric string (wei)')
];

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potentially dangerous keys
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
  };
  
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  
  next();
};

// Main validation middleware
const inputValidator = (req, res, next) => {
  sanitizeInput(req, res, () => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.path,
          message: err.msg,
          value: err.value
        })),
        requestId: req.id
      });
    }
    
    next();
  });
};

module.exports = {
  inputValidator,
  validateWalletAddress,
  validateJobRequest,
  validateSiweMessage,
  validatePagination,
  validateNodeRegistration,
  sanitizeInput
};
