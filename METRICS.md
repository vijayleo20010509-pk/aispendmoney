# METRICS.md — SpendScout Key Metrics & Tracking

## North Star Metric

**High-Value Leads Generated per Week**
(Audits where identified saving >= $500/month AND email captured)

This metric connects the free tool directly to Credex revenue potential.

---

## Primary Metrics

### Acquisition
| Metric | Target (Month 1) | How Tracked |
|---|---|---|
| Audits run | 500 | `SELECT COUNT(*) FROM audits` |
| Unique visitors | 2,000 | Analytics (Plausible/GA) |
| Audit start rate | 25% | Frontend events |

### Activation
| Metric | Target | How Tracked |
|---|---|---|
| Audit completion rate | >80% | Audits with results / audits started |
| Email capture rate | >30% | `SELECT COUNT(*) FROM leads` / audits |
| High-value lead rate | >10% | `SELECT COUNT(*) FROM leads WHERE is_high_value = 1` |

### Revenue (Credex)
| Metric | Target | How Tracked |
|---|---|---|
| Sales conversations | 20/month | CRM |
| Credit bundle conversions | 5/month | CRM |
| Revenue per conversion | $80/month | CRM |
| Total MRR from SpendScout leads | $400 | CRM |

---

## Secondary Metrics

### Product Quality
| Metric | Target | How Tracked |
|---|---|---|
| Average savings identified | >$200/audit | `SELECT AVG(total_saving) FROM audits` |
| % audits with savings found | >40% | `SELECT COUNT(*) FROM audits WHERE total_saving > 0` |
| AI summary success rate | >95% | `summarySource = 'claude'` vs `'fallback'` |
| API error rate | <2% | Server error logs |

### Sharing & Virality
| Metric | Target | How Tracked |
|---|---|---|
| Share link copy rate | >20% | Frontend click event |
| Share link visits | >100/month | GET /api/share/:token logs |
| Viral coefficient | >0.3 | New audits from share links / total audits |

---

## Database Queries for Tracking

### Daily dashboard

```sql
-- Total audits today
SELECT COUNT(*) FROM audits
WHERE created_at >= date('now');

-- Total leads today
SELECT COUNT(*) FROM leads
WHERE created_at >= date('now');

-- High-value leads today
SELECT COUNT(*) FROM leads
WHERE created_at >= date('now')
AND is_high_value = 1;

-- Average savings this week
SELECT AVG(total_saving) FROM audits
WHERE created_at >= date('now', '-7 days')
AND total_saving > 0;

-- Email capture rate (last 7 days)
SELECT
  COUNT(DISTINCT l.id) * 100.0 / COUNT(DISTINCT a.id) as capture_rate
FROM audits a
LEFT JOIN leads l ON l.audit_id = a.id
WHERE a.created_at >= date('now', '-7 days');
```

### Top savings opportunities identified

```sql
SELECT use_case, AVG(total_saving) as avg_saving, COUNT(*) as count
FROM audits
WHERE total_saving > 0
GROUP BY use_case
ORDER BY avg_saving DESC;
```

### Most common tools submitted

```sql
-- Requires JSON parsing — run in application layer
SELECT tools_input FROM audits ORDER BY created_at DESC LIMIT 100;
```

---

## Weekly Review Checklist

- [ ] Total audits run this week vs last week
- [ ] Email capture rate trending up or down?
- [ ] Any high-value leads not yet contacted by Credex team?
- [ ] AI summary fallback rate — is the Claude API healthy?
- [ ] Any rate limit hits that suggest abuse or bot traffic?
- [ ] Check confirmation_sent_at vs created_at gap (email delivery speed)

---

## Reporting Cadence

| Report | Frequency | Audience |
|---|---|---|
| Audit volume + leads | Daily | Credex team Slack |
| High-value lead alert | Real-time | Email to Credex sales |
| Weekly metrics summary | Weekly | Founders |
| Full analytics review | Monthly | Team |

---

## Instrumentation TODO

- [ ] Add Plausible Analytics to HTML frontend (privacy-friendly)
- [ ] Track funnel steps: tool_selected → audit_submitted → results_viewed → email_entered
- [ ] Log share link clicks in DB
- [ ] Add `referrer` field to audits table (track traffic source)
- [ ] Set up weekly automated email report from DB queries
