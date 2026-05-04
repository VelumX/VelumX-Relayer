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
        // ── Auth — must be a signed-in dashboard user ─────────────────────
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        // ── Send notification to VelumX support team ─────────────────────
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

        // ── Send confirmation to the developer ────────────────────────────
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

// ── Email Templates ───────────────────────────────────────────────────────────

function supportTeamTemplate(data: {
    name: string;
    email: string;
    reason: string;
    projectUrl: string | null;
    message: string;
    userId: string;
}) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;">VelumX Support</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">New Support Request</h1>
          </td>
        </tr>

        <!-- Category badge -->
        <tr>
          <td style="padding:24px 40px 0;">
            <span style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.1em;text-transform:uppercase;">${data.reason}</span>
          </td>
        </tr>

        <!-- Fields -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${field('From', `${data.name} &lt;${data.email}&gt;`)}
              ${field('User ID', `<code style="font-family:monospace;font-size:12px;color:rgba(255,255,255,0.5)">${data.userId}</code>`)}
              ${data.projectUrl ? field('Project', `<a href="${data.projectUrl}" style="color:#38bdf8;text-decoration:none;">${data.projectUrl}</a>`) : ''}
            </table>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:0 40px 32px;">
            <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.12em;text-transform:uppercase;">Message</p>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.7;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
            </div>
          </td>
        </tr>

        <!-- Reply CTA -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);">
            <a href="mailto:${data.email}?subject=Re: [${data.reason}] Your VelumX support request"
               style="display:inline-block;padding:12px 24px;background:#ffffff;color:#000000;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
              Reply to ${data.name}
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
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="width:48px;height:48px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);border-radius:12px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
              <span style="font-size:22px;">✓</span>
            </div>
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;">VelumX Support</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">We've got your request.</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7;">
              Hi ${escapeHtml(data.name)}, your support request has been received by the VelumX engineering team.
              We'll review your message and get back to you as soon as possible.
            </p>

            <!-- Summary box -->
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.12em;text-transform:uppercase;">Category</p>
              <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#ffffff;">${data.reason}</p>
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.12em;text-transform:uppercase;">Your message</p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message.length > 300 ? data.message.substring(0, 300) + '...' : data.message)}</p>
            </div>

            <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;">
              While you wait, you may find what you need in our documentation:
            </p>
            <a href="https://docs.velumx.xyz"
               style="display:inline-block;margin-bottom:24px;font-size:13px;font-weight:600;color:#38bdf8;text-decoration:none;">
              docs.velumx.xyz →
            </a>

            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;">
              If your issue is urgent, reply directly to this email and include any relevant transaction IDs or error messages.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.6;">
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
