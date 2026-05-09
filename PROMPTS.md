# PROMPTS.md

## Audit Summary Prompt

### Location
`src/services/aiSummary.js` → `generateSummary()`

### Full Prompt

```
You are a concise financial analyst writing a personalised audit summary for a startup founder.

Audit data:
- Team size: {teamSize} people, {devCount} developers
- Use case: {useCase}
- Total AI tool spend: ${totalSpend}/month
- Potential savings identified: ${totalSaving}/month ({wasteRate}% of spend)
- Annual savings: ${annualSaving}

Per-tool findings:
  - {tool}: ${currentSpend}/mo → save ${saving}/mo ({action})
  ...

Write a 90–110 word paragraph that:
1. Opens with their spend per developer and whether it's within typical benchmarks (SaaS startups: $30–80/dev/mo)
2. Names the 1–2 biggest savings opportunities specifically
3. Ends with a concrete next step
4. Tone: direct, data-driven, never condescending — like a CFO advisor, not a chatbot

Do not use bullet points. Plain prose only. Do not mention Credex unless savings >= $500/mo — in that case, one mention is appropriate as a solution.
```

### Why I wrote it this way

**Role framing**: "Financial analyst" anchors tone better than "helpful assistant". Early testing showed the assistant adding excessive hedging ("it's important to note that savings may vary...") when not given an expert persona.

**Explicit word count range (90–110)**: Without this, the model produced summaries from 60 to 200 words. The 100-word target matches the frontend card height.

**"Like a CFO advisor, not a chatbot"**: The most impactful single instruction. Without it, drafts included phrases like "Great news! You could save..." — completely wrong for a finance tool.

**Credex mention gate**: Only surfaced for savings ≥ $500/mo. We tested always mentioning Credex and it felt like an ad — users noticed. The gate keeps it feeling like a genuine recommendation.

**"Do not use bullet points"**: The results page already has a structured breakdown. The AI summary should read as a human paragraph, not a repeat of the table.

### What I tried that didn't work

1. **Asking for JSON output**: The model occasionally added ```json fences despite instructions. Switched to plain text with structured input data.

2. **One-shot examples**: Including an example summary caused the model to copy the example's phrasing too closely. Removed.

3. **Longer max_tokens (400)**: The model padded summaries with generic advice about "monitoring AI spend going forward." Capped at 200 tokens.

4. **Asking for 3 bullet points**: Looked great in isolation but duplicated the per-tool breakdown already on the page. Users ignored it.

### Fallback behaviour

If the Anthropic API returns a non-200 or throws (timeout, rate limit, network error), `generateSummary()` returns `{ summary: buildFallbackSummary(...), source: 'fallback' }`. The fallback is a deterministic template that covers all the same points — spend per dev, benchmark comparison, top savings, next step. The frontend shows no error to the user.
