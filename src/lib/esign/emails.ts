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

/**
 * From-address for all e-sign mail. Defaults to jaryd@blacktimber.ca so signing
 * requests come from a recognizable, monitored mailbox on the verified domain.
 */
function esignFromEmail(): string {
  return process.env.ESIGN_FROM_EMAIL?.trim() || "jaryd@blacktimber.ca";
}

function refLine(envelope: EsignEnvelopeRow): string {
  return envelope.documentNumber
    ? `<p style="font-size:11px;color:#888;margin:4px 0 0;">Reference: ${envelope.documentNumber}</p>`
    : "";
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
  slug: string
): Promise<void> {
  if (!isResendConfigured()) return;

  const url = signPortalUrl(slug);
  const biz = getBusinessProfile();

  const html = emailShell(
    "Document ready for your signature",
    `
    <p style="color:#ccc;line-height:1.6;">Hi ${envelope.signerName},</p>
    <p style="color:#ccc;line-height:1.6;">
      <strong style="color:#fff;">${biz.name}</strong> sent you a document to review and sign:
      <strong style="color:#c5a880;">${envelope.title}</strong>
    </p>
    ${refLine(envelope)}
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
    from: esignFromEmail(),
    to: envelope.signerEmail,
    subject: `Please sign: ${envelope.title} — ${biz.name}`,
    html,
    replyTo: esignFromEmail(),
  });

  await insertEsignEmailEvent(envelope.id, "email_sent", {
    resendId: id,
    to: envelope.signerEmail,
    template: "sign_request",
  });
}

export async function notifyOwnerSent(envelope: EsignEnvelopeRow): Promise<void> {
  if (!isResendConfigured()) return;
  const html = emailShell(
    "E-sign sent",
    `<p style="color:#ccc;">Sent <strong style="color:#fff;">${envelope.title}</strong> to ${envelope.signerName} &lt;${envelope.signerEmail}&gt;.</p>
     <p style="color:#888;font-size:12px;">Track status in Admin → E-Sign.</p>`
  );
  await sendEmail({
    from: esignFromEmail(),
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
    from: esignFromEmail(),
    to: ownerEmail(),
    subject: `[Viewed] ${envelope.title} — ${envelope.signerName}`,
    html,
  });
}

/** Audit "Certificate of Completion" block reused in owner + signer emails. */
function certificateBlock(envelope: EsignEnvelopeRow): string {
  const f = envelope.signatureFields;
  const signedAt = envelope.signedAt
    ? new Date(envelope.signedAt).toLocaleString("en-CA", { timeZone: "America/Vancouver" })
    : new Date().toLocaleString("en-CA", { timeZone: "America/Vancouver" });
  const rows: Array<[string, string | undefined]> = [
    ["Document", envelope.title],
    ["Reference", envelope.documentNumber ?? undefined],
    ["Legal name", f?.legalName],
    ["Title", f?.title],
    ["Company", f?.company],
    ["Email", envelope.signerEmail],
    ["Address", f?.address],
    ["Date attested", f?.dateSigned],
    ["Signed (server time)", signedAt],
  ];
  const body = rows
    .filter(([, v]) => v && String(v).trim())
    .map(
      ([k, v]) =>
        `<tr><td style="padding:3px 12px 3px 0;color:#888;font-size:11px;white-space:nowrap;">${k}</td><td style="padding:3px 0;color:#e8e4dc;font-size:11px;">${v}</td></tr>`
    )
    .join("");
  return `
    <div style="margin:18px 0;padding:14px;border:1px solid #3d3830;border-radius:8px;background:#0f0e0c;">
      <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#c5a880;">Certificate of completion</p>
      <table style="border-collapse:collapse;">${body}</table>
    </div>`;
}

export async function notifyOwnerSigned(envelope: EsignEnvelopeRow): Promise<void> {
  if (!isResendConfigured()) return;
  const biz = getBusinessProfile();
  const certificate = certificateBlock(envelope);
  const html = emailShell(
    "Document signed",
    `<p style="color:#ccc;"><strong style="color:#fff;">${envelope.signerName}</strong> signed <strong>${envelope.title}</strong>.</p>
     ${certificate}
     <p style="color:#888;font-size:12px;">Open Admin → E-Sign for the full audit trail.</p>`
  );
  await sendEmail({
    from: esignFromEmail(),
    to: ownerEmail(),
    subject: `[Signed] ${envelope.title} — ${envelope.signerName}`,
    html,
  });

  const signerHtml = emailShell(
    "Thank you — signed copy",
    `<p style="color:#ccc;">Hi ${envelope.signerName},</p>
     <p style="color:#ccc;">Your electronic signature on <strong>${envelope.title}</strong> has been recorded. Keep this certificate for your records.</p>
     ${certificate}
     <p style="color:#888;font-size:12px;">Questions? Reply to this email or call ${biz.phone}.</p>`
  );
  await sendEmail({
    from: esignFromEmail(),
    to: envelope.signerEmail,
    subject: `Signed: ${envelope.title} — ${biz.name}`,
    html: signerHtml,
    replyTo: esignFromEmail(),
  });
}
