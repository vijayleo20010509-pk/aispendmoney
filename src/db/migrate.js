// src/db/migrate.js
// Run: node src/db/migrate.js
// Creates all tables if they don't exist. Safe to run repeatedly.

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || './data/spendscout.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
  -- ── audits ───────────────────────────────────────────────────────────────
  -- Each completed audit (before or after email capture)
  CREATE TABLE IF NOT EXISTS audits (
    id              TEXT PRIMARY KEY,           -- nanoid, e.g. "a7f3k9"
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    -- Input snapshot (stored as JSON for flexibility)
    team_size       INTEGER NOT NULL,
    dev_count       INTEGER NOT NULL,
    use_case        TEXT NOT NULL,              -- coding | writing | data | research | mixed
    tools_input     TEXT NOT NULL,             -- JSON: { cursor: { plan:1, seats:3, monthly:60 }, ... }

    -- Computed results (denormalised for fast retrieval)
    total_spend     REAL NOT NULL DEFAULT 0,
    total_saving    REAL NOT NULL DEFAULT 0,
    results_json    TEXT NOT NULL,             -- JSON: full per-tool breakdown

    -- AI summary (may be null if API was down)
    ai_summary      TEXT,

    -- Share state
    share_token     TEXT UNIQUE,               -- stripped of PII, public
    is_public       INTEGER NOT NULL DEFAULT 0,

    -- Lead state
    lead_id         TEXT REFERENCES leads(id)
  );

  -- ── leads ────────────────────────────────────────────────────────────────
  -- Email-gated lead capture (separate from audit for privacy)
  CREATE TABLE IF NOT EXISTS leads (
    id              TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),

    email           TEXT NOT NULL,
    company_name    TEXT,
    role            TEXT,
    team_size_range TEXT,

    audit_id        TEXT NOT NULL REFERENCES audits(id),
    total_saving    REAL NOT NULL DEFAULT 0,   -- snapshot for CRM segmentation
    is_high_value   INTEGER NOT NULL DEFAULT 0, -- saving >= 500

    -- Email send tracking
    confirmation_sent_at TEXT,
    credex_notified_at   TEXT
  );

  -- ── rate_limit_log ────────────────────────────────────────────────────────
  -- Lightweight abuse log (complement to express-rate-limit in-memory)
  CREATE TABLE IF NOT EXISTS rate_limit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip         TEXT NOT NULL,
    path       TEXT NOT NULL,
    at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Indexes ───────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_audits_share_token  ON audits(share_token);
  CREATE INDEX IF NOT EXISTS idx_audits_created_at   ON audits(created_at);
  CREATE INDEX IF NOT EXISTS idx_leads_email         ON leads(email);
  CREATE INDEX IF NOT EXISTS idx_leads_audit_id      ON leads(audit_id);
`;

db.exec(SCHEMA);
console.log('✅ Migration complete — database ready at', DB_PATH);
db.close();

export default db;
