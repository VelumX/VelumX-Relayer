import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

const SUPPORT_EMAIL = 'support@velumx.xyz';
const FROM_EMAIL = 'VelumX Support <noreply@velumx.xyz>';

const ALLOWED_REASONS = new Set([
    'integration',
    'sponsorship',
    'billing',
    'incident',
    'partnership',
    'other',
]);

const REASON_LABELS: Record<string, string> = {
    integration: 'SDK Integration',
    sponsorship: 'Sponsorship Policy',
    billing: 'Billing & Limits',
    incident: 'Incident Report',
    partnership: 'Partnership',
    other: 'Other',
};

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        await resend.emails.send({
            from: FROM_EMAIL,
            to: SUPPORT_EMAIL,
            replyTo: sanitizedEmail,
            subject: `[${reasonLabel}] Support request from ${sanitizedName}`,
            html: supportTeamTemplate({
                name: sanitizedName,
                email: sanitizedEmail,
                reason: reasonLabel,
                projectUrl: sanitizedProjectUrl,
                message: sanitizedMessage,
                userId: user.id,
            }),
        });

        await resend.emails.send({
            from: FROM_EMAIL,
            to: sanitizedEmail,
            subject: `We received your request — VelumX Support`,
            html: developerConfirmationTemplate({
                name: sanitizedName,
                reason: reasonLabel,
                message: sanitizedMessage,
            }),
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Support API] Failed to send support email:', error);
        return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
    outer:   'background:#f4f4f5;padding:40px 20px;',
    card:    'background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;',
    header:  'padding:32px 40px 24px;border-bottom:1px solid #e4e4e7;background:#fafafa;',
    body:    'padding:32px 40px;',
    footer:  'padding:20px 40px;border-top:1px solid #e4e4e7;background:#fafafa;',
    box:     'background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;padding:20px;',
    eyebrow: 'margin:0 0 4px;font-size:11px;font-weight:700;color:#71717a;letter-spacing:0.12em;text-transform:uppercase;',
    h1:      'margin:0;font-size:22px;font-weight:700;color:#18181b;',
    h2:      'margin:0;font-size:20px;font-weight:700;color:#18181b;',
    body1:   'margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.7;',
    body2:   'margin:0;font-size:13px;color:#52525b;line-height:1.6;',
    label:   'margin:0 0 4px;font-size:11px;font-weight:700;color:#71717a;letter-spacing:0.1em;text-transform:uppercase;',
    value:   'margin:0;font-size:13px;color:#18181b;',
    muted:   'margin:0;font-size:11px;color:#a1a1aa;line-height:1.6;',
    link:    'color:#2563eb;text-decoration:none;',
    badge:   'display:inline-block;padding:4px 12px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;font-size:11px;font-weight:700;color:#3f3f46;letter-spacing:0.08em;text-transform:uppercase;',
    btn:     'display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;',
};

// ── Email Templates ───────────────────────────────────────────────────────────

function supportTeamTemplate(data: {
    name: string;
    email: string;
    reason: string;
    projectUrl: string | null;
    message: string;
    userId: string;
}) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="${S.outer}">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="${S.card}">

        <tr>
          <td style="${S.header}">
            <p style="${S.eyebrow}">VelumX Support</p>
            <h1 style="${S.h2}">New Support Request</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px 0;">
            <span style="${S.badge}">${escapeHtml(data.reason)}</span>
          </td>
        </tr>

        <tr>
          <td style="${S.body}">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${field('From', `${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;`)}
              ${field('User ID', `<code style="font-family:monospace;font-size:12px;color:#52525b;">${escapeHtml(data.userId)}</code>`)}
              ${data.projectUrl ? field('Project', `<a href="${escapeHtml(data.projectUrl)}" style="${S.link}">${escapeHtml(data.projectUrl)}</a>`) : ''}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 32px;">
            <p style="${S.label}">Message</p>
            <div style="${S.box}">
              <p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.7;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="${S.footer}">
            <a href="mailto:${escapeHtml(data.email)}?subject=Re: [${escapeHtml(data.reason)}] Your VelumX support request"
               style="${S.btn}">
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

function developerConfirmationTemplate(data: {
    name: string;
    reason: string;
    message: string;
}) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="${S.outer}">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="${S.card}">

        <tr>
          <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid #e4e4e7;background:#fafafa;">
            <div style="width:48px;height:48px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:12px;margin:0 auto 20px;line-height:48px;text-align:center;">
              <span style="font-size:22px;line-height:48px;">✓</span>
            </div>
            <p style="${S.eyebrow}">VelumX Support</p>
            <h1 style="${S.h1}">We've got your request.</h1>
          </td>
        </tr>

        <tr>
          <td style="${S.body}">
            <p style="${S.body1}">
              Hi ${escapeHtml(data.name)}, your support request has been received by the VelumX engineering team.
              We'll review your message and get back to you as soon as possible.
            </p>

            <div style="${S.box}margin-bottom:24px;">
              <p style="${S.label}">Category</p>
              <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#18181b;">${escapeHtml(data.reason)}</p>
              <p style="${S.label}">Your message</p>
              <p style="${S.body2}">${escapeHtml(data.message.length > 300 ? data.message.substring(0, 300) + '...' : data.message)}</p>
            </div>

            <p style="margin:0 0 6px;font-size:13px;color:#52525b;">
              While you wait, you may find what you need in our documentation:
            </p>
            <a href="https://docs.velumx.xyz" style="display:inline-block;margin-bottom:24px;font-size:13px;font-weight:600;${S.link}">
              docs.velumx.xyz →
            </a>

            <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
              If your issue is urgent, reply directly to this email and include any relevant transaction IDs or error messages.
            </p>
          </td>
        </tr>

        <tr>
          <td style="${S.footer}">
            <p style="${S.muted}">
              VelumX · Gasless Infrastructure for Stacks ·
              <a href="https://dashboard.velumx.xyz" style="color:#71717a;text-decoration:none;">dashboard.velumx.xyz</a>
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
        <p style="${S.label}">${label}</p>
        <p style="${S.value}">${value}</p>
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
