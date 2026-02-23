/**
 * Job Router Service
 * 
 * Handles model validation, price calculation, and job routing
 * with support for the latest open-source models.
 */

import { ethers } from 'ethers';
import ModelRegistryABI from '../abis/ModelRegistry.json';

// Model Registry Contract Interface
const MODEL_REGISTRY_ADDRESS = process.env.MODEL_REGISTRY_CONTRACT || '0x0000000000000000000000000000000000000000';

// Model pricing cache (in-memory with TTL)
interface CachedPrice {
  price: bigint;
  timestamp: number;
}

const priceCache: Map<string, CachedPrice> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Supported models with local validation
export interface ModelConfig {
  modelId: string;
  name: string;
  description: string;
  pricePerToken: string; // In wei
  minVramGB: number;
  maxVramGB: number;
  contextLength: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsJson: boolean;
  status: 'active' | 'deprecated' | 'pending';
}

// Local model registry (fallback + cache)
export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
  // DeepSeek Models
  'deepseek-ai/DeepSeek-V3': {
    modelId: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    description: 'DeepSeek-V3 is a powerful MoE language model with 671B total parameters',
    pricePerToken: '50000000000000', // 0.00005 HSK per token
    minVramGB: 80,
    maxVramGB: 160,
    contextLength: 64000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  'deepseek-ai/DeepSeek-R1': {
    modelId: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1',
    description: 'DeepSeek-R1 is a reasoning model trained with RL for complex tasks',
    pricePerToken: '60000000000000', // 0.00006 HSK per token
    minVramGB: 80,
    maxVramGB: 160,
    contextLength: 64000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  
  // Llama 3.1 Models
  'meta-llama/Meta-Llama-3.1-8B': {
    modelId: 'meta-llama/Meta-Llama-3.1-8B',
    name: 'Llama 3.1 8B',
    description: "Meta's efficient 8B parameter multilingual model",
    pricePerToken: '8000000000000', // 0.000008 HSK per token (cheapest)
    minVramGB: 8,
    maxVramGB: 16,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  'meta-llama/Meta-Llama-3.1-70B': {
    modelId: 'meta-llama/Meta-Llama-3.1-70B',
    name: 'Llama 3.1 70B',
    description: "Meta's powerful 70B parameter multilingual model",
    pricePerToken: '30000000000000', // 0.00003 HSK per token
    minVramGB: 40,
    maxVramGB: 80,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  
  // Llama 3.2 Models
  'meta-llama/Llama-3.2-3B-Instruct': {
    modelId: 'meta-llama/Llama-3.2-3B-Instruct',
    name: 'Llama 3.2 3B',
    description: 'Lightweight edge-optimized 3B model for mobile/edge devices',
    pricePerToken: '5000000000000', // 0.000005 HSK per token (very cheap)
    minVramGB: 4,
    maxVramGB: 8,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  'meta-llama/Llama-3.2-90B-Vision-Instruct': {
    modelId: 'meta-llama/Llama-3.2-90B-Vision-Instruct',
    name: 'Llama 3.2 90B Vision',
    description: 'Multimodal vision model with 90B parameters',
    pricePerToken: '50000000000000', // 0.00005 HSK per token
    minVramGB: 80,
    maxVramGB: 160,
    contextLength: 128000,
    supportsVision: true,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  
  // Mistral Models
  'mistralai/Mistral-Large-Instruct-2407': {
    modelId: 'mistralai/Mistral-Large-Instruct-2407',
    name: 'Mistral Large 2',
    description: "Mistral's flagship model with advanced reasoning and multilingual support",
    pricePerToken: '40000000000000', // 0.00004 HSK per token
    minVramGB: 64,
    maxVramGB: 128,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  'mistralai/Mixtral-8x22B-Instruct-v0.1': {
    modelId: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
    name: 'Mixtral 8x22B',
    description: 'Sparse MoE model with 8 experts, 141B total parameters',
    pricePerToken: '35000000000000', // 0.000035 HSK per token
    minVramGB: 48,
    maxVramGB: 96,
    contextLength: 64000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  
  // Qwen Models
  'Qwen/Qwen2.5-72B-Instruct': {
    modelId: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    description: "Alibaba's powerful multilingual model with 72B parameters",
    pricePerToken: '28000000000000', // 0.000028 HSK per token
    minVramGB: 40,
    maxVramGB: 80,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
  
  // Google Gemma Models
  'google/gemma-2-27b-it': {
    modelId: 'google/gemma-2-27b-it',
    name: 'Gemma 2 27B',
    description: "Google's efficient open model with advanced reasoning",
    pricePerToken: '18000000000000', // 0.000018 HSK per token
    minVramGB: 20,
    maxVramGB: 40,
    contextLength: 8192,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
  },
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
  modelConfig?: ModelConfig;
}

export interface PriceEstimate {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  pricePerToken: string;
  totalPrice: string;
  platformFee: string;
  currency: string;
}

/**
 * Validate if a model exists and supports requested features
 */
export function validateModelRequest(
  modelId: string,
  options?: {
    requiresVision?: boolean;
    requiresTools?: boolean;
    requiresJson?: boolean;
    maxTokens?: number;
  }
): ValidationResult {
  const model = SUPPORTED_MODELS[modelId];
  
  if (!model) {
    return {
      valid: false,
      error: `Model '${modelId}' not found. Available models: ${Object.keys(SUPPORTED_MODELS).join(', ')}`,
    };
  }
  
  if (model.status !== 'active') {
    return {
      valid: false,
      error: `Model '${modelId}' is currently ${model.status}. Please use an alternative model.`,
    };
  }
  
  if (options?.requiresVision && !model.supportsVision) {
    return {
      valid: false,
      error: `Model '${modelId}' does not support vision/multimodal inputs. Try 'meta-llama/Llama-3.2-90B-Vision-Instruct' instead.`,
    };
  }
  
  if (options?.requiresTools && !model.supportsTools) {
    return {
      valid: false,
      error: `Model '${modelId}' does not support function calling/tools.`,
    };
  }
  
  if (options?.requiresJson && !model.supportsJson) {
    return {
      valid: false,
      error: `Model '${modelId}' does not support JSON mode.`,
    };
  }
  
  if (options?.maxTokens && options.maxTokens > model.contextLength) {
    return {
      valid: false,
      error: `Requested maxTokens (${options.maxTokens}) exceeds model's context length (${model.contextLength}).`,
    };
  }
  
  return {
    valid: true,
    modelConfig: model,
  };
}

/**
 * Calculate price for a job request
 */
export function calculateJobPrice(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  userTier: number = 0
): PriceEstimate {
  const model = SUPPORTED_MODELS[modelId];
  
  if (!model) {
    throw new Error(`Model '${modelId}' not found`);
  }
  
  const pricePerToken = BigInt(model.pricePerToken);
  const totalTokens = BigInt(inputTokens + outputTokens);
  
  // Apply tier discount
  const discounts = [0, 10, 20, 30]; // Tier 0-3 discounts
  const discount = discounts[userTier] || 0;
  
  // Calculate base price with discount
  const discountMultiplier = BigInt(100 - discount);
  const basePrice = (pricePerToken * totalTokens * discountMultiplier) / BigInt(100);
  
  // Add platform fee (5%)
  const platformFeePercent = BigInt(500); // 5% in basis points
  const platformFee = (basePrice * platformFeePercent) / BigInt(10000);
  const totalPrice = basePrice + platformFee;
  
  return {
    modelId,
    inputTokens,
    outputTokens,
    pricePerToken: model.pricePerToken,
    totalPrice: totalPrice.toString(),
    platformFee: platformFee.toString(),
    currency: 'HSK',
  };
}

/**
 * Get price estimate formatted for display
 */
export function getPriceEstimateDisplay(
  modelId: string,
  inputTokens: number = 1000,
  outputTokens: number = 500
): string {
  try {
    const estimate = calculateJobPrice(modelId, inputTokens, outputTokens);
    const totalEth = ethers.formatEther(estimate.totalPrice);
    return `${totalEth} HSK (~${inputTokens + outputTokens} tokens)`;
  } catch (error) {
    return 'Price unavailable';
  }
}

/**
 * Get models compatible with given VRAM constraints
 */
export function getModelsByVram(maxVramGB: number): ModelConfig[] {
  return Object.values(SUPPORTED_MODELS).filter(
    (model) => model.minVramGB <= maxVramGB && model.status === 'active'
  );
}

/**
 * Get models by feature support
 */
export function getModelsByFeature(options: {
  vision?: boolean;
  tools?: boolean;
  json?: boolean;
}): ModelConfig[] {
  return Object.values(SUPPORTED_MODELS).filter((model) => {
    if (options.vision && !model.supportsVision) return false;
    if (options.tools && !model.supportsTools) return false;
    if (options.json && !model.supportsJson) return false;
    return model.status === 'active';
  });
}

/**
 * Get all active models sorted by price
 */
export function getAllModelsSortedByPrice(): ModelConfig[] {
  return Object.values(SUPPORTED_MODELS)
    .filter((model) => model.status === 'active')
    .sort((a, b) => {
      const priceA = BigInt(a.pricePerToken);
      const priceB = BigInt(b.pricePerToken);
      return priceA < priceB ? -1 : priceA > priceB ? 1 : 0;
    });
}

/**
 * Get hardware requirements for node operators
 */
export function getHardwareRequirements(modelId: string): {
  minVramGB: number;
  recommendedVramGB: number;
  canRun: boolean;
} | null {
  const model = SUPPORTED_MODELS[modelId];
  if (!model) return null;
  
  return {
    minVramGB: model.minVramGB,
    recommendedVramGB: model.maxVramGB,
    canRun: true, // Will be determined by node's actual VRAM
  };
}

/**
 * Get model recommendations based on use case
 */
export function getModelRecommendations(useCase: string): ModelConfig[] {
  const useCaseLower = useCase.toLowerCase();
  
  if (useCaseLower.includes('vision') || useCaseLower.includes('image')) {
    return Object.values(SUPPORTED_MODELS).filter((m) => m.supportsVision);
  }
  
  if (useCaseLower.includes('code') || useCaseLower.includes('programming')) {
    return [
      SUPPORTED_MODELS['deepseek-ai/DeepSeek-V3'],
      SUPPORTED_MODELS['deepseek-ai/DeepSeek-R1'],
      SUPPORTED_MODELS['meta-llama/Meta-Llama-3.1-70B'],
    ].filter(Boolean);
  }
  
  if (useCaseLower.includes('cheap') || useCaseLower.includes('fast')) {
    return [
      SUPPORTED_MODELS['meta-llama/Llama-3.2-3B-Instruct'],
      SUPPORTED_MODELS['meta-llama/Meta-Llama-3.1-8B'],
      SUPPORTED_MODELS['google/gemma-2-27b-it'],
    ].filter(Boolean);
  }
  
  if (useCaseLower.includes('multilingual') || useCaseLower.includes('chinese')) {
    return [
      SUPPORTED_MODELS['Qwen/Qwen2.5-72B-Instruct'],
      SUPPORTED_MODELS['meta-llama/Meta-Llama-3.1-70B'],
      SUPPORTED_MODELS['mistralai/Mistral-Large-Instruct-2407'],
    ].filter(Boolean);
  }
  
  // Default: return all active models
  return getAllModelsSortedByPrice();
}

/**
 * Fetch model price from on-chain registry (with caching)
 */
export async function fetchModelPriceFromChain(
  provider: ethers.Provider,
  modelId: string
): Promise<string | null> {
  // Check cache first
  const cached = priceCache.get(modelId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.price.toString();
  }
  
  try {
    const contract = new ethers.Contract(
      MODEL_REGISTRY_ADDRESS,
      ModelRegistryABI,
      provider
    );
    
    const model = await contract.getModel(modelId);
    const price = model.pricePerToken;
    
    // Update cache
    priceCache.set(modelId, {
      price,
      timestamp: Date.now(),
    });
    
    return price.toString();
  } catch (error) {
    console.error(`Failed to fetch price for ${modelId}:`, error);
    // Return local fallback
    return SUPPORTED_MODELS[modelId]?.pricePerToken || null;
  }
}

/**
 * Clear price cache
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

/**
 * Format price for display
 */
export function formatPrice(weiAmount: string): string {
  try {
    const eth = ethers.formatEther(weiAmount);
    const num = parseFloat(eth);
    
    if (num < 0.000001) {
      return `${(num * 1000000).toFixed(2)} µHSK`;
    } else if (num < 0.001) {
      return `${(num * 1000).toFixed(2)} mHSK`;
    } else if (num < 1) {
      return `${num.toFixed(6)} HSK`;
    } else {
      return `${num.toFixed(4)} HSK`;
    }
  } catch {
    return `${weiAmount} wei`;
  }
}
