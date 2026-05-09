// src/routes/leads.js
// POST /api/leads — capture email after audit value is shown
// GET  /api/leads — admin listing (should be behind auth in production)

import express from 'express';
import { nanoid } from 'nanoid';
import getDb from '../db/index.js';
import { LeadCaptureSchema, parseOrError } from '../utils/validation.js';
import { sendAuditConfirmation, sendInternalHighValueAlert } from '../services/emailService.js';

const router = express.Router();

// ─── POST /api/leads ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // 1. Honeypot check — bots fill hidden 'website' field
  if (req.body.website) {
    // Respond 200 to not signal the bot; do nothing
    return res.status(200).json({ ok: true });
  }

  // 2. Validate
  const { data, error, details } = parseOrError(LeadCaptureSchema, req.body);
  if (error) return res.status(400).json({ error, details });

  const db = getDb();

  // 3. Verify audit exists
  const audit = db.prepare('SELECT * FROM audits WHERE id = ?').get(data.auditId);
  if (!audit) return res.status(404).json({ error: 'Audit not found. Run an audit first.' });

  // 4. Idempotency — don't double-save the same email for the same audit
  const existing = db.prepare('SELECT id FROM leads WHERE email = ? AND audit_id = ?').get(data.email, data.auditId);
  if (existing) {
    return res.status(200).json({ ok: true, leadId: existing.id, duplicate: true });
  }

  // 5. Persist lead
  const leadId = nanoid(10);
  const isHighValue = audit.total_saving >= 500 ? 1 : 0;

  db.prepare(`
    INSERT INTO leads (id, email, company_name, role, team_size_range, audit_id, total_saving, is_high_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    leadId,
    data.email,
    data.companyName || null,
    data.role || null,
    data.teamSizeRange || null,
    data.auditId,
    audit.total_saving,
    isHighValue,
  );

  // 6. Link lead back to audit
  db.prepare('UPDATE audits SET lead_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(leadId, data.auditId);

  // 7. Send confirmation email (non-blocking)
  const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/audit/${audit.share_token}`;

  sendAuditConfirmation({
    email: data.email,
    companyName: data.companyName,
    totalSpend: audit.total_spend,
    totalSaving: audit.total_saving,
    annualSaving: audit.total_saving * 12,
    shareUrl,
    isHighValue: Boolean(isHighValue),
  }).then(({ ok }) => {
    if (ok) {
      db.prepare('UPDATE leads SET confirmation_sent_at = datetime(\'now\') WHERE id = ?').run(leadId);
    }
  });

  // 8. Alert Credex team for high-value leads
  if (isHighValue) {
    sendInternalHighValueAlert({
      email: data.email,
      companyName: data.companyName,
      totalSaving: audit.total_saving,
      auditId: data.auditId,
    }).then(() => {
      db.prepare('UPDATE leads SET credex_notified_at = datetime(\'now\') WHERE id = ?').run(leadId);
    });
  }

  return res.status(201).json({
    ok: true,
    leadId,
    shareUrl,
    isHighValue: Boolean(isHighValue),
  });
});

// ─── GET /api/leads ───────────────────────────────────────────────────────────
// Basic admin view — in production, add auth middleware before this route
router.get('/', (req, res) => {
  const db = getDb();
  const leads = db.prepare(`
    SELECT l.*, a.total_spend, a.use_case, a.team_size
    FROM leads l
    LEFT JOIN audits a ON l.audit_id = a.id
    ORDER BY l.created_at DESC
    LIMIT 100
  `).all();
  return res.json({ leads, count: leads.length });
});

export default router;
