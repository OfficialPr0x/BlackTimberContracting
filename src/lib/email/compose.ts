/**
 * Compose / reply / forward orchestration.
 *
 * Builds the outbound payload (threading headers, signature, tags), sends via
 * Resend, then persists a Sent message so the thread stays in sync.
 */

import "server-only";

import {
  forwardSubject,
  formatAddress,
  parseAddress,
  replySubject,
} from "./addresses";
import {
  EmailRepoError,
  getMailbox,
  getMessage,
  saveOutboundMessage,
} from "./repository";
import { forwardReceivingEmail, sendMessage } from "./resend";
import type { ComposeInput } from "./types";

/** Resend tag names/values allow only [a-zA-Z0-9_-]. Coerce best-effort. */
function toTags(tags?: Record<string, string>): { name: string; value: string }[] {
  if (!tags) return [];
  const clean = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256);
  return Object.entries(tags)
    .filter(([k]) => k)
    .map(([name, value]) => ({ name: clean(name), value: clean(value ?? "") }));
}

export interface ComposeResult {
  messageId: string;
  resendId: string;
}

export async function composeAndSend(input: ComposeInput): Promise<ComposeResult> {
  const mailbox = await getMailbox(input.mailboxId);
  if (!mailbox) throw new EmailRepoError("Mailbox not found.", 404);
  if (!mailbox.active) throw new EmailRepoError("Mailbox is inactive.", 400);

  const from = formatAddress(mailbox.address, mailbox.displayName);

  // ---- Forward an inbound message verbatim (preserves attachments) ----------
  if (input.forwardMessageId) {
    const parent = await getMessage(input.forwardMessageId);
    if (!parent) throw new EmailRepoError("Message to forward not found.", 404);
    if (parent.direction === "inbound" && parent.resendId) {
      const { id: resendId } = await forwardReceivingEmail({
        emailId: parent.resendId,
        to: input.to,
        from,
      });
      const messageId = await saveOutboundMessage({
        mailboxId: mailbox.id,
        resendId,
        rfcMessageId: null,
        inReplyTo: null,
        refIds: parent.refIds,
        fromAddress: mailbox.address,
        fromName: mailbox.displayName,
        toAddresses: input.to,
        ccAddresses: input.cc ?? [],
        bccAddresses: input.bcc ?? [],
        replyTo: null,
        subject: input.subject || forwardSubject(parent.subject),
        bodyHtml: parent.bodyHtml,
        bodyText: parent.bodyText,
        tags: input.tags ?? {},
        hasAttachments: parent.hasAttachments,
      });
      return { messageId, resendId };
    }
    // Non-inbound or no Resend id: fall through to a normal composed forward.
  }

  // ---- Threading headers for replies ---------------------------------------
  let subject = input.subject;
  let inReplyTo: string | null = null;
  let refIds: string[] = [];
  const headers: Record<string, string> = {};

  if (input.inReplyToMessageId) {
    const parent = await getMessage(input.inReplyToMessageId);
    if (parent) {
      if (!subject) subject = replySubject(parent.subject);
      inReplyTo = parent.rfcMessageId;
      refIds = [...parent.refIds, parent.rfcMessageId].filter(Boolean) as string[];
      if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
      if (refIds.length > 0) headers["References"] = refIds.join(" ");
    }
  }

  // ---- Signature -----------------------------------------------------------
  const html = mailbox.signatureHtml
    ? `${input.html}<br><br>${mailbox.signatureHtml}`
    : input.html;

  const { id: resendId } = await sendMessage({
    from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: subject || "(no subject)",
    html,
    text: input.text,
    headers: Object.keys(headers).length ? headers : undefined,
    tags: toTags(input.tags),
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  const messageId = await saveOutboundMessage({
    mailboxId: mailbox.id,
    resendId,
    rfcMessageId: null,
    inReplyTo,
    refIds,
    fromAddress: mailbox.address,
    fromName: mailbox.displayName,
    toAddresses: input.to,
    ccAddresses: input.cc ?? [],
    bccAddresses: input.bcc ?? [],
    replyTo: null,
    subject: subject || "(no subject)",
    bodyHtml: html,
    bodyText: input.text ?? null,
    tags: input.tags ?? {},
    hasAttachments: (input.attachments?.length ?? 0) > 0,
  });

  return { messageId, resendId };
}

export { parseAddress };
