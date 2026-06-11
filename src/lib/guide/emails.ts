import "server-only";

import { sendEmail } from "@/lib/resend/send-email";
import { getBusinessProfile } from "@/lib/business-config";
import { GUIDE_TITLE } from "./constants";

function guideUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.BUSINESS_SITE_URL ??
    "https://www.blacktimber.ca";
  return `${base.replace(/\/$/, "")}/guide`;
}

export async function sendGuideWelcomeEmail(input: {
  to: string;
  name: string;
  password: string;
}): Promise<void> {
  const biz = getBusinessProfile();
  const url = guideUrl();

  const html = `<!doctype html><html><body style="background:#0b0a09;color:#fff;font-family:system-ui,sans-serif;padding:32px;line-height:1.6;">
    <h2 style="color:#c5a880;text-transform:uppercase;letter-spacing:2px;font-size:13px;">Black Timber Field Guide</h2>
    <p style="font-size:15px;">Hi ${escapeHtml(input.name)},</p>
    <p style="color:#a8a29e;font-size:14px;">Your password-protected copy of the <strong style="color:#fff;">Kootenay Homeowner Project Readiness &amp; Resilience Manual</strong> is ready.</p>
    <div style="background:#141311;border:1px solid #c5a88044;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#c5a880;margin:0 0 8px;">Your access password</p>
      <p style="font-family:ui-monospace,monospace;font-size:22px;font-weight:700;color:#fff;letter-spacing:2px;margin:0;">${escapeHtml(input.password)}</p>
    </div>
    <p style="font-size:14px;"><a href="${url}" style="color:#c5a880;font-weight:700;">Open the Field Guide →</a></p>
    <p style="font-size:12px;color:#a8a29e;">Sign in with this email address and the password above. Save this email — we cannot recover your password from the website.</p>
    <hr style="border:none;border-top:1px solid #2c2a25;margin:28px 0;" />
    <p style="font-size:11px;color:#888;">${escapeHtml(biz.name)} · ${escapeHtml(biz.phone)} · ${escapeHtml(biz.email)}</p>
  </body></html>`;

  await sendEmail({
    to: input.to,
    subject: `Your Field Guide access — ${GUIDE_TITLE.split(":")[0]}`,
    html,
    replyTo: biz.email,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
