/**
 * Email a saved quote / estimate / invoice to the customer.
 *
 * Preferred path: send through the jaryd@blacktimber.ca inbox mailbox via
 * `composeAndSend()` so the email lands in the Sent folder, is tagged with the
 * document, and threads correctly. If that mailbox hasn't been created in the
 * inbox yet, we fall back to a plain transactional Resend send from the same
 * address so the feature still works on a fresh setup.
 *
 * The PDF is rendered in the browser (html2canvas + jsPDF) and passed in as
 * base64 — there is no server-side PDF renderer in this project.
 */

import "server-only";

import { loadQuote, saveQuote } from "@/lib/admin/quotes";
import { getBusinessProfile } from "@/lib/business-config";
import { getMailboxByAddress } from "@/lib/email/repository";
import { composeAndSend } from "@/lib/email/compose";
import { buildDocumentEmail } from "@/lib/email/document-email";
import { sendEmail } from "@/lib/resend/send-email";
import { AiError } from "@/lib/openrouter/errors";
import type { AdminDocumentType, AdminQuoteSaved } from "@/lib/admin/schemas";

/** From-address for customer document emails. Defaults to jaryd@blacktimber.ca. */
export function documentFromEmail(): string {
  return (
    process.env.QUOTE_FROM_EMAIL?.trim() ||
    process.env.ESIGN_FROM_EMAIL?.trim() ||
    "jaryd@blacktimber.ca"
  );
}

export interface SendDocumentEmailInput {
  documentId: string;
  /** Override recipients; defaults to the document's customer email. */
  to?: string[];
  cc?: string[];
  subject?: string;
  /** Personal intro message (plain text). Falls back to a sensible default. */
  message?: string;
  /** Base64-encoded PDF of the branded document (no data-URI prefix). */
  pdfBase64: string;
  /** PDF filename (defaults to the document's standard name). */
  filename?: string;
  /** Flip status draft → sent on success. Default true. */
  markSent?: boolean;
}

export interface SendDocumentEmailResult {
  ok: true;
  via: "inbox" | "transactional";
  resendId: string;
  messageId: string | null;
  to: string[];
  status: AdminQuoteSaved["status"];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendDocumentEmail(
  input: SendDocumentEmailInput
): Promise<SendDocumentEmailResult> {
  const quote = await loadQuote(input.documentId);
  if (!quote) {
    throw new AiError({
      code: "invalid_input",
      status: 404,
      clientMessage: "Document not found. Save it again, then try sending.",
    });
  }

  const recipients = (input.to?.length ? input.to : quote.customer.email ? [quote.customer.email] : [])
    .map((a) => a.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage:
        "No customer email on file. Add the customer's email to the document (or enter one) before sending.",
    });
  }

  const badEmail = recipients.find((a) => !EMAIL_RE.test(a));
  if (badEmail) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: `"${badEmail}" doesn't look like a valid email address.`,
    });
  }

  if (!input.pdfBase64 || input.pdfBase64.length < 100) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "The PDF couldn't be generated. Open the document, wait for it to render, and retry.",
    });
  }

  const business = getBusinessProfile();
  const { subject, html, text, filename } = buildDocumentEmail(quote, business, {
    subjectOverride: input.subject,
    customMessage: input.message,
  });

  const docType = (quote.documentType ?? "quote") as AdminDocumentType;
  const attachments = [
    {
      filename: input.filename || filename,
      content: input.pdfBase64,
      contentType: "application/pdf",
    },
  ];
  const tags: Record<string, string> = {
    kind: "document",
    document_type: docType,
    document_id: quote.id,
  };

  const from = documentFromEmail();
  const cc = input.cc?.map((a) => a.trim()).filter(Boolean);

  // Preferred: send through the inbox mailbox so it shows in Sent + is tagged.
  const mailbox = await getMailboxByAddress(from);

  let via: SendDocumentEmailResult["via"];
  let resendId: string;
  let messageId: string | null = null;

  if (mailbox && mailbox.active) {
    const result = await composeAndSend({
      mailboxId: mailbox.id,
      to: recipients,
      cc: cc?.length ? cc : undefined,
      subject,
      html,
      text,
      attachments,
      tags,
    });
    via = "inbox";
    resendId = result.resendId;
    messageId = result.messageId;
  } else {
    const result = await sendEmail({
      from,
      to: recipients,
      cc: cc?.length ? cc : undefined,
      replyTo: from,
      subject,
      html,
      attachments,
    });
    via = "transactional";
    resendId = result.id;
  }

  // Mark the document as sent (only bump a draft forward; never downgrade).
  let status = quote.status;
  const markSent = input.markSent !== false;
  if (markSent && quote.status === "draft") {
    try {
      const updated = await saveQuote({ ...quote, status: "sent" }, quote.createdBy || "admin");
      status = updated.status;
    } catch {
      // Email already went out — don't fail the request over a status write.
      status = "sent";
    }
  }

  return { ok: true, via, resendId, messageId, to: recipients, status };
}
