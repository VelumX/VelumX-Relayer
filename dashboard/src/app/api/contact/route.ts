import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const SUPPORT_EMAIL = 'support@velumx.xyz';
const PARTNERSHIPS_EMAIL = 'partnerships@velumx.xyz';
const FROM_EMAIL = 'VelumX <noreply@velumx.xyz>';

const ALLOWED_REASONS = new Set([
    'integration',
    'partnership',
    'sponsorship',
    'enterprise',
    'other',
]);

const REASON_LABELS: Record<string, string> = {
    integration: 'SDK Integration',
    partnership: 'Partnership & Collaboration',
    sponsorship: 'Sponsorship Policy',
    enterprise: 'Enterprise / High-Volume',
    other: 'Other',
};

// Route partnership/enterprise inquiries to the partnerships inbox
const PARTNERSHIP_REASONS = new Set(['partnership', 'enterprise']);

// Simple in-memory rate limit — one submission per IP per 10 minutes
// For production scale, replace with Redis-backed rate limiting
const submissionLog = new Map<string, number>();
const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

function isRateLimited(ip: string): boolean {
    const last = submissionLog.get(ip);
    if (!last) return false;
    if (Date.now() - last < RATE_LIMIT_MS) return true;
    submissionLog.delete(ip);
    return false;
}

export async function POST(req: NextRequest) {
    try {
        // ── Rate limiting ─────────────────────────────────────────────────
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || 'unknown';

        if (isRateLimited(ip)) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait a few minutes before trying again.' },
                { status: 429 }
            );
        }

        // ── Input validation ──────────────────────────────────────────────
        const body = await req.json();
        const { name, email, reason, projectUrl, message } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
            return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
        }
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }
        if (!reason || !ALLOWED_REASONS.has(reason)) {
            return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
        }
        if (!message || typeof message !== 'string' || message.trim().length < 20 || message.trim().length > 5000) {
            return NextResponse.json({ error: 'Message must be between 20 and 5000 characters' }, { status: 400 });
        }
        if (projectUrl && (typeof projectUrl !== 'string' || projectUrl.length > 500)) {
            return NextResponse.json({ error: 'Invalid project URL' }, { status: 400 });
        }

        const sanitizedName = name.trim();
        const sanitizedEmail = email.trim().toLowerCase();
        const sanitizedMessage = message.trim();
        const sanitizedProjectUrl = projectUrl?.trim() || null;
        const reasonLabel = REASON_LABELS[reason];

        // Route to the right inbox
        const toEmail = PARTNERSHIP_REASONS.has(reason) ? PARTNERSHIPS_EMAIL : SUPPORT_EMAIL;

        // ── Send to VelumX team ───────────────────────────────────────────
        await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            replyTo: sanitizedEmail,
            subject: `[${reasonLabel}] Inbound from ${sanitizedName}`,
            html: internalTemplate({
                name: sanitizedName,
                email: sanitizedEmail,
                reason: reasonLabel,
                projectUrl: sanitizedProjectUrl,
                message: sanitizedMessage,
                source: 'Public Contact Page',
            }),
        });

        // ── Send confirmation to sender ───────────────────────────────────
        await resend.emails.send({
            from: FROM_EMAIL,
            to: sanitizedEmail,
            subject: `We received your message — VelumX`,
            html: confirmationTemplate({
                name: sanitizedName,
                reason: reasonLabel,
                message: sanitizedMessage,
            }),
        });

        // Record submission for rate limiting
        submissionLog.set(ip, Date.now());

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Contact API] Failed to send contact email:', error);
        return NextResponse.json({ error: 'Failed to submit message' }, { status: 500 });
    }
}

// ── Email Templates ───────────────────────────────────────────────────────────

function internalTemplate(data: {
    name: string;
    email: string;
    reason: string;
    projectUrl: string | null;
    message: string;
    source: string;
}) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">

        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;">VelumX · ${escapeHtml(data.source)}</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">New Inbound Message</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px 0;">
            <span style="display:inline-block;padding:4px 12px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);border-radius:6px;font-size:11px;font-weight:700;color:rgba(167,139,250,0.9);letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(data.reason)}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${field('From', `${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;`)}
              ${data.projectUrl ? field('Project', `<a href="${escapeHtml(data.projectUrl)}" style="color:#38bdf8;text-decoration:none;">${escapeHtml(data.projectUrl)}</a>`) : ''}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 32px;">
            <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.12em;text-transform:uppercase;">Message</p>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.7;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);">
            <a href="mailto:${escapeHtml(data.email)}?subject=Re: Your VelumX inquiry"
               style="display:inline-block;padding:12px 24px;background:#ffffff;color:#000000;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
              Reply to ${escapeHtml(data.name)}
            </a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function confirmationTemplate(data: { name: string; reason: string; message: string }) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">

        <tr>
          <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;">VelumX</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Message received.</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7;">
              Hi ${escapeHtml(data.name)}, thanks for reaching out. The VelumX team has received your message and will get back to you within 24 hours.
            </p>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.12em;text-transform:uppercase;">Category</p>
              <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#ffffff;">${escapeHtml(data.reason)}</p>
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.12em;text-transform:uppercase;">Your message</p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message.length > 300 ? data.message.substring(0, 300) + '...' : data.message)}</p>
            </div>

            <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);">
              In the meantime, explore our documentation:
            </p>
            <a href="https://docs.velumx.xyz" style="display:inline-block;margin-bottom:24px;font-size:13px;font-weight:600;color:#38bdf8;text-decoration:none;">
              docs.velumx.xyz →
            </a>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;">
              Already have an account? <a href="https://dashboard.velumx.xyz" style="color:rgba(255,255,255,0.5);text-decoration:none;">Sign in to your dashboard →</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
              VelumX · Gasless Infrastructure for Stacks ·
              <a href="https://dashboard.velumx.xyz" style="color:rgba(255,255,255,0.3);text-decoration:none;">dashboard.velumx.xyz</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function field(label: string, value: string) {
    return `
    <tr>
      <td style="padding:0 0 14px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.12em;text-transform:uppercase;">${label}</p>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);">${value}</p>
      </td>
    </tr>`;
}

function escapeHtml(str: string) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
