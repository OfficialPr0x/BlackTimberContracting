/**
 * Inbound ingestion orchestrator.
 *
 * Given an `email.received` webhook (which carries only metadata), this:
 *   1. fetches the full message via the Receiving API,
 *   2. picks the target mailbox from the To/Cc addresses,
 *   3. classifies it (category / spam),
 *   4. persists the message + attachment metadata,
 *   5. best-effort copies attachments into Supabase Storage.
 *
 * Returns the stored message id, or null if no matching mailbox was found.
 */

import "server-only";

import { parseAddress } from "./addresses";
import { classifyInbound } from "./classify";
import {
  getMailboxByAddress,
  listMailboxes,
  saveInboundMessage,
  setAttachmentStoragePath,
  getMessage,
} from "./repository";
import { getReceivingAttachment, getReceivingEmail } from "./resend";
import { safeName, uploadAttachment } from "./storage";

function headerLookup(headers: Record<string, string> | null, name: string): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

/** Parse a References header into individual message ids. */
function parseRefs(value: string | null): string[] {
  if (!value) return [];
  return value.match(/<[^>]+>/g) ?? value.split(/\s+/).filter(Boolean);
}

async function pickMailboxId(toAddresses: string[], ccAddresses: string[]): Promise<string | null> {
  const candidates = [...toAddresses, ...ccAddresses];
  for (const addr of candidates) {
    const mb = await getMailboxByAddress(addr);
    if (mb?.active) return mb.id;
  }
  // Catch-all: env override, then first active shared mailbox.
  const catchAll = process.env.EMAIL_CATCHALL_ADDRESS?.trim().toLowerCase();
  if (catchAll) {
    const mb = await getMailboxByAddress(catchAll);
    if (mb?.active) return mb.id;
  }
  const all = await listMailboxes();
  const shared = all.find((m) => m.kind === "shared") ?? all[0];
  return shared?.id ?? null;
}

export interface IngestResult {
  messageId: string | null;
  mailboxId: string | null;
}

export async function ingestInboundEmail(receivingEmailId: string): Promise<IngestResult> {
  const email = await getReceivingEmail(receivingEmailId);

  const toAddresses = email.to.map((a) => parseAddress(a).address);
  const ccAddresses = email.cc.map((a) => parseAddress(a).address);
  const mailboxId = await pickMailboxId(toAddresses, ccAddresses);
  if (!mailboxId) {
    console.warn(JSON.stringify({ kind: "email.ingest", msg: "no mailbox matched", to: email.to }));
    return { messageId: null, mailboxId: null };
  }

  const fromParsed = parseAddress(email.from);
  const inReplyTo = headerLookup(email.headers, "in-reply-to");
  const refs = parseRefs(headerLookup(email.headers, "references"));

  const cls = classifyInbound({
    fromAddress: fromParsed.address,
    subject: email.subject,
    bodyText: email.text,
    bodyHtml: email.html,
    headers: email.headers,
  });

  const messageId = await saveInboundMessage({
    mailboxId,
    resendId: email.id,
    rfcMessageId: email.messageId,
    inReplyTo: inReplyTo,
    refIds: refs,
    fromAddress: fromParsed.address,
    fromName: fromParsed.name,
    toAddresses,
    ccAddresses,
    bccAddresses: email.bcc.map((a) => parseAddress(a).address),
    replyTo: email.replyTo[0] ? parseAddress(email.replyTo[0]).address : null,
    subject: email.subject,
    bodyHtml: email.html,
    bodyText: email.text,
    category: cls.category,
    folder: cls.folder,
    emailDate: email.createdAt,
    rawUrl: email.rawUrl,
    rawUrlExpiresAt: email.rawUrlExpiresAt,
    attachments: email.attachments.map((a) => ({
      resendAttachmentId: a.id,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.size,
      contentId: a.contentId,
      contentDisposition: a.contentDisposition,
    })),
  });

  // Best-effort: copy attachments into Storage so they outlive Resend's 1h URL.
  if (email.attachments.length > 0) {
    void persistAttachments(messageId, email.id).catch((err) =>
      console.warn(
        JSON.stringify({ kind: "email.ingest", msg: "attachment persist failed", err: String(err) })
      )
    );
  }

  return { messageId, mailboxId };
}

async function persistAttachments(messageId: string, receivingEmailId: string): Promise<void> {
  const detail = await getMessage(messageId);
  if (!detail) return;
  for (const att of detail.attachments) {
    if (att.stored || !att.resendAttachmentId) continue;
    try {
      const signed = await getReceivingAttachment(receivingEmailId, att.resendAttachmentId);
      const res = await fetch(signed.downloadUrl);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const bytes = await res.arrayBuffer();
      const path = `${messageId}/${att.id}/${safeName(att.filename, "attachment")}`;
      await uploadAttachment(path, bytes, att.contentType);
      await setAttachmentStoragePath(att.id, path);
    } catch (err) {
      console.warn(
        JSON.stringify({
          kind: "email.ingest",
          msg: "one attachment failed",
          attachmentId: att.id,
          err: String(err),
        })
      );
    }
  }
}
