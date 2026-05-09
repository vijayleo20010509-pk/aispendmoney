// src/routes/audits.js
// POST /api/audits       — run an audit and persist it
// GET  /api/audits/:id   — get a saved audit (private — requires exact ID)
// GET  /api/share/:token — get a public stripped audit by share token

import express from 'express';
import { nanoid } from 'nanoid';
import getDb from '../db/index.js';
import { runAudit } from '../services/auditEngine.js';
import { generateSummary } from '../services/aiSummary.js';
import { AuditRequestSchema, parseOrError } from '../utils/validation.js';

const router = express.Router();

// ─── POST /api/audits ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // 1. Validate input
  const { data, error, details } = parseOrError(AuditRequestSchema, req.body);
  if (error) return res.status(400).json({ error, details });

  // 2. Run audit engine (synchronous, deterministic)
  const auditResult = runAudit(data);

  // 3. Generate AI summary (async, with fallback)
  const { summary, source: summarySource } = await generateSummary(auditResult);

  // 4. Persist to DB
  const id = nanoid(8);
  const shareToken = nanoid(12);

  const db = getDb();
  db.prepare(`
    INSERT INTO audits (id, team_size, dev_count, use_case, tools_input,
                        total_spend, total_saving, results_json, ai_summary, share_token, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    data.teamSize,
    data.devCount,
    data.useCase,
    JSON.stringify(data.tools),
    auditResult.totalSpend,
    auditResult.totalSaving,
    JSON.stringify(auditResult.results),
    summary,
    shareToken,
  );

  // 5. Respond
  return res.status(201).json({
    auditId: id,
    shareToken,
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/audit/${shareToken}`,
    summarySource,
    audit: {
      ...auditResult,
      summary,
    },
  });
});

// ─── GET /api/audits/:id ──────────────────────────────────────────────────────
// Returns full audit including PII-linked lead data — keep private.
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM audits WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Audit not found' });

  return res.json({
    auditId: row.id,
    createdAt: row.created_at,
    teamSize: row.team_size,
    devCount: row.dev_count,
    useCase: row.use_case,
    totalSpend: row.total_spend,
    totalSaving: row.total_saving,
    annualSaving: row.total_saving * 12,
    results: JSON.parse(row.results_json),
    summary: row.ai_summary,
    shareToken: row.share_token,
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/audit/${row.share_token}`,
  });
});

// ─── GET /api/share/:token ────────────────────────────────────────────────────
// Public endpoint — strips email/company; returns tools + savings only
router.get('/share/:token', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM audits WHERE share_token = ?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Audit not found' });

  // Strip identifying fields — public version is safe to embed in OG previews
  return res.json({
    auditId: row.id,
    createdAt: row.created_at,
    useCase: row.use_case,
    totalSpend: row.total_spend,
    totalSaving: row.total_saving,
    annualSaving: row.total_saving * 12,
    wasteRate: row.total_spend > 0
      ? Math.round((row.total_saving / row.total_spend) * 100)
      : 0,
    results: JSON.parse(row.results_json),
    summary: row.ai_summary,
    // teamSize is included — not PII
    teamSize: row.team_size,
  });
});

export default router;
