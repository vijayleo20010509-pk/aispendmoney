// src/services/emailService.js
// Sends transactional emails via Resend API (primary) or SMTP (fallback).
// Uses nodemailer with an HTTP transport shim for Resend.

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const FROM = `${process.env.EMAIL_FROM_NAME || 'SpendScout'} <${process.env.EMAIL_FROM || 'audit@spendscout.credex.rocks'}>`;

/**
 * Resend HTTP transport via nodemailer
 * If RESEND_API_KEY is not set, falls back to Ethereal (dev only).
 */
async function createTransport() {
  if (process.env.RESEND_API_KEY) {
    // Resend supports SMTP on port 465 with api key as password
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  // Dev fallback: Ethereal (preview only, never actually delivered)
  const testAccount = await nodemailer.createTestAccount();
  console.warn('[email] RESEND_API_KEY not set — using Ethereal test account');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

let _transport = null;
async function getTransport() {
  if (!_transport) _transport = await createTransport();
  return _transport;
}

// ─── Email templates ──────────────────────────────────────────────────────────

function auditConfirmationHTML({ email, companyName, totalSpend, totalSaving, annualSaving, shareUrl, isHighValue }) {
  const greeting = companyName ? `Hi ${companyName} team` : 'Hi there';
  const credexBlock = isHighValue
    ? `<div style="margin:24px 0;padding:16px 20px;background:#0D1F2D;border-radius:10px;color:#fff;">
        <p style="margin:0 0 8px;font-weight:600;color:#00C896">You qualify for a Credex consultation</p>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8)">With $${totalSaving.toLocaleString()}/mo in identified savings, our team can walk you through sourcing discounted AI credits. Reply to this email or <a href="https://credex.rocks/book" style="color:#00C896">book a 15-min call</a>.</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F6F2;padding:40px 20px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06)">
    
    <div style="background:#0D1F2D;padding:28px 32px">
      <div style="font-size:20px;font-weight:800;color:#fff">Spend<span style="color:#00C896">Scout</span></div>
      <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px;letter-spacing:1px">BY CREDEX</div>
    </div>

    <div style="padding:32px">
      <p style="margin:0 0 16px;font-size:15px;color:#374151">${greeting},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151">Your AI spend audit is ready. Here's what we found:</p>

      <div style="display:flex;gap:12px;margin-bottom:24px">
        <div style="flex:1;padding:16px;background:#F7F6F2;border-radius:10px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#0D1F2D">$${totalSpend.toLocaleString()}</div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px">Current spend / mo</div>
        </div>
        <div style="flex:1;padding:16px;background:#F0FDF9;border:1px solid #A7F3D0;border-radius:10px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#059669">$${totalSaving.toLocaleString()}</div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px">Monthly savings</div>
        </div>
        <div style="flex:1;padding:16px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#EA580C">$${annualSaving.toLocaleString()}</div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px">Annual savings</div>
        </div>
      </div>

      ${credexBlock}

      <a href="${shareUrl}" style="display:block;text-align:center;padding:14px 24px;background:#0D1F2D;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin-bottom:24px">View your full audit →</a>

      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6">
        SpendScout is a free tool by <a href="https://credex.rocks" style="color:#0D1F2D">Credex</a> — we source discounted AI infrastructure credits.
        Your data is not sold. <a href="${shareUrl}/unsubscribe" style="color:#9CA3AF">Unsubscribe</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Public send functions ────────────────────────────────────────────────────

/**
 * sendAuditConfirmation — fires after lead email capture
 */
export async function sendAuditConfirmation({ email, companyName, totalSpend, totalSaving, annualSaving, shareUrl, isHighValue }) {
  try {
    const transport = await getTransport();
    const info = await transport.sendMail({
      from: FROM,
      to: email,
      subject: `Your AI spend audit — $${totalSaving.toLocaleString()}/mo savings identified`,
      html: auditConfirmationHTML({ email, companyName, totalSpend, totalSaving, annualSaving, shareUrl, isHighValue }),
    });
    console.log(`[email] Confirmation sent to ${email} — messageId: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    // Non-fatal: audit is still valid if email fails
    console.error('[email] sendAuditConfirmation failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * sendInternalHighValueAlert — notifies Credex team about a hot lead
 */
export async function sendInternalHighValueAlert({ email, companyName, totalSaving, auditId }) {
  const INTERNAL = process.env.CREDEX_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!INTERNAL) return;

  try {
    const transport = await getTransport();
    await transport.sendMail({
      from: FROM,
      to: INTERNAL,
      subject: `🔥 High-value lead: $${totalSaving}/mo savings — ${companyName || email}`,
      html: `<p><b>Lead:</b> ${email} (${companyName || 'unknown company'})</p>
             <p><b>Potential savings:</b> $${totalSaving}/mo</p>
             <p><b>Audit ID:</b> ${auditId}</p>
             <p>Follow up within 24 hours.</p>`,
    });
  } catch (err) {
    console.error('[email] sendInternalHighValueAlert failed:', err.message);
  }
}
