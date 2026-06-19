/**
 * Customer-facing email content for quotes / estimates / invoices.
 *
 * Builds a clean, light-themed HTML email (the dark theme used for internal
 * e-sign notifications looks wrong in a customer's inbox) plus a sensible
 * default subject and a suggested attachment filename. The admin can override
 * the subject and add a personal intro message before sending.
 */

import "server-only";

import { getBusinessProfile, type BusinessProfile } from "@/lib/business-config";
import { documentPdfFilename } from "@/lib/pdf/filename";
import type { AdminDocumentType, AdminQuoteSaved } from "@/lib/admin/schemas";

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d?: string): string | null {
  if (!d) return null;
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LABELS: Record<AdminDocumentType, { noun: string; title: string }> = {
  quote: { noun: "quote", title: "Quote" },
  estimate: { noun: "estimate", title: "Estimate" },
  invoice: { noun: "invoice", title: "Invoice" },
};

export interface DocumentEmailParts {
  subject: string;
  html: string;
  text: string;
  filename: string;
}

export interface BuildDocumentEmailOptions {
  /** Admin override for the subject line. */
  subjectOverride?: string;
  /** Optional personal intro from the admin (plain text). */
  customMessage?: string;
}

/** Default plain-text intro the composer pre-fills (admin can edit before send). */
export function defaultDocumentMessage(quote: AdminQuoteSaved): string {
  const docType = (quote.documentType ?? "quote") as AdminDocumentType;
  const { noun } = LABELS[docType] ?? LABELS.quote;
  const firstName = quote.customer.name.trim().split(/\s+/)[0] || "there";
  if (docType === "invoice") {
    const due = fmtDate(quote.validUntil);
    return [
      `Hi ${firstName},`,
      "",
      `Please find your invoice (${quote.id}) attached as a PDF. The balance due is ${fmtCAD(
        quote.totals.grandTotalCAD
      )}${due ? `, payable by ${due}` : ""}.`,
      "",
      "Let me know if you have any questions — happy to help.",
    ].join("\n");
  }
  const valid = fmtDate(quote.validUntil);
  return [
    `Hi ${firstName},`,
    "",
    `Thanks for the opportunity. Your ${noun} (${quote.id}) is attached as a PDF, with a total of ${fmtCAD(
      quote.totals.grandTotalCAD
    )}${valid ? `. This ${noun} is valid until ${valid}` : ""}.`,
    "",
    "If anything looks off or you'd like to adjust the scope, just reply to this email or give me a call.",
  ].join("\n");
}

export function buildDocumentEmail(
  quote: AdminQuoteSaved,
  business: BusinessProfile = getBusinessProfile(),
  options: BuildDocumentEmailOptions = {}
): DocumentEmailParts {
  const docType = (quote.documentType ?? "quote") as AdminDocumentType;
  const { noun, title } = LABELS[docType] ?? LABELS.quote;

  const subject =
    options.subjectOverride?.trim() ||
    (docType === "invoice"
      ? `Invoice ${quote.id} from ${business.name}`
      : `Your ${noun} from ${business.name} (${quote.id})`);

  const messageText = (options.customMessage?.trim() || defaultDocumentMessage(quote)).trim();
  const messageHtml = escapeHtml(messageText).replace(/\n/g, "<br>");

  const dateLabel = docType === "invoice" ? "Payment due" : `${title} valid until`;
  const dateValue = fmtDate(quote.validUntil);

  const summaryRows: Array<[string, string]> = [
    [`${title} number`, quote.id],
    ["Total", fmtCAD(quote.totals.grandTotalCAD)],
  ];
  if (dateValue) summaryRows.push([dateLabel, dateValue]);

  const summary = summaryRows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:5px 16px 5px 16px;color:#6b6b6b;font-size:13px;white-space:nowrap;">${escapeHtml(
          k
        )}</td><td style="padding:5px 16px 5px 0;color:#1c1917;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(
          v
        )}</td></tr>`
    )
    .join("");

  const website = `https://${business.domain}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:24px;background:#f4f2ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d8;border-radius:14px;overflow:hidden;">
    <div style="padding:22px 28px;border-bottom:1px solid #efeae0;">
      <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c5a880;font-weight:700;">${escapeHtml(
        business.name
      )}</p>
      <h1 style="margin:6px 0 0;font-size:19px;font-weight:700;color:#1c1917;">${escapeHtml(
        title
      )} ${escapeHtml(quote.id)}</h1>
    </div>
    <div style="padding:24px 28px;">
      <div style="font-size:14px;line-height:1.65;color:#33312e;">${messageHtml}</div>
      <table style="border-collapse:collapse;margin:22px 0 4px;width:100%;background:#faf8f4;border:1px solid #efeae0;border-radius:10px;">
        <tbody>
          <tr><td colspan="2" style="padding:14px 16px 4px;color:#c5a880;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">${escapeHtml(
            title
          )} summary</td></tr>
          ${summary}
          <tr><td colspan="2" style="height:8px"></td></tr>
        </tbody>
      </table>
      <p style="margin:18px 0 0;font-size:13px;color:#6b6b6b;line-height:1.6;">
        The full ${escapeHtml(noun)} is attached to this email as a PDF.
      </p>
    </div>
    <div style="padding:18px 28px;border-top:1px solid #efeae0;background:#faf8f4;">
      <p style="margin:0;font-size:12px;color:#6b6b6b;line-height:1.6;">
        ${escapeHtml(business.name)}${business.region ? ` &middot; ${escapeHtml(business.region)}` : ""}<br>
        <a href="tel:${escapeHtml(business.phone.replace(/[^0-9+]/g, ""))}" style="color:#1c1917;text-decoration:none;">${escapeHtml(
          business.phone
        )}</a> &middot;
        <a href="${escapeHtml(website)}" style="color:#c5a880;text-decoration:none;">${escapeHtml(
          business.domain
        )}</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();

  const filename = documentPdfFilename({
    id: quote.id,
    documentType: quote.documentType,
    customerName: quote.customer.name,
  });

  return { subject, html, text: messageText, filename };
}
