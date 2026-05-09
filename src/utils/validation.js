// src/utils/validation.js
// Zod schemas for all API inputs.
// Keeping validation in one file makes it easy to test and audit.

import { z } from 'zod';

const VALID_TOOLS = ['cursor', 'copilot', 'claude', 'chatgpt', 'gemini', 'windsurf', 'openai_api', 'anthropic_api'];
const VALID_USE_CASES = ['coding', 'writing', 'data', 'research', 'mixed'];

// ─── Tool input ───────────────────────────────────────────────────────────────

const ToolInputSchema = z.object({
  plan: z.number().int().min(0).max(10),
  seats: z.number().int().min(1).max(10000),
  monthly: z.number().min(0).max(1_000_000),
});

// ─── Audit request ────────────────────────────────────────────────────────────

export const AuditRequestSchema = z.object({
  teamSize: z.number().int().min(1).max(100_000),
  devCount: z.number().int().min(0).max(100_000),
  useCase: z.enum(VALID_USE_CASES),
  tools: z.record(z.enum(VALID_TOOLS), ToolInputSchema).refine(
    (tools) => Object.keys(tools).length >= 1,
    { message: 'At least one tool is required' }
  ),
});

// ─── Lead capture request ─────────────────────────────────────────────────────

export const LeadCaptureSchema = z.object({
  auditId: z.string().min(1).max(50),
  email: z.string().email().max(254),
  companyName: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  teamSizeRange: z.enum(['1-5', '6-20', '21-50', '51-200', '200+']).optional(),
  // Honeypot field — must be empty
  website: z.string().max(0).optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * parseOrError(schema, data)
 * Returns { data } on success, { error, details } on failure.
 */
export function parseOrError(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data };
  const details = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  return { error: 'Validation failed', details };
}
