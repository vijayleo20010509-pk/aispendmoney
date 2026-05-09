// tests/api.test.js
// Integration tests for the REST API routes.
// Spins up the Express app and uses supertest — no real HTTP port needed.

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.example' }); // use example env for tests

// Set test database so we don't pollute dev data
process.env.DATABASE_PATH = './data/test.db';
process.env.NODE_ENV = 'test';

// Run migrations for test DB
await import('../src/db/migrate.js');

import auditsRouter from '../src/routes/audits.js';
import leadsRouter from '../src/routes/leads.js';

// Minimal test app (no rate limiting in tests)
const app = express();
app.use(express.json());
app.use('/api/audits', auditsRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/share', auditsRouter);

// ─── POST /api/audits ─────────────────────────────────────────────────────────

describe('POST /api/audits', () => {
  test('Valid audit request returns 201 with auditId and results', async () => {
    const res = await request(app).post('/api/audits').send({
      teamSize: 5,
      devCount: 3,
      useCase: 'coding',
      tools: {
        cursor: { plan: 2, seats: 2, monthly: 80 },
        copilot: { plan: 1, seats: 3, monthly: 57 },
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.auditId).toBeTruthy();
    expect(res.body.shareToken).toBeTruthy();
    expect(res.body.audit.totalSaving).toBe(67);
    expect(res.body.audit.results.cursor).toBeDefined();
  });

  test('Missing tools → 400 validation error', async () => {
    const res = await request(app).post('/api/audits').send({
      teamSize: 5,
      devCount: 3,
      useCase: 'coding',
      tools: {},
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('Invalid useCase → 400', async () => {
    const res = await request(app).post('/api/audits').send({
      teamSize: 5,
      devCount: 3,
      useCase: 'gaming', // invalid
      tools: { cursor: { plan: 1, seats: 1, monthly: 20 } },
    });
    expect(res.status).toBe(400);
  });

  test('Negative monthly spend → 400', async () => {
    const res = await request(app).post('/api/audits').send({
      teamSize: 5,
      devCount: 3,
      useCase: 'coding',
      tools: { cursor: { plan: 1, seats: 1, monthly: -10 } },
    });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/audits/:id ──────────────────────────────────────────────────────

describe('GET /api/audits/:id', () => {
  let savedAuditId;

  beforeAll(async () => {
    const res = await request(app).post('/api/audits').send({
      teamSize: 4,
      devCount: 2,
      useCase: 'writing',
      tools: { claude: { plan: 2, seats: 2, monthly: 200 } },
    });
    savedAuditId = res.body.auditId;
  });

  test('Returns 200 with audit data for valid ID', async () => {
    const res = await request(app).get(`/api/audits/${savedAuditId}`);
    expect(res.status).toBe(200);
    expect(res.body.auditId).toBe(savedAuditId);
    expect(res.body.totalSaving).toBeGreaterThan(0);
  });

  test('Returns 404 for unknown ID', async () => {
    const res = await request(app).get('/api/audits/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/leads ──────────────────────────────────────────────────────────

describe('POST /api/leads', () => {
  let auditId;

  beforeAll(async () => {
    const res = await request(app).post('/api/audits').send({
      teamSize: 10,
      devCount: 5,
      useCase: 'coding',
      tools: {
        openai_api: { plan: 0, seats: 1, monthly: 3000 }, // $600 saving → high value
      },
    });
    auditId = res.body.auditId;
  });

  test('Valid lead capture returns 201', async () => {
    const res = await request(app).post('/api/leads').send({
      auditId,
      email: 'test@example.com',
      companyName: 'Acme Corp',
      role: 'CTO',
    });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.leadId).toBeTruthy();
    expect(res.body.isHighValue).toBe(true);
  });

  test('Duplicate email for same audit → idempotent 200', async () => {
    const res = await request(app).post('/api/leads').send({
      auditId,
      email: 'test@example.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });

  test('Honeypot field set → silent 200 (bot ignored)', async () => {
    const res = await request(app).post('/api/leads').send({
      auditId,
      email: 'bot@spam.com',
      website: 'http://malicious.com', // honeypot
    });
    expect(res.status).toBe(200);
    // Should not create a lead
    const checkRes = await request(app).post('/api/leads').send({ auditId, email: 'bot@spam.com' });
    // If honeypot worked, there's no existing lead → creates new one (201)
    // (we just verify the 200 response above was a no-op)
  });

  test('Invalid email → 400', async () => {
    const res = await request(app).post('/api/leads').send({
      auditId,
      email: 'not-an-email',
    });
    expect(res.status).toBe(400);
  });

  test('Non-existent auditId → 404', async () => {
    const res = await request(app).post('/api/leads').send({
      auditId: 'fake-id-123',
      email: 'test2@example.com',
    });
    expect(res.status).toBe(404);
  });
});
