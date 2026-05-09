# ECONOMICS.md — SpendScout Unit Economics

## Business Model

SpendScout is a **free lead generation tool** for Credex's core business: selling discounted AI API credits (Anthropic, OpenAI) to startups and scaleups.

The audit tool has no direct revenue. Revenue comes from credit bundle sales to leads identified as high-value (saving >= $500/month).

---

## Cost to Run SpendScout

### Infrastructure (per month)
| Item | Cost |
|---|---|
| Render.com (Node.js server) | $7/mo (Starter) |
| SQLite (file on disk) | $0 |
| Total infrastructure | **$7/mo** |

### Per-Audit Cost
| Item | Cost |
|---|---|
| Claude API (AI summary, ~300 tokens) | ~$0.003 per audit |
| Resend email (confirmation) | ~$0.001 per email |
| **Total per audit** | **~$0.004** |

At 500 audits/month: ~$2 in variable costs.

### Total Monthly Cost (500 audits)
```
Infrastructure:  $7.00
Variable costs:  $2.00
Total:           $9.00/month
```

---

## Revenue Model (Credex Credits)

### How credit bundles work
Credex sources unused/over-provisioned AI API credits from companies at a discount and resells them to startups at below-retail prices.

| Metric | Estimate |
|---|---|
| Average customer API spend | $800/mo |
| Credex discount vs retail | 20% |
| Customer saving | $160/mo |
| Credex margin | ~8–12% of face value |
| Revenue per customer/month | ~$64–96/mo |

### Conversion Assumptions (Month 1)
| Stage | Number | Rate |
|---|---|---|
| Audits run | 500 | — |
| Emails captured | 150 | 30% |
| High-value leads (>$500 saving) | 50 | 10% of audits |
| Sales conversations | 20 | 40% of HV leads |
| Conversions to credit bundle | 5 | 25% close rate |
| Monthly revenue | $400 | 5 × $80 avg |

### Break-even
Tool cost: $9/month. First credit bundle sale covers 22× the monthly tool cost.

---

## LTV Estimate

Credit bundle customers are sticky (switching costs are low but inertia is high):
- Average retention: 8 months
- Monthly revenue per customer: $80
- **LTV: ~$640 per converted lead**

---

## CAC

SpendScout is the primary acquisition channel. With $9/month tool cost and 5 conversions:
- **CAC: $1.80 per converted customer**
- **LTV:CAC ratio: 356:1**

This ratio is high because:
1. The tool cost is near-zero
2. Distribution is organic (share URLs, word of mouth)
3. The audit self-qualifies leads before any human time is spent

---

## Sensitivity Analysis

| Scenario | Audits | Conversions | Revenue | Tool Cost | Margin |
|---|---|---|---|---|---|
| Conservative | 200 | 2 | $160 | $9 | $151 |
| Base | 500 | 5 | $400 | $9 | $391 |
| Optimistic | 2,000 | 20 | $1,600 | $25* | $1,575 |

*Higher tier hosting at scale.

---

## Key Risks

1. **AI tool pricing changes frequently** — audit recommendations become stale. Mitigation: PRICING_DATA.md tracks verification dates; quarterly review process.

2. **Credit inventory availability** — Credex can only sell credits it has sourced. High conversion rates could outpace supply. Mitigation: pipeline sourcing in parallel with demand generation.

3. **Vendors crack down on credit resale** — some vendors restrict resale in ToS. Mitigation: Credex operates in a gray area that is common in SaaS credit markets; legal review required.
