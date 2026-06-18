/**
 * Resend wrappers for the email client — server only.
 *
 * Sending uses the existing client in lib/resend/client.ts. Receiving uses the
 * SDK's `emails.receiving` API (list/get/forward + attachments). Webhook
 * verification uses `webhooks.verify` (Svix under the hood).
 *
 * Env:
 *   RESEND_API_KEY          send + receive (server)
 *   RESEND_WEBHOOK_SECRET   signing secret from the Resend webhook (whsec_...)
 *   EMAIL_DOMAIN            your verified domain, default "blacktimber.ca"
 */

import "server-only";
import type { WebhookEventPayload } from "resend";
import { getResendClient } from "@/lib/resend/client";

export function getEmailDomain(): string {
  return (process.env.EMAIL_DOMAIN?.trim() || "blacktimber.ca").toLowerCase();
}

export function getWebhookSecret(): string | undefined {
  const s = process.env.RESEND_WEBHOOK_SECRET?.trim();
  return s && !s.includes("xxxx") ? s : undefined;
}

function requireClient() {
  const client = getResendClient();
  if (!client) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to your environment to send/receive email."
    );
  }
  return client;
}

// -----------------------------------------------------------------------------
// Sending
// -----------------------------------------------------------------------------

export interface SendMessageInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Custom headers (In-Reply-To / References for threading). */
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  attachments?: { filename: string; content: string | Buffer; contentType?: string }[];
  /** Idempotency key to dedupe accidental double-sends. */
  idempotencyKey?: string;
}

export async function sendMessage(input: SendMessageInput): Promise<{ id: string }> {
  const client = requireClient();
  const { data, error } = await client.emails.send(
    {
      from: input.from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: input.headers,
      tags: input.tags,
      attachments: input.attachments,
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
  );
  if (error) throw new Error(`Resend send: ${error.message}`);
  if (!data?.id) throw new Error("Resend send: no id returned");
  return { id: data.id };
}

// -----------------------------------------------------------------------------
// Receiving (inbound)
// -----------------------------------------------------------------------------

export interface ReceivingAttachment {
  id: string;
  filename: string | null;
  size: number;
  contentType: string;
  contentId: string | null;
  contentDisposition: string | null;
}

export interface ReceivingEmail {
  id: string;
  to: string[];
  from: string;
  cc: string[];
  bcc: string[];
  replyTo: string[];
  subject: string;
  createdAt: string;
  messageId: string;
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  rawUrl: string | null;
  rawUrlExpiresAt: string | null;
  attachments: ReceivingAttachment[];
}

/** Fetch the full inbound message (HTML/text/headers/attachments) by id. */
export async function getReceivingEmail(id: string): Promise<ReceivingEmail> {
  const client = requireClient();
  const { data, error } = await client.emails.receiving.get(id);
  if (error) throw new Error(`Resend receiving.get: ${error.message}`);
  if (!data) throw new Error("Resend receiving.get: empty response");
  return {
    id: data.id,
    to: data.to ?? [],
    from: data.from,
    cc: data.cc ?? [],
    bcc: data.bcc ?? [],
    replyTo: data.reply_to ?? [],
    subject: data.subject ?? "",
    createdAt: data.created_at,
    messageId: data.message_id,
    html: data.html ?? null,
    text: data.text ?? null,
    headers: data.headers ?? null,
    rawUrl: data.raw?.download_url ?? null,
    rawUrlExpiresAt: data.raw?.expires_at ?? null,
    attachments: (data.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      contentType: a.content_type,
      contentId: a.content_id,
      contentDisposition: a.content_disposition,
    })),
  };
}

export interface SignedAttachment {
  id: string;
  filename: string | null;
  size: number;
  contentType: string;
  contentDisposition: "inline" | "attachment";
  contentId: string | null;
  downloadUrl: string;
  expiresAt: string;
}

/** Get a fresh signed download URL for one inbound attachment. */
export async function getReceivingAttachment(
  emailId: string,
  attachmentId: string
): Promise<SignedAttachment> {
  const client = requireClient();
  const { data, error } = await client.emails.receiving.attachments.get({
    emailId,
    id: attachmentId,
  });
  if (error) throw new Error(`Resend attachment.get: ${error.message}`);
  if (!data) throw new Error("Resend attachment.get: empty response");
  return {
    id: data.id,
    filename: data.filename ?? null,
    size: data.size,
    contentType: data.content_type,
    contentDisposition: data.content_disposition,
    contentId: data.content_id ?? null,
    downloadUrl: data.download_url,
    expiresAt: data.expires_at,
  };
}

/**
 * Forward an inbound email to another address, preserving original content +
 * attachments (passthrough mode).
 */
export async function forwardReceivingEmail(input: {
  emailId: string;
  to: string | string[];
  from: string;
}): Promise<{ id: string }> {
  const client = requireClient();
  const { data, error } = await client.emails.receiving.forward({
    emailId: input.emailId,
    to: input.to,
    from: input.from,
    passthrough: true,
  });
  if (error) throw new Error(`Resend forward: ${error.message}`);
  if (!data?.id) throw new Error("Resend forward: no id returned");
  return { id: data.id };
}

// -----------------------------------------------------------------------------
// Webhook verification
// -----------------------------------------------------------------------------

export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

/**
 * Verify a Resend webhook signature and return the typed payload.
 * Throws if the signature is invalid or the secret is missing.
 */
export function verifyWebhook(rawBody: string, headers: SvixHeaders): WebhookEventPayload {
  const secret = getWebhookSecret();
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not set; cannot verify webhook.");
  }
  const client = requireClient();
  return client.webhooks.verify({
    payload: rawBody,
    headers,
    webhookSecret: secret,
  });
}
