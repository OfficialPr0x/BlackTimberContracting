import "server-only";

import { getBusinessProfile } from "@/lib/business-config";
import { sendEmail } from "@/lib/resend/send-email";
import { isResendConfigured } from "@/lib/resend/client";
import { signPortalUrl } from "./site-url";
import type { EsignEnvelopeRow } from "./types";
import { insertEsignEmailEvent } from "./repository";

function ownerEmail(): string {
  return (
    process.env.ESIGN_NOTIFICATION_EMAIL?.trim() ||
    process.env.LEAD_NOTIFICATION_EMAIL?.trim() ||
    getBusinessProfile().email
  );
}

function emailShell(title: string, body: string): string {
  const biz = getBusinessProfile();
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e8e4dc;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#1a1816;border:1px solid #3d3830;border-radius:12px;padding:28px;">
    <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c5a880;margin:0 0 8px;">${biz.name}</p>
    <h1 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 16px;">${title}</h1>
    ${body}
    <p style="font-size:11px;color:#888;margin-top:24px;">${biz.phone} · ${biz.email}</p>
  </div>
</body>
</html>`.trim();
}

export async function notifySignerToSign(
  envelope: EsignEnvelopeRow,
  plainToken: string
): Promise<void> {
  if (!isResendConfigured()) return;

  const url = signPortalUrl(plainToken);
  const biz = getBusinessProfile();

  const html = emailShell(
    "Document ready for your signature",
    `
    <p style="color:#ccc;line-height:1.6;">Hi ${envelope.signerName},</p>
    <p style="color:#ccc;line-height:1.6;">
      <strong style="color:#fff;">${biz.name}</strong> sent you a document to review and sign:
      <strong style="color:#c5a880;">${envelope.title}</strong>
    </p>
    ${envelope.signerMessage ? `<p style="color:#aaa;font-style:italic;">"${envelope.signerMessage}"</p>` : ""}
    <p style="margin:24px 0;">
      <a href="${url}" style="display:inline-block;background:#c5a880;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">
        Review &amp; sign
      </a>
    </p>
    <p style="font-size:11px;color:#888;">Link expires ${envelope.expiresAt ? new Date(envelope.expiresAt).toLocaleDateString("en-CA") : "in 30 days"}. Do not forward this email if it contains private pricing.</p>
    `
  );

  const { id } = await sendEmail({
    to: envelope.signerEmail,
    subject: `Please sign: ${envelope.title} — ${biz.name}`,
    html,
    replyTo: biz.email,
  });

  await insertEsignEmailEvent(envelope.id, "email_sent", {
    resendId: id,
    to: envelope.signerEmail,
    template: "sign_request",
  });
}

export async function notifyOwnerSent(envelope: EsignEnvelopeRow): Promise<void> {
  if (!isResendConfigured()) return;
  const biz = getBusinessProfile();
  const html = emailShell(
    "E-sign sent",
    `<p style="color:#ccc;">Sent <strong style="color:#fff;">${envelope.title}</strong> to ${envelope.signerName} &lt;${envelope.signerEmail}&gt;.</p>
     <p style="color:#888;font-size:12px;">Track status in Admin → E-Sign.</p>`
  );
  await sendEmail({
    to: ownerEmail(),
    subject: `[E-sign sent] ${envelope.title}`,
    html,
  });
}

export async function notifyOwnerViewed(envelope: EsignEnvelopeRow): Promise<void> {
  if (!isResendConfigured()) return;
  const html = emailShell(
    "Document viewed",
    `<p style="color:#ccc;"><strong style="color:#fff;">${envelope.signerName}</strong> opened <strong>${envelope.title}</strong>.</p>`
  );
  await sendEmail({
    to: ownerEmail(),
    subject: `[Viewed] ${envelope.title} — ${envelope.signerName}`,
    html,
  });
}

export async function notifyOwnerSigned(envelope: EsignEnvelopeRow): Promise<void> {
  if (!isResendConfigured()) return;
  const biz = getBusinessProfile();
  const html = emailShell(
    "Document signed",
    `<p style="color:#ccc;"><strong style="color:#fff;">${envelope.signerName}</strong> signed <strong>${envelope.title}</strong>.</p>
     <p style="color:#888;font-size:12px;">Open Admin → E-Sign for the audit trail.</p>`
  );
  await sendEmail({
    to: ownerEmail(),
    subject: `[Signed] ${envelope.title} — ${envelope.signerName}`,
    html,
  });

  const signerHtml = emailShell(
    "Thank you — signed copy",
    `<p style="color:#ccc;">Hi ${envelope.signerName},</p>
     <p style="color:#ccc;">Your signature on <strong>${envelope.title}</strong> was recorded on ${new Date().toLocaleString("en-CA", { timeZone: "America/Vancouver" })}.</p>
     <p style="color:#888;font-size:12px;">Keep this email for your records. Questions? Reply or call ${biz.phone}.</p>`
  );
  await sendEmail({
    to: envelope.signerEmail,
    subject: `Signed: ${envelope.title} — ${biz.name}`,
    html: signerHtml,
  });
}
