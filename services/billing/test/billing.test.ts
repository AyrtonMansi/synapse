/**
 * PHASE 1: USD-Stable Pricing Integration Test
 * Proves that USD cost stays constant regardless of HSK price volatility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateCost, 
  updateExchangeRate, 
  chargeUsage,
  deposit,
  getBalance 
} from '../src/billing.js';

describe('USD-Stable Pricing', () => {
  beforeEach(() => {
    // Reset to known rate
    updateExchangeRate(0.10); // 1 HSK = $0.10
  });

  it('should calculate same USD cost regardless of HSK rate changes', () => {
    const model = 'deepseek-v3';
    const tokensIn = 1000;
    const tokensOut = 500;
    
    // Calculate cost at initial rate
    const cost1 = calculateCost(model, tokensIn, tokensOut);
    expect(cost1.usd).toBe(0.003); // $2 per 1M * 1500 tokens
    expect(cost1.hsk).toBe(0.03);  // $0.003 / $0.10 rate
    
    // HSK price drops 50% (now worth $0.05)
    updateExchangeRate(0.05);
    
    // Same request should cost same USD, more HSK
    const cost2 = calculateCost(model, tokensIn, tokensOut);
    expect(cost2.usd).toBe(0.003); // USD unchanged!
    expect(cost2.hsk).toBe(0.06);  // Double the HSK
    
    // HSK price doubles (now worth $0.20)
    updateExchangeRate(0.20);
    
    const cost3 = calculateCost(model, tokensIn, tokensOut);
    expect(cost3.usd).toBe(0.003); // USD still unchanged!
    expect(cost3.hsk).toBe(0.015); // Half the HSK
  });

  it('should enforce different pricing per model', () => {
    const tokens = 1_000_000; // 1M tokens
    
    const cheap = calculateCost('echo-stub', tokens, 0);
    const expensive = calculateCost('deepseek-v3', tokens, 0);
    
    expect(cheap.usd).toBe(0.01);   // $0.01 per 1M
    expect(expensive.usd).toBe(2.00); // $2.00 per 1M
    expect(expensive.usd).toBe(200 * cheap.usd);
  });

  it('should reject negative exchange rates', () => {
    expect(() => updateExchangeRate(-1)).toThrow();
    expect(() => updateExchangeRate(0)).toThrow();
  });

  it('should track spending in both USD and HSK', () => {
    const keyId = 'test-key-123';
    
    // Deposit funds
    deposit(keyId, 100, 1000); // $100 USD, 1000 HSK
    
    const balance1 = getBalance(keyId);
    expect(balance1.usdBalance).toBe(100);
    
    // Make request at $0.10 rate
    updateExchangeRate(0.10);
    const result1 = chargeUsage(keyId, 'node-1', 'deepseek-v3', 500000, 500000);
    expect(result1.success).toBe(true);
    expect(result1.usd).toBe(2.00); // $2 for 1M tokens
    
    // Change rate and make same request
    updateExchangeRate(0.05); // HSK drops
    const result2 = chargeUsage(keyId, 'node-1', 'deepseek-v3', 500000, 500000);
    expect(result2.success).toBe(true);
    expect(result2.usd).toBe(2.00); // Same USD cost!
    expect(result2.hsk).toBe(40);   // More HSK charged
    
    // Total USD spent should be $4
    const stats = getBalance(keyId);
    expect(stats.totalSpent).toBe(4.00);
  });

  it('should reject requests when balance insufficient', () => {
    const keyId = 'poor-key';
    deposit(keyId, 1, 10); // Only $1
    
    const result = chargeUsage(keyId, 'node-1', 'deepseek-v3', 1000000, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient balance');
  });
});

describe('Concurrency Caps', () => {
  it('should enforce max concurrent requests per key', () => {
    const keyId = 'concurrent-test';
    
    // Should allow first 10
    for (let i = 0; i < 10; i++) {
      const check = checkConcurrency(keyId);
      expect(check.allowed).toBe(true);
    }
    
    // 11th should be rejected
    const blocked = checkConcurrency(keyId);
    expect(blocked.allowed).toBe(false);
    
    // Release one
    releaseConcurrency(keyId);
    
    // Now should allow
    const allowed = checkConcurrency(keyId);
    expect(allowed.allowed).toBe(true);
  });
});

import { checkConcurrency, releaseConcurrency } from '../src/billing.js';
