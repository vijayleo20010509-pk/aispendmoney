# ARCHITECTURE.md — SpendScout System Design

## Overview

SpendScout is a two-layer system:
1. A **deterministic audit engine** (hard-coded pricing rules, no LLM)
2. An **AI summary layer** (Claude API, with fallback)

This separation is intentional: financial recommendations must be auditable and reproducible. The LLM only writes the human-readable paragraph — it never decides what to recommend.

---

## System Diagram

```
Browser (ai_spend_audit_tool.html)
         │
         │ POST /api/audits
         ▼
   Express Server (index.js)
         │
         ├── Rate Limiter (middleware/rateLimiter.js)
         │
         ├── Zod Validation (utils/validation.js)
         │
         ├── Audit Engine (services/auditEngine.js)
         │     └── Per-tool rules (deterministic)
         │
         ├── AI Summary (services/aiSummary.js)
         │     └── Claude API → fallback template
         │
         ├── SQLite DB (db/)
         │     ├── audits table
         │     ├── leads table
         │     └── rate_limit_log table
         │
         └── Response → Browser
```

---

## Key Design Decisions

### 1. Audit Engine is Deterministic (Not LLM)
All savings calculations use hard-coded pricing rules from official vendor pages. A finance person should be able to read `auditEngine.js` and verify every number without running the code.

**Why not LLM for recommendations?**
- LLMs hallucinate pricing data
- Recommendations must be reproducible (same input = same output)
- Easier to test and audit

### 2. Single-File Frontend
`ai_spend_audit_tool.html` is a standalone file with no build step, no bundler, no npm. This was a deliberate choice for:
- Zero deployment friction
- Easy sharing (just open the file)
- No frontend framework dependencies

### 3. SQLite for Database
SQLite was chosen over Postgres for:
- Zero infrastructure setup
- Single file = easy backup
- Sufficient for early-stage traffic
- Can swap to Postgres via `DATABASE_PATH` env var later

### 4. AI Summary with Fallback
Claude API is called for the human-readable summary paragraph. If the API fails (timeout, rate limit, outage), a deterministic fallback template is used. The user never sees an error.

### 5. Lead Capture Separated from Audit
`audits` and `leads` are separate tables. Audit data is stored immediately on submission. Email is only captured after the user sees value. This:
- Reduces friction (no email wall before results)
- Separates PII from audit data
- Allows public sharing of audits without exposing email

---

## Data Flow

### Audit Submission
```
1. User submits form
2. Zod validates input shape and types
3. auditEngine.runAudit() calculates savings per tool
4. generateSummary() calls Claude API (or fallback)
5. Result inserted into audits table
6. Response returned with auditId + shareToken
```

### Lead Capture
```
1. User sees results, enters email
2. Honeypot field checked (bot protection)
3. Duplicate check (same email + same audit = skip)
4. Lead inserted into leads table
5. Audit updated with lead_id FK
6. Confirmation email sent (non-blocking)
7. If saving >= $500: internal Credex alert sent
```

---

## Database Schema

```sql
-- audits: one row per audit run
CREATE TABLE audits (
  id            TEXT PRIMARY KEY,       -- nanoid
  created_at    TEXT,
  updated_at    TEXT,
  team_size     INTEGER,
  dev_count     INTEGER,
  use_case      TEXT,
  tools_input   TEXT,                   -- JSON
  total_spend   REAL,
  total_saving  REAL,
  results_json  TEXT,                   -- JSON
  ai_summary    TEXT,
  share_token   TEXT UNIQUE,
  is_public     INTEGER DEFAULT 0,
  lead_id       TEXT REFERENCES leads(id)
);

-- leads: one row per email capture
CREATE TABLE leads (
  id                   TEXT PRIMARY KEY,
  created_at           TEXT,
  email                TEXT,
  company_name         TEXT,
  role                 TEXT,
  team_size_range      TEXT,
  audit_id             TEXT REFERENCES audits(id),
  total_saving         REAL,
  is_high_value        INTEGER DEFAULT 0,  -- saving >= $500
  confirmation_sent_at TEXT,
  credex_notified_at   TEXT
);
```

---

## Rate Limiting

| Endpoint | Limit |
|---|---|
| Global | 100 req / 15 min |
| POST /api/audits | 10 req / 15 min |
| POST /api/leads | 5 req / 15 min |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| PORT | No | Default 3001 |
| NODE_ENV | No | development / production |
| ANTHROPIC_API_KEY | Yes | For AI summaries |
| DATABASE_PATH | No | Default ./data/spendscout.db |
| FRONTEND_URL | No | For share URLs |
| RESEND_API_KEY | No | For confirmation emails |
| EMAIL_FROM | No | Sender address |

---

## Scaling Path

Current: SQLite + single Node process
Next: Postgres + connection pool (swap `better-sqlite3` for `pg`)
Later: Queue AI summary generation (Bull/BullMQ) for high traffic
