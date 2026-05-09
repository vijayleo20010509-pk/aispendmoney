# REFLECTION.md — SpendScout Project Reflection

## What Went Well

### Deterministic audit engine
Separating the savings logic from the LLM was the right call. Every number in `auditEngine.js` traces to an official pricing page. This means:
- Recommendations are reproducible
- Easy to update when vendors change pricing
- Testable with simple unit tests

### Single-file frontend
No build step, no bundler, no framework. The HTML file opens directly in a browser and works. This eliminated an entire category of deployment problems.

### Fallback-first AI integration
Building the fallback summary template before connecting the Claude API meant the product worked end-to-end before the AI layer was wired up. When the API goes down, users see no degradation.

---

## What Was Harder Than Expected

### SQLite + ESM + Jest
The combination of ES modules, better-sqlite3 (native bindings), and Jest required specific configuration that took time to get right. The `--experimental-vm-modules` flag and `moduleNameMapper` in Jest config were non-obvious.

### Prompt engineering for the summary
Getting a 90–110 word paragraph that sounded like a CFO advisor and not a chatbot took more iteration than expected. The key insight: role framing ("financial analyst") changed the output quality more than any other instruction.

### Rate limiting design
Balancing protection against abuse with usability during testing was tricky. The current limits (5 req/15 min for leads) are appropriate for production but annoying during development.

---

## What I Would Do Differently

### Connect the frontend to local backend from day one
The HTML file was built pointing to the production URL. This meant local testing always hit the live server. Should have used an environment variable or config object at the top of the HTML file.

### Add authentication to admin endpoints earlier
GET /api/leads is currently unprotected. In production, this needs at minimum a secret header or basic auth. Should have been built in from the start, not left as a TODO.

### Use a queue for AI summary generation
The current design calls Claude API synchronously during the audit request. Under load, this creates a bottleneck. A job queue (Bull/BullMQ) would let the audit response return immediately while the summary generates in the background.

---

## Biggest Technical Risk

**SQLite under concurrent write load.** WAL mode helps with concurrent reads, but SQLite still serializes writes. If traffic spikes (e.g. a viral moment), concurrent audit submissions could queue up. The migration path to Postgres is straightforward but has not been tested.

---

## What I Learned

1. **Hard-code financial logic, use LLMs for prose.** The audit engine being deterministic means I can write tests that prove the recommendations are correct. That's not possible with LLM-generated recommendations.

2. **Fallback paths are features, not afterthoughts.** Building the fallback summary first made the AI integration feel low-risk. The product shipped faster because the AI was an enhancement, not a dependency.

3. **Separate PII from audit data.** Putting email in a separate `leads` table — linked by FK to `audits` — made it trivial to implement public sharing (just expose the audit, never the lead). This architectural decision would have been painful to retrofit.

4. **Rate limiting early.** Adding rate limiting before launch prevented having to retrofit it under pressure. The express-rate-limit middleware took 30 minutes to configure and has already blocked suspicious traffic.
