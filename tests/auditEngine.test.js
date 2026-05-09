// tests/auditEngine.test.js
// Covers the audit engine — the core logic reviewers will run.
// Run: npm test
//
// Tests verify:
//   1. Correct savings calculations for each tool
//   2. Edge cases (zero spend, 1 seat, max savings)
//   3. Total spend / saving aggregation
//   4. isHighSaving / isOptimal flags
//   5. Credex credit opportunity detection

import { runAudit, PRICING } from '../src/services/auditEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAudit(tools, { teamSize = 5, devCount = 3, useCase = 'coding' } = {}) {
  return runAudit({ teamSize, devCount, useCase, tools });
}

// ─── 1. Cursor ────────────────────────────────────────────────────────────────

describe('Cursor audit', () => {
  test('Business plan with 2 seats → recommends downgrade to Pro', () => {
    const result = makeAudit({
      cursor: { plan: 2, seats: 2, monthly: 80 }, // Business $40 x 2
    });
    const r = result.results.cursor;
    expect(r.badge).toBe('warn');
    expect(r.saving).toBe(40); // 2 seats × ($40 - $20)
    expect(r.action).toMatch(/Downgrade/i);
  });

  test('Pro plan with 1 coding user → ok or info (no saving)', () => {
    const result = makeAudit({
      cursor: { plan: 1, seats: 1, monthly: 20 },
    });
    const r = result.results.cursor;
    expect(r.saving).toBe(0);
    // badge is either 'ok' or 'info' — not 'warn'
    expect(r.badge).not.toBe('warn');
  });
});

// ─── 2. GitHub Copilot ────────────────────────────────────────────────────────

describe('Copilot audit', () => {
  test('Business plan with 3 seats → recommends downgrade to Individual', () => {
    const result = makeAudit({
      copilot: { plan: 1, seats: 3, monthly: 57 },
    });
    const r = result.results.copilot;
    expect(r.badge).toBe('warn');
    expect(r.saving).toBe(27); // 3 × ($19 - $10)
  });

  test('Enterprise plan with 5 seats → recommends Business', () => {
    const result = makeAudit({
      copilot: { plan: 2, seats: 5, monthly: 195 },
    });
    const r = result.results.copilot;
    expect(r.saving).toBe(100); // 5 × ($39 - $19)
    expect(r.badge).toBe('warn');
  });

  test('Individual plan with 10 seats → ok', () => {
    const result = makeAudit({
      copilot: { plan: 0, seats: 10, monthly: 100 },
    });
    // plan 0 = Individual, >5 seats → no saving
    expect(result.results.copilot.saving).toBe(0);
  });
});

// ─── 3. Claude ────────────────────────────────────────────────────────────────

describe('Claude audit', () => {
  test('Max plan with 1 seat → recommends downgrade to Pro', () => {
    const result = makeAudit({
      claude: { plan: 2, seats: 1, monthly: 100 },
    });
    const r = result.results.claude;
    expect(r.saving).toBe(80); // 1 × ($100 - $20)
    expect(r.badge).toBe('warn');
  });

  test('Team plan with 3 users → cheaper on Pro (min seat trap)', () => {
    const result = makeAudit({
      claude: { plan: 3, seats: 3, monthly: 125 }, // billed for min 5 seats
    });
    const r = result.results.claude;
    // 5 × $25 = $125 billed, but 3 × $20 = $60 on Pro → saving = $65
    expect(r.saving).toBeGreaterThan(0);
    expect(r.badge).toBe('warn');
  });

  test('API Direct spend $500/mo → Credex credit opportunity', () => {
    const result = makeAudit({
      claude: { plan: 5, seats: 1, monthly: 500 },
    });
    const r = result.results.claude;
    expect(r.badge).toBe('info');
    expect(r.saving).toBe(100); // 20% of $500
  });
});

// ─── 4. ChatGPT ───────────────────────────────────────────────────────────────

describe('ChatGPT audit', () => {
  test('Team plan with 1 seat → recommends downgrade to Plus', () => {
    const result = makeAudit({
      chatgpt: { plan: 2, seats: 1, monthly: 30 },
    });
    const r = result.results.chatgpt;
    expect(r.saving).toBeGreaterThan(0);
    expect(r.badge).toBe('warn');
  });

  test('API spend $300/mo → Credex saving', () => {
    const result = makeAudit({
      chatgpt: { plan: 4, seats: 1, monthly: 300 },
    });
    const r = result.results.chatgpt;
    expect(r.saving).toBe(60); // 20% of $300
    expect(r.badge).toBe('info');
  });
});

// ─── 5. Windsurf ─────────────────────────────────────────────────────────────

describe('Windsurf audit', () => {
  test('Team plan with 2 seats → downgrade to Pro', () => {
    const result = makeAudit({
      windsurf: { plan: 2, seats: 2, monthly: 70 },
    });
    const r = result.results.windsurf;
    expect(r.saving).toBe(40); // 2 × ($35 - $15)
    expect(r.badge).toBe('warn');
  });
});

// ─── 6. OpenAI API direct ────────────────────────────────────────────────────

describe('OpenAI API audit', () => {
  test('$500/mo → Credex saving of ~$100 (20%)', () => {
    const result = makeAudit({
      openai_api: { plan: 0, seats: 1, monthly: 500 },
    });
    const r = result.results.openai_api;
    expect(r.saving).toBe(100);
    expect(r.badge).toBe('info');
  });

  test('$100/mo → watch and wait, no saving', () => {
    const result = makeAudit({
      openai_api: { plan: 0, seats: 1, monthly: 100 },
    });
    expect(result.results.openai_api.saving).toBe(0);
    expect(result.results.openai_api.badge).toBe('ok');
  });
});

// ─── 7. Aggregation ──────────────────────────────────────────────────────────

describe('Audit aggregation', () => {
  test('Total saving is sum of all tool savings', () => {
    const result = makeAudit({
      cursor: { plan: 2, seats: 2, monthly: 80 },   // saving: 40
      copilot: { plan: 1, seats: 3, monthly: 57 },  // saving: 27
    });
    expect(result.totalSaving).toBe(67);
    expect(result.annualSaving).toBe(67 * 12);
  });

  test('isHighSaving is true when totalSaving >= 500', () => {
    const result = makeAudit({
      openai_api: { plan: 0, seats: 1, monthly: 3000 }, // saving: 600
    });
    expect(result.isHighSaving).toBe(true);
  });

  test('isOptimal is true when totalSaving < 100', () => {
    const result = makeAudit({
      cursor: { plan: 1, seats: 1, monthly: 20 },
    });
    expect(result.isOptimal).toBe(true);
  });

  test('wasteRate is 0 when totalSpend is 0', () => {
    const result = makeAudit({
      claude: { plan: 0, seats: 1, monthly: 0 }, // Free plan
    });
    expect(result.wasteRate).toBe(0);
  });
});

// ─── 8. PRICING export ────────────────────────────────────────────────────────

describe('PRICING data', () => {
  test('All tools have at least one plan', () => {
    for (const [tool, data] of Object.entries(PRICING)) {
      expect(data.plans.length).toBeGreaterThan(0);
      expect(data.prices.length).toBe(data.plans.length);
    }
  });
});
