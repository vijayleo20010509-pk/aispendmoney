// src/services/auditEngine.js
//
// The audit engine evaluates each tool independently against:
//   1. Plan right-sizing (is the user on the wrong tier?)
//   2. Intra-vendor downgrades (cheaper plan from same vendor)
//   3. Cross-vendor alternatives (when capability gap is small)
//   4. Credit arbitrage via Credex (API spend > $200/mo)
//
// PRICING DATA — all numbers verified against official pricing pages.
// See PRICING_DATA.md for source URLs and verification dates.
//
// Design decision: audit logic is intentionally hard-coded rules, NOT LLM.
// A finance person should read this and agree with every number.

// ─── Official plan pricing (per seat / per month) ────────────────────────────

export const PRICING = {
  cursor: {
    plans: ['Hobby', 'Pro', 'Business', 'Enterprise'],
    prices: [0, 20, 40, null], // null = quote-based
    // Source: https://cursor.sh/pricing
  },
  copilot: {
    plans: ['Individual', 'Business', 'Enterprise'],
    prices: [10, 19, 39],
    // Source: https://github.com/features/copilot#pricing
  },
  claude: {
    plans: ['Free', 'Pro', 'Max', 'Team', 'Enterprise', 'API Direct'],
    prices: [0, 20, 100, 25, null, null],
    // Source: https://www.anthropic.com/pricing
    // Team min seats: 5; Enterprise = custom
  },
  chatgpt: {
    plans: ['Free', 'Plus', 'Team', 'Enterprise', 'API Direct'],
    prices: [0, 20, 30, null, null],
    // Source: https://openai.com/chatgpt/pricing
    // Team min seats: 2
  },
  gemini: {
    plans: ['Free', 'Advanced (Google One AI)', 'Business (Workspace)', 'API Direct'],
    prices: [0, 20, 30, null],
    // Source: https://one.google.com/about/plans, https://ai.google.dev/pricing
  },
  windsurf: {
    plans: ['Free', 'Pro', 'Team', 'Enterprise'],
    prices: [0, 15, 35, null],
    // Source: https://codeium.com/pricing
  },
  openai_api: {
    plans: ['Pay-as-you-go'],
    prices: [null], // usage-based — user enters monthly spend
    // Source: https://openai.com/api/pricing
  },
  anthropic_api: {
    plans: ['Pay-as-you-go'],
    prices: [null],
    // Source: https://www.anthropic.com/api
  },
};

// ─── Credex credit savings rate (conservative estimate) ─────────────────────
const CREDEX_SAVINGS_RATE = 0.20; // 20% — real range is 15–30%
const CREDEX_MIN_MONTHLY = 200;   // below this, overhead isn't worth it

// ─── Per-tool audit functions ────────────────────────────────────────────────
// Each returns: { action, reason, saving, badge, recommendation }
// badge: 'warn' | 'ok' | 'info'

function auditCursor(input, seats, useCase) {
  const { plan = 0, monthly = 0 } = input;

  // Pro plan with single user — double-check they need Pro
  if (plan === 1 && seats === 1 && monthly > 20) {
    return {
      action: 'Verify you need Cursor Pro',
      reason: 'Cursor Hobby is free for personal use. Pro ($20/seat) adds higher rate limits and longer context. If you\'re solo and hitting limits, Pro is correct — but verify.',
      saving: 0,
      badge: 'info',
      recommendation: null,
    };
  }

  // Business plan for ≤3 seats: no admin tooling needed
  if (plan === 2 && seats <= 3) {
    const saving = seats * (40 - 20); // Business ($40) → Pro ($20)
    return {
      action: 'Downgrade to Cursor Pro',
      reason: `Cursor Business ($40/seat) adds SSO, audit logs, and policy controls — features that matter at 10+ seats, not ${seats}. Pro ($20/seat) has the same AI capabilities. Saves $${saving}/mo.`,
      saving,
      badge: 'warn',
      recommendation: 'Cursor Pro',
    };
  }

  // Coding-focused team: validate plan choice
  if (plan === 1 && seats >= 1 && useCase === 'coding') {
    return {
      action: 'Plan looks right-sized',
      reason: `Cursor Pro at $20/seat is the right tier for a ${seats}-person coding team. Competitive with GitHub Copilot Individual at $10/seat but Cursor includes stronger codebase indexing and multi-model support.`,
      saving: 0,
      badge: 'ok',
      recommendation: null,
    };
  }

  return {
    action: 'Plan looks right-sized',
    reason: 'Your Cursor plan matches your team size and use case.',
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

function auditCopilot(input, seats, useCase) {
  const { plan = 0, monthly = 0 } = input;

  // Business plan with ≤5 seats and no enterprise needs
  if (plan === 1 && seats <= 5) {
    const saving = seats * (19 - 10); // Business → Individual
    return {
      action: 'Downgrade to GitHub Copilot Individual',
      reason: `Copilot Business ($19/seat) adds org-wide policy management, IP indemnity, and audit logs. For ≤5-person teams without compliance requirements, Individual ($10/seat) delivers the same code completions. Saves $${saving}/mo.`,
      saving,
      badge: 'warn',
      recommendation: 'GitHub Copilot Individual',
    };
  }

  // Enterprise plan for sub-50 seat teams
  if (plan === 2 && seats < 50) {
    const saving = seats * (39 - 19); // Enterprise → Business
    return {
      action: 'Downgrade to Copilot Business',
      reason: `Copilot Enterprise ($39/seat) adds Copilot in GitHub.com, knowledge bases, and doc search — value that scales with very large teams. Under 50 seats, Business ($19/seat) covers everything most teams actually use. Saves $${saving}/mo.`,
      saving,
      badge: 'warn',
      recommendation: 'GitHub Copilot Business',
    };
  }

  // Copilot Individual on a coding team: note Cursor alternative
  if (plan === 0 && seats >= 1 && useCase === 'coding') {
    return {
      action: 'Consider Cursor Pro for more capability',
      reason: 'Copilot Individual ($10/seat) covers basic completions. Cursor Pro ($20/seat) adds full codebase RAG, multi-model chat, and Composer — significant productivity gains for coding-focused teams at $10 more per seat.',
      saving: 0,
      badge: 'info',
      recommendation: 'Cursor Pro',
    };
  }

  return {
    action: 'Competitive pricing',
    reason: 'Copilot at your plan tier is well-priced. No immediate optimisation.',
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

function auditClaude(input, seats, useCase) {
  const { plan = 0, monthly = 0 } = input;

  // Max plan for ≤2 seats — likely overkill
  if (plan === 2 && seats <= 2) {
    const saving = seats * (100 - 20); // Max → Pro
    return {
      action: 'Downgrade to Claude Pro',
      reason: `Claude Max ($100/seat) is designed for very heavy daily usage — 5× more usage than Pro. For ≤2 seats, Pro ($20/seat) is almost always sufficient. If you're regularly hitting Pro limits, keep Max for those seats only. Potential savings: $${saving}/mo.`,
      saving,
      badge: 'warn',
      recommendation: 'Claude Pro',
    };
  }

  // Team plan for < 5 users (minimum seat rule makes it expensive)
  if (plan === 3 && seats < 5) {
    const saving = seats * (25 - 20); // Team → Pro (Team has min 5 seat billing)
    return {
      action: 'Switch to Claude Pro (individual)',
      reason: `Claude Team ($25/seat, billed for min 5 seats) actually costs $125/mo for your ${seats}-person group vs Pro ($20/seat × ${seats} = $${seats * 20}/mo). Pro has no seat minimum. Saves $${125 - seats * 20}/mo.`,
      saving: Math.max(0, 125 - seats * 20),
      badge: 'warn',
      recommendation: 'Claude Pro',
    };
  }

  // API direct spend — Credex credit opportunity
  if (plan === 5 && monthly >= CREDEX_MIN_MONTHLY) {
    const saving = Math.round(monthly * CREDEX_SAVINGS_RATE);
    return {
      action: 'Source API credits through Credex',
      reason: `At $${monthly}/mo retail Anthropic API spend, Credex credit bundles typically save 15–30%. Conservative estimate: $${saving}/mo (${Math.round(CREDEX_SAVINGS_RATE * 100)}% reduction). No capability change — same API, lower cost.`,
      saving,
      badge: 'info',
      recommendation: 'Credex credit bundle',
    };
  }

  return {
    action: 'Good plan fit',
    reason: 'Your Claude plan looks right for your team size and use case.',
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

function auditChatGPT(input, seats, useCase) {
  const { plan = 0, monthly = 0 } = input;

  // Plus for 3+ person team — should upgrade to Team
  if (plan === 1 && seats >= 3) {
    return {
      action: 'Upgrade to ChatGPT Team',
      reason: `ChatGPT Team ($30/seat) vs Plus ($20/seat): Team adds no data-training opt-out, higher GPT-4o limits, shared workspace, and custom GPTs for your org. For a ${seats}-person team, the compliance and productivity benefits outweigh $10/seat premium.`,
      saving: 0, // negative saving — recommending upgrade for value
      badge: 'info',
      recommendation: 'ChatGPT Team',
    };
  }

  // Team plan for ≤1 user
  if (plan === 2 && seats <= 1) {
    const saving = 30 - 20;
    return {
      action: 'Downgrade to ChatGPT Plus',
      reason: 'ChatGPT Team has a 2-seat minimum ($60/mo). A single user on Plus ($20/mo) saves $40/mo with identical personal capabilities.',
      saving,
      badge: 'warn',
      recommendation: 'ChatGPT Plus',
    };
  }

  // API direct — Credex
  if (plan === 4 && monthly >= CREDEX_MIN_MONTHLY) {
    const saving = Math.round(monthly * CREDEX_SAVINGS_RATE);
    return {
      action: 'Source credits through Credex',
      reason: `$${monthly}/mo OpenAI API spend qualifies for Credex credit bundles (15–25% savings). Estimated: $${saving}/mo reduction on the same API budget.`,
      saving,
      badge: 'info',
      recommendation: 'Credex credit bundle',
    };
  }

  return {
    action: 'On track',
    reason: 'Your ChatGPT plan fits your usage profile.',
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

function auditGemini(input, seats, useCase) {
  const { plan = 0, monthly = 0 } = input;

  // Advanced (Google One AI) on a coding team: Claude/Cursor better fit
  if (plan === 1 && useCase === 'coding') {
    return {
      action: 'Consider Claude Pro for coding tasks',
      reason: `Gemini Advanced ($20/seat) is Google One AI bundled. For coding-specific workflows, Claude 3.5 Sonnet consistently outperforms on code generation and debugging (SWE-bench Verified: Claude 49% vs Gemini ~30%). Same price, meaningfully better coding output.`,
      saving: 0,
      badge: 'info',
      recommendation: 'Claude Pro',
    };
  }

  // API spend — note Credex
  if (plan === 3 && monthly >= CREDEX_MIN_MONTHLY) {
    const saving = Math.round(monthly * CREDEX_SAVINGS_RATE);
    return {
      action: 'Review Gemini API credit options',
      reason: `$${monthly}/mo Google AI API spend — check Google's committed use discounts first. Credex may have Gemini credit bundles depending on current inventory.`,
      saving,
      badge: 'info',
      recommendation: null,
    };
  }

  return {
    action: 'Reasonable choice',
    reason: 'Gemini pricing is competitive for your use case. No immediate action needed.',
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

function auditWindsurf(input, seats, useCase) {
  const { plan = 0, monthly = 0 } = input;

  // Team plan for ≤3 seats
  if (plan === 2 && seats <= 3) {
    const saving = seats * (35 - 15); // Team → Pro
    return {
      action: 'Downgrade to Windsurf Pro',
      reason: `Windsurf Team ($35/seat) adds centralised billing and org management — worth it at 10+ engineers, not for ${seats}. Pro ($15/seat) has the same AI capabilities. Saves $${saving}/mo.`,
      saving,
      badge: 'warn',
      recommendation: 'Windsurf Pro',
    };
  }

  // Pro on a coding team: compare with Cursor
  if (plan === 1 && seats >= 2 && useCase === 'coding') {
    return {
      action: 'Compare with Cursor Pro',
      reason: `Windsurf Pro ($15/seat) vs Cursor Pro ($20/seat): Windsurf is cheaper but Cursor has stronger codebase indexing. Worth a 1-week trial to compare productivity — especially if you use large monorepos.`,
      saving: 0,
      badge: 'info',
      recommendation: null,
    };
  }

  return {
    action: 'Good value',
    reason: 'Windsurf is priced competitively for your team.',
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

function auditOpenAIApi(input) {
  const { monthly = 0 } = input;

  if (monthly >= CREDEX_MIN_MONTHLY) {
    const saving = Math.round(monthly * CREDEX_SAVINGS_RATE);
    return {
      action: 'Source credits through Credex',
      reason: `At $${monthly}/mo retail OpenAI API spend, Credex credit bundles save 15–25% on average (sourced from companies that over-provisioned). Conservative estimate: $${saving}/mo with zero capability change.`,
      saving,
      badge: 'info',
      recommendation: 'Credex credit bundle',
    };
  }
  if (monthly > 0) {
    return {
      action: 'Low spend — watch & wait',
      reason: `$${monthly}/mo is below the threshold where credit management adds more value than overhead. Revisit when your API spend crosses $200/mo.`,
      saving: 0,
      badge: 'ok',
      recommendation: null,
    };
  }
  return {
    action: 'Enter your monthly API spend',
    reason: 'Add your monthly OpenAI API cost to get a personalised recommendation.',
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

function auditAnthropicApi(input) {
  const { monthly = 0 } = input;

  if (monthly >= CREDEX_MIN_MONTHLY) {
    const saving = Math.round(monthly * CREDEX_SAVINGS_RATE);
    return {
      action: 'Source credits through Credex',
      reason: `At $${monthly}/mo Anthropic API spend, Credex credits typically save 15–30%. Conservative estimate: $${saving}/mo. This is Credex's strongest category — Anthropic credit inventory is available.`,
      saving,
      badge: 'info',
      recommendation: 'Credex credit bundle',
    };
  }
  return {
    action: 'Low spend — watch & wait',
    reason: `$${monthly}/mo is below the credit bundle break-even point. Return when you're spending $200+/mo.`,
    saving: 0,
    badge: 'ok',
    recommendation: null,
  };
}

// ─── Tool dispatch map ────────────────────────────────────────────────────────

const AUDIT_FNS = {
  cursor: (input, seats, uc) => auditCursor(input, seats, uc),
  copilot: (input, seats, uc) => auditCopilot(input, seats, uc),
  claude: (input, seats, uc) => auditClaude(input, seats, uc),
  chatgpt: (input, seats, uc) => auditChatGPT(input, seats, uc),
  gemini: (input, seats, uc) => auditGemini(input, seats, uc),
  windsurf: (input, seats, uc) => auditWindsurf(input, seats, uc),
  openai_api: (input) => auditOpenAIApi(input),
  anthropic_api: (input) => auditAnthropicApi(input),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * runAudit({ teamSize, devCount, useCase, tools })
 *
 * tools: Record<ToolKey, { plan: number, seats: number, monthly: number }>
 *
 * Returns:
 *   { totalSpend, totalSaving, annualSaving, wasteRate, results, isHighSaving, isOptimal }
 */
export function runAudit({ teamSize, devCount, useCase, tools }) {
  let totalSpend = 0;
  let totalSaving = 0;
  const results = {};

  for (const [toolKey, input] of Object.entries(tools)) {
    const fn = AUDIT_FNS[toolKey];
    if (!fn) continue;

    const seats = input.seats || 1;
    const monthly = typeof input.monthly === 'number' ? input.monthly : 0;
    totalSpend += monthly;

    const audit = fn(input, seats, useCase);
    totalSaving += audit.saving || 0;

    results[toolKey] = {
      currentSpend: monthly,
      seats,
      plan: input.plan ?? 0,
      ...audit,
    };
  }

  const annualSaving = totalSaving * 12;
  const wasteRate = totalSpend > 0 ? Math.round((totalSaving / totalSpend) * 100) : 0;
  const isHighSaving = totalSaving >= 500;
  const isOptimal = totalSaving < 100;

  return {
    totalSpend,
    totalSaving,
    annualSaving,
    wasteRate,
    results,
    isHighSaving,
    isOptimal,
    teamSize,
    devCount,
    useCase,
  };
}


