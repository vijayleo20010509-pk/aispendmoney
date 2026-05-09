# USER_INTERVIEWS.md — SpendScout User Research

## Research Goal

Validate that AI tool overspending is a real, felt pain point — and that a 60-second audit produces actionable enough output to drive email capture.

---

## Interview 1

**Profile:** CTO, 15-person SaaS startup, Series A
**AI tools in use:** Cursor (Business, 8 seats), ChatGPT Team (15 seats), GitHub Copilot (Individual, 3 seats)
**Monthly AI spend:** ~$900/month (estimate, untracked)

**Key quotes:**
- "I honestly don't know what we're spending. Finance asks me and I have to go check three dashboards."
- "We have Cursor and Copilot running simultaneously for some engineers. I keep meaning to consolidate."
- "If something could tell me 'you're wasting $X here' in under a minute, I'd use it."

**Findings:**
- Spend is tracked per-tool but never aggregated
- Overlapping tools exist due to organic adoption, not deliberate choice
- Decision to consolidate keeps getting deprioritized
- Would share audit results with co-founder

---

## Interview 2

**Profile:** Founder/Engineer, 4-person startup, pre-seed
**AI tools in use:** ChatGPT Plus (personal), Claude Pro (personal), Cursor Pro (1 seat)
**Monthly AI spend:** ~$60/month

**Key quotes:**
- "I pay for both ChatGPT and Claude. I use Claude more but keep paying for ChatGPT out of habit."
- "I didn't realize there was a Cursor Hobby tier. I just went straight to Pro."
- "I'm not spending enough to care about optimization honestly. But if I had a team of 10, I'd want this."

**Findings:**
- Below the threshold where optimization matters
- Validates that the target customer is team leads, not solo devs
- Confirmed Hobby tier awareness gap for Cursor

---

## Interview 3

**Profile:** VP Engineering, 60-person company, Series B
**AI tools in use:** GitHub Copilot Enterprise (40 seats), ChatGPT Team (60 seats), Anthropic API (~$1,200/month)
**Monthly AI spend:** ~$4,200/month

**Key quotes:**
- "We're on Copilot Enterprise. I'm not sure we use any of the enterprise features — we just got upsold."
- "Our Anthropic API bill surprised us last quarter. I didn't know there were ways to reduce it without changing usage."
- "I'd want to see benchmarks. Like, is $70/developer normal? I have no reference point."

**Findings:**
- Enterprise plans adopted via sales pressure, not need
- API spend opacity is a real pain point at scale
- Benchmark data ($/dev/month) is highly valued — validates including it in AI summary
- Credex credit bundle is genuinely new information — not aware this existed

---

## Interview 4

**Profile:** Engineering Manager, 25-person team within 200-person company
**AI tools in use:** Cursor Pro (12 seats), Claude Team (8 seats), ChatGPT Team (25 seats)
**Monthly AI spend:** ~$1,600/month (team budget)

**Key quotes:**
- "We added ChatGPT Team when the company standardized on it. But the engineering team mostly uses Cursor and Claude."
- "I'd love to show my manager we're being thoughtful about this spend. An audit report would actually be useful internally."
- "The share link is a good idea. I could send it to finance."

**Findings:**
- Internal reporting use case is strong — audit results shared upward
- Validates share URL feature as high-value
- Multi-tool redundancy is common in larger teams where tools are adopted at different levels (company-wide vs team-level)

---

## Synthesis

### Pain points confirmed
1. **Spend aggregation** — nobody knows their total number across tools
2. **Plan over-provisioning** — upsold to higher tiers, features unused
3. **Tool redundancy** — organic adoption creates overlap
4. **API spend opacity** — variable costs feel uncontrollable
5. **No benchmark** — no reference point for "is this normal?"

### Product decisions validated
- No login required to run audit ✅ (low friction essential)
- Benchmark in summary copy ✅ ($/dev/month comparison valued)
- Share URL ✅ (internal reporting use case confirmed)
- Credex credit mention only for high spend ✅ (feels like advice, not sales)

### Segments NOT to target (yet)
- Solo devs / pre-seed founders (spend too low to optimize)
- Enterprise (>500 employees) — procurement is centralized, not EM-driven
