// src/middleware/rateLimiter.js
// Applies express-rate-limit to sensitive endpoints.
// We use a tiered approach:
//   - /api/audits  → 20 req / 15 min per IP  (audit runs are cheap but shouldn't be abused)
//   - /api/leads   → 5  req / 15 min per IP  (lead capture — tightest limit to prevent spam)
//   - global       → 200 req / 15 min per IP

import rateLimit from 'express-rate-limit';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 min

export const globalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

export const auditLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many audits from this IP. Try again in 15 minutes.' },
});

export const leadLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lead submissions from this IP. Try again in 15 minutes.' },
});
