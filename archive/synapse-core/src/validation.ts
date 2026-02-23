/**
 * Input Validation Utilities
 * 
 * @module synapse-core/validation
 * @description Type-safe validation functions for common inputs
 */

import { ValidationError } from './errors.js';

/**
 * Ethereum address validation
 * @param address - Address to validate
 * @returns Normalized lowercase address
 * @throws ValidationError if invalid
 */
export function validateAddress(address: string): string {
  const normalized = address.toLowerCase().trim();
  
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new ValidationError('Invalid Ethereum address format', { address });
  }
  
  return normalized;
}

/**
 * Check if string is valid Ethereum address
 * @param address - String to check
 */
export function isValidAddress(address: string): boolean {
  try {
    validateAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate token amount
 * @param amount - Amount string to validate
 * @param maxDecimals - Maximum decimal places (default 18)
 * @returns Normalized amount string
 * @throws ValidationError if invalid
 */
export function validateTokenAmount(
  amount: string,
  maxDecimals = 18
): string {
  const trimmed = amount.trim();
  
  // Check format
  const decimalPattern = maxDecimals === 0 
    ? /^\d+$/
    : new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);
    
  if (!decimalPattern.test(trimmed)) {
    throw new ValidationError(
      `Invalid token amount format (max ${maxDecimals} decimals)`,
      { amount, maxDecimals }
    );
  }
  
  // Check non-negative
  const value = parseFloat(trimmed);
  if (value < 0 || !isFinite(value)) {
    throw new ValidationError('Token amount must be non-negative', { amount });
  }
  
  return trimmed;
}

/**
 * Check if string is valid token amount
 * @param amount - String to check
 * @param maxDecimals - Maximum decimal places
 */
export function isValidTokenAmount(amount: string, maxDecimals = 18): boolean {
  try {
    validateTokenAmount(amount, maxDecimals);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate job ID format
 * @param jobId - Job ID to validate
 * @returns Validated job ID
 * @throws ValidationError if invalid
 */
export function validateJobId(jobId: string): string {
  const trimmed = jobId.trim();
  
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    throw new ValidationError(
      'Invalid job ID format (alphanumeric, hyphens, underscores only)',
      { jobId }
    );
  }
  
  return trimmed;
}

/**
 * Validate node ID format (UUID)
 * @param nodeId - Node ID to validate
 * @returns Validated node ID
 * @throws ValidationError if invalid
 */
export function validateNodeId(nodeId: string): string {
  const trimmed = nodeId.trim();
  
  // UUID v4 pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidPattern.test(trimmed)) {
    throw new ValidationError(
      'Invalid node ID format (must be valid UUID v4)',
      { nodeId }
    );
  }
  
  return trimmed.toLowerCase();
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @param allowedProtocols - Allowed protocols (default: ['https:', 'http:'])
 * @returns Validated URL string
 * @throws ValidationError if invalid
 */
export function validateUrl(
  url: string,
  allowedProtocols: string[] = ['https:', 'http:']
): string {
  try {
    const parsed = new URL(url.trim());
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new ValidationError(
        `Invalid URL protocol. Allowed: ${allowedProtocols.join(', ')}`,
        { url, protocol: parsed.protocol }
      );
    }
    
    return parsed.toString();
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError('Invalid URL format', { url });
  }
}

/**
 * Validate non-empty string
 * @param value - String to validate
 * @param fieldName - Name of field for error message
 * @returns Trimmed string
 * @throws ValidationError if empty
 */
export function validateNonEmpty(value: string, fieldName = 'Value'): string {
  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  
  return trimmed;
}

/**
 * Validate number is in range
 * @param value - Number to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param fieldName - Name of field for error message
 * @returns Validated number
 * @throws ValidationError if out of range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName = 'Value'
): number {
  if (!isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, { value });
  }
  
  if (value < min || value > max) {
    throw new ValidationError(
      `${fieldName} must be between ${min} and ${max}`,
      { value, min, max }
    );
  }
  
  return value;
}

/**
 * Validate array is not empty
 * @param array - Array to validate
 * @param fieldName - Name of field for error message
 * @returns Validated array
 * @throws ValidationError if empty
 */
export function validateNonEmptyArray<T>(
  array: T[],
  fieldName = 'Array'
): T[] {
  if (!Array.isArray(array) || array.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty array`);
  }
  
  return array;
}

/**
 * Validate object has required keys
 * @param obj - Object to validate
 * @param requiredKeys - Required key names
 * @param objectName - Name of object for error message
 * @returns Validated object
 * @throws ValidationError if keys missing
 */
export function validateRequiredKeys<T extends Record<string, unknown>>(
  obj: T,
  requiredKeys: Array<keyof T>,
  objectName = 'Object'
): T {
  const missing = requiredKeys.filter(key => !(key in obj) || obj[key] === undefined);
  
  if (missing.length > 0) {
    throw new ValidationError(
      `${objectName} missing required keys: ${missing.join(', ')}`,
      { missing, provided: Object.keys(obj) }
    );
  }
  
  return obj;
}
