# SpendScout — AI Spend Audit Tool

> Find out if your team is overpaying for AI tools. Get a free audit in 60 seconds.

**Built by Credex** | [spendscout.credex.rocks](https://spendscout.credex.rocks)

---

## What It Does

SpendScout analyzes your team's AI tool subscriptions (Cursor, GitHub Copilot, Claude, ChatGPT, Gemini, Windsurf, OpenAI API, Anthropic API) and identifies:

- Over-provisioned plans (e.g. paying for Business when Pro suffices)
- Cross-vendor redundancy (e.g. running Cursor + Copilot simultaneously)
- API credit savings via Credex credit bundles (15–30% on OpenAI/Anthropic API spend)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20+, Express 4 |
| Database | SQLite (better-sqlite3) |
| AI Summary | Anthropic Claude API |
| Validation | Zod |
| Email | Nodemailer (Resend) |
| Rate Limiting | express-rate-limit |
| Frontend | Vanilla HTML/CSS/JS (single file) |

---

## Quick Start

### Prerequisites
- Node.js >= 20
- An Anthropic API key

### Installation

```bash
git clone https://github.com/your-username/spendscout-backend.git
cd spendscout-backend
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3001
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
DATABASE_PATH=./data/spendscout.db
FRONTEND_URL=http://localhost:3000
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=audit@spendscout.credex.rocks
EMAIL_FROM_NAME=SpendScout by Credex
```

### Run

```bash
npm run dev      # Development (auto-restart)
npm start        # Production
```

Server starts at `http://localhost:3001`

### Verify

```bash
curl http://localhost:3001/health
# {"status":"ok","version":"1.0.0","timestamp":"..."}
```

---

## API Endpoints

### POST /api/audits
Run an AI spend audit.

**Request:**
```json
{
  "teamSize": 10,
  "devCount": 5,
  "useCase": "coding",
  "tools": {
    "cursor": { "plan": 1, "seats": 5, "monthly": 200 },
    "chatgpt": { "plan": 2, "seats": 5, "monthly": 150 }
  }
}
```

**Response:**
```json
{
  "auditId": "h8Z8f-x4",
  "shareToken": "GOlhOIO4mVin",
  "shareUrl": "http://localhost:3000/audit/GOlhOIO4mVin",
  "audit": {
    "totalSpend": 350,
    "totalSaving": 50,
    "annualSaving": 600,
    "wasteRate": 14,
    "results": { "...": "..." },
    "summary": "AI-generated paragraph..."
  }
}
```

### POST /api/leads
Capture email after audit.

```json
{
  "auditId": "h8Z8f-x4",
  "email": "founder@startup.com",
  "companyName": "Acme Inc",
  "role": "CTO",
  "teamSizeRange": "6-20"
}
```

### GET /api/audits/:id
Retrieve a saved audit by ID.

### GET /api/share/:token
Public audit view (PII stripped).

### GET /health
Health check.

---

## Running Tests

```bash
npm test
```

---

## Project Structure

```
spendscout-backend/
├── src/
│   ├── index.js              # Express server entry point
│   ├── routes/
│   │   ├── audits.js         # Audit CRUD endpoints
│   │   └── leads.js          # Lead capture endpoint
│   ├── services/
│   │   ├── auditEngine.js    # Deterministic audit logic
│   │   ├── aiSummary.js      # Claude API integration
│   │   └── emailService.js   # Confirmation emails
│   ├── middleware/
│   │   └── rateLimiter.js    # express-rate-limit config
│   ├── db/
│   │   ├── index.js          # DB singleton
│   │   └── migrate.js        # Schema migrations
│   └── utils/
│       └── validation.js     # Zod schemas
├── tests/
│   ├── api.test.js           # Integration tests
│   └── auditEngine.test.js   # Unit tests
├── ai_spend_audit_tool.html  # Frontend (single file)
├── .env.example
└── package.json
```

---

## License

MIT
