import { z } from 'zod';

// Email validation regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Ethereum address validation (0x followed by 40 hex chars)
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

/**
 * Schema for creating an API key
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
