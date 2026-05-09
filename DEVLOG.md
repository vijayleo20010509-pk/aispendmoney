# DEVLOG.md — SpendScout Development Log

## Day 1 — Project Setup & Core Engine

**Goal:** Get a working audit engine that produces correct savings calculations.

### What I built
- Express server scaffold with dotenv, cors, rate limiting
- Zod validation schemas for audit input
- `auditEngine.js` — per-tool audit functions for Cursor, Copilot, Claude, ChatGPT, Gemini, Windsurf, OpenAI API, Anthropic API
- SQLite schema with `audits` and `leads` tables
- Basic POST /api/audits endpoint

### Decisions made
- Chose SQLite over Postgres to eliminate infrastructure setup time
- Chose deterministic rules over LLM for audit logic — pricing must be auditable
- Used nanoid for IDs (shorter than UUID, URL-safe)

### Problems hit
- `better-sqlite3` requires native compilation — worked fine on Node 20
- Zod schema initially too strict on `plan` field (string vs number mismatch)

---

## Day 2 — AI Summary + Email

**Goal:** Add Claude API integration and email confirmation flow.

### What I built
- `aiSummary.js` — Claude API call with 90–110 word constraint
- Fallback template when API is unavailable
- `emailService.js` — Nodemailer + Resend for confirmation emails
- High-value lead alert (saving >= $500 triggers internal Credex notification)
- POST /api/leads endpoint with honeypot bot protection

### Decisions made
- AI summary is non-blocking — audit saves to DB before summary returns
- Fallback summary uses same data points as AI prompt — no degradation visible to user
- Confirmation email sent async (`.then()`) so it doesn't delay the API response

### Problems hit
- Claude API occasionally returns 529 (overloaded) — handled with try/catch fallback
- Email sending via Resend requires domain verification — used test mode during dev

---

## Day 3 — Frontend + Share Feature

**Goal:** Build the single-file frontend and public share URLs.

### What I built
- `ai_spend_audit_tool.html` — full multi-screen UI in one file
- GET /api/share/:token — public endpoint, strips PII
- Share URL generation with nanoid token
- Rate limit logging to DB

### Decisions made
- Single HTML file with no build step — fastest path to shareable demo
- Share endpoint strips email/company name — safe to embed in OG previews
- Public share defaults to `is_public = 0` — only set to 1 when user copies link

### Problems hit
- CORS blocking localhost during development — fixed with explicit origin whitelist
- Rate limiter `trust proxy` setting needed for Vercel/Render deployment

---

## Day 4 — Testing + Polish

**Goal:** Write tests, fix edge cases, prepare for submission.

### What I built
- `tests/auditEngine.test.js` — unit tests for every tool audit function
- `tests/api.test.js` — integration tests for all endpoints
- Edge cases: duplicate lead prevention, missing API key fallback, empty tools object

### Decisions made
- Jest with `--experimental-vm-modules` for ESM support
- Supertest for HTTP integration tests without starting a real server
- `--forceExit` flag to prevent Jest hanging on open DB connections

### Problems hit
- ESM + Jest requires specific config (`extensionsToTreatAsEsm`, `moduleNameMapper`)
- `better-sqlite3` in tests needs separate DB instance to avoid conflicts

---

## Known Issues / Future Work

- [ ] Frontend not yet connected to local backend (uses production URL)
- [ ] No authentication on GET /api/leads (admin endpoint)
- [ ] SQLite WAL mode enabled but not tested under concurrent load
- [ ] Email templates are plain text — HTML templates would improve deliverability
- [ ] No pagination on GET /api/leads (hardcoded LIMIT 100)
