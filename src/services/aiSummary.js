// src/services/aiSummary.js
// Generates a ~100-word personalised audit summary via Anthropic API.
// Falls back to a deterministic template if the API call fails.
// See PROMPTS.md for the full prompt rationale.

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * generateSummary(auditResult)
 * Returns { summary: string, source: 'ai' | 'fallback' }
 */
export async function generateSummary(auditResult) {
  const { totalSpend, totalSaving, annualSaving, wasteRate, teamSize, devCount, useCase, results, isHighSaving, isOptimal } = auditResult;

  // Build a concise tool list for the prompt
  const toolLines = Object.entries(results)
    .map(([key, r]) => {
      const action = r.saving > 0 ? `save $${r.saving}/mo (${r.action})` : r.action;
      return `  - ${key}: $${r.currentSpend}/mo → ${action}`;
    })
    .join('\n');

  const prompt = `You are a concise financial analyst writing a personalised audit summary for a startup founder.

Audit data:
- Team size: ${teamSize} people, ${devCount} developers
- Use case: ${useCase}
- Total AI tool spend: $${totalSpend}/month
- Potential savings identified: $${totalSaving}/month (${wasteRate}% of spend)
- Annual savings: $${annualSaving}

Per-tool findings:
${toolLines}

Write a 90–110 word paragraph that:
1. Opens with their spend per developer and whether it's within typical benchmarks (SaaS startups: $30–80/dev/mo)
2. Names the 1–2 biggest savings opportunities specifically
3. Ends with a concrete next step
4. Tone: direct, data-driven, never condescending — like a CFO advisor, not a chatbot

Do not use bullet points. Plain prose only. Do not mention Credex unless savings >= $500/mo — in that case, one mention is appropriate as a solution.`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return { summary: summary.trim(), source: 'ai' };
  } catch (err) {
    // Graceful degradation — never fail the audit because the summary failed
    console.warn('[aiSummary] Anthropic API call failed, using fallback:', err.message);
    return { summary: buildFallbackSummary(auditResult), source: 'fallback' };
  }
}

/**
 * Deterministic fallback summary — same structure as the AI version
 * but generated from templates. Always has something useful to say.
 */
function buildFallbackSummary({ totalSpend, totalSaving, annualSaving, teamSize, devCount, useCase, isHighSaving, isOptimal }) {
  const perDev = devCount > 0 ? Math.round(totalSpend / devCount) : totalSpend;
  const benchmark = perDev > 80 ? 'above' : perDev < 30 ? 'below' : 'within';
  const pct = totalSpend > 0 ? Math.round((totalSaving / totalSpend) * 100) : 0;

  if (isOptimal) {
    return `Your ${teamSize}-person team is spending $${totalSpend}/month across your AI stack — $${perDev}/developer, ${benchmark} typical benchmarks of $30–80/dev/mo for ${useCase}-focused teams. Your plan choices look well-optimised for your current usage. No immediate savings actions are required, though we'd recommend revisiting plan tiers every quarter as your team or usage scales.`;
  }

  const credexLine = isHighSaving
    ? ` For teams with your savings profile, Credex credit bundles are the highest-leverage next step — sourcing discounted AI credits from companies that over-provisioned.`
    : '';

  return `Your ${teamSize}-person team is spending $${totalSpend}/month on AI tools — $${perDev}/developer, ${benchmark} the typical $30–80/dev/mo range for ${useCase}-focused teams. Our audit found $${totalSaving}/month in potential savings (${pct}% of your current spend), primarily through plan right-sizing. Implementing these changes saves $${annualSaving}/year without reducing any capability.${credexLine} Start with the highest-savings recommendation in the breakdown below.`;
}
