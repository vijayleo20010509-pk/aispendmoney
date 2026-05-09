// src/index.js
// SpendScout API server
// Boots Express, registers middleware + routes, starts listening.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Run migrations on startup (idempotent — safe to run every boot)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
await import('./db/migrate.js');

import auditsRouter from './routes/audits.js';
import leadsRouter from './routes/leads.js';
import { globalLimiter, auditLimiter, leadLimiter } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.set('trust proxy', 1); // Required for rate-limiter to see real IP behind Vercel/Render proxy

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
    'https://spendscout.credex.rocks',
    'https://www.spendscout.credex.rocks',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));
app.use(globalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/audits', auditLimiter, auditsRouter);
app.use('/api/leads', leadLimiter, leadsRouter);

// Public share route — looser rate limiting
app.use('/api/share', auditsRouter);

// ─── 404 catch-all ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[error]', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 SpendScout API running on http://localhost:${PORT}`);
  console.log(`   NODE_ENV:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database:     ${process.env.DATABASE_PATH || './data/spendscout.db'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`);
});

export default app;
