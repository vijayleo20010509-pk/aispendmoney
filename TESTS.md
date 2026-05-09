# TESTS.md

## Running Tests

```bash
npm test
```

Requires Node 20+. Tests use Jest with ESM support. The test suite sets `DATABASE_PATH=./data/test.db` to avoid touching the dev database.

---

## Test Files

### `tests/auditEngine.test.js` — Audit Engine Unit Tests

| Test | What it covers |
|------|----------------|
| Cursor: Business plan 2 seats → downgrade | Saves $40/mo; badge=warn |
| Cursor: Pro plan 1 coding user → ok | No false savings; badge≠warn |
| Copilot: Business 3 seats → Individual | Saves $27/mo |
| Copilot: Enterprise 5 seats → Business | Saves $100/mo |
| Copilot: Individual 10 seats → ok | No spurious downgrade |
| Claude: Max 1 seat → Pro | Saves $80/mo |
| Claude: Team 3 users → Pro (min seat trap) | Correctly calculates $125 billed vs $60 on Pro |
| Claude: API $500/mo → Credex | Saves $100 at 20% |
| ChatGPT: Team 1 seat → Plus | Downgrade saving |
| ChatGPT: API $300/mo → Credex | Saves $60 |
| Windsurf: Team 2 seats → Pro | Saves $40/mo |
| OpenAI API: $500/mo → Credex | Saves $100 |
| OpenAI API: $100/mo → watch | No saving, badge=ok |
| Aggregation: total saving = sum of tools | $40 + $27 = $67 |
| Aggregation: isHighSaving ≥ $500 | Correct flag |
| Aggregation: isOptimal < $100 | Correct flag |
| Aggregation: wasteRate when spend=0 | Returns 0, no division error |
| PRICING: all tools have at least one plan | Data integrity check |

**Total: 18 audit engine tests**

---

### `tests/api.test.js` — REST API Integration Tests

| Test | What it covers |
|------|----------------|
| POST /api/audits valid → 201 | Returns auditId, shareToken, results |
| POST /api/audits empty tools → 400 | Validation rejects empty tools object |
| POST /api/audits invalid useCase → 400 | Enum validation |
| POST /api/audits negative monthly → 400 | Range validation |
| GET /api/audits/:id valid → 200 | Returns full audit |
| GET /api/audits/:id unknown → 404 | Not found |
| POST /api/leads valid → 201 | Creates lead, returns leadId |
| POST /api/leads duplicate email → 200 | Idempotent, duplicate=true |
| POST /api/leads honeypot set → 200 | Bot ignored, no lead created |
| POST /api/leads invalid email → 400 | Email validation |
| POST /api/leads fake auditId → 404 | Audit must exist |

**Total: 11 API integration tests**

---

**Grand total: 29 automated tests**

All tests must pass before merge (`npm test` must exit 0). The CI workflow in `.github/workflows/ci.yml` runs these on every push to `main`.
