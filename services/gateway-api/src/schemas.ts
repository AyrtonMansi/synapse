import { z } from 'zod';

// Email validation regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Ethereum address validation (0x followed by 40 hex chars)
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

// P1.2: New API key format validation
// Format: syn_live_<16-char-keyId>_<32-char-secret>
// Example: syn_live_a1b2c3d4e5f67890_1234567890abcdef1234567890abcdef
const apiKeyRegex = /^syn_live_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$/;

/**
 * P1.2: Schema for creating an API key
 * Generates keys in format: syn_live_<16-char-keyId>_<32-char-secret>
 * - keyId enables O(1) DB lookup
 * - secret enables bcrypt verification
 */
export const createApiKeySchema = z.object({
  email: z.string()
    .regex(emailRegex, 'Invalid email format')
    .optional(),
  wallet: z.string()
    .regex(ethereumAddressRegex, 'Invalid Ethereum wallet address (must be 0x followed by 40 hex characters)')
    .optional(),
}).refine(
  (data) => data.email || data.wallet,
  { message: 'Either email or wallet must be provided' }
);

/**
 * P1.2: API key validation schema
 */
export const apiKeySchema = z.string()
  .regex(apiKeyRegex, 'Invalid API key format. Expected: syn_live_<16-char-keyId>_<32-char-secret>');

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/**
 * Message schema for chat completions
 */
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(1).max(32768), // Max 32KB per message
  name: z.string().max(64).optional(),
});

/**
 * Schema for chat completions (OpenAI compatible)
 */
export const chatCompletionSchema = z.object({
  model: z.string().min(1).max(64),
  messages: z.array(messageSchema)
    .min(1)
    .max(100), // Max 100 messages per request
  stream: z.boolean().optional().default(false),
  temperature: z.number()
    .min(0)
    .max(2)
    .optional()
    .default(0.7),
  max_tokens: z.number()
    .int()
    .min(1)
    .max(8192)
    .optional()
    .default(512),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().min(1).max(10).optional().default(1),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  presence_penalty: z.number().min(-2).max(2).optional().default(0),
  frequency_penalty: z.number().min(-2).max(2).optional().default(0),
  user: z.string().max(64).optional(),
});

export type ChatCompletionInput = z.infer<typeof chatCompletionSchema>;
