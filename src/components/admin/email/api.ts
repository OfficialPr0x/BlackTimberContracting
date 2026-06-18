"use client";

/**
 * Thin typed fetch helpers for the Inbox UI. All hit /api/admin/email/* which
 * is admin-session gated (cookie sent automatically).
 */

import type {
  EmailCategory,
  EmailFolder,
  FolderCounts,
  Mailbox,
  MessageDetail,
  MessageListItem,
  ThreadSummary,
} from "@/lib/email/types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new Error(msg);
  }
  return data as T;
}

export interface MailboxListResponse {
  mailboxes: Mailbox[];
  counts: Record<string, FolderCounts>;
}

export async function fetchMailboxes(): Promise<MailboxListResponse> {
  return jsonOrThrow(await fetch("/api/admin/email/mailboxes", { cache: "no-store" }));
}

export async function generateSignature(input: {
  displayName: string;
  address: string;
  role?: string;
  kind?: "personal" | "shared";
  tone?: "professional" | "warm" | "minimal";
}): Promise<{ signatureHtml: string }> {
  return jsonOrThrow(
    await fetch("/api/admin/email/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function createMailbox(input: {
  address: string;
  displayName: string;
  kind: "shared" | "personal";
  signatureHtml?: string;
}): Promise<{ mailbox: Mailbox }> {
  return jsonOrThrow(
    await fetch("/api/admin/email/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export interface MessagesResponse {
  messages: MessageListItem[];
  counts: FolderCounts;
}

export async function fetchMessages(params: {
  mailboxId: string;
  folder: EmailFolder | "starred";
  category?: EmailCategory;
  search?: string;
}): Promise<MessagesResponse> {
  const q = new URLSearchParams({ mailboxId: params.mailboxId, folder: params.folder });
  if (params.category) q.set("category", params.category);
  if (params.search) q.set("search", params.search);
  return jsonOrThrow(
    await fetch(`/api/admin/email/messages?${q.toString()}`, { cache: "no-store" })
  );
}

export interface ThreadResponse {
  thread: ThreadSummary | null;
  messages: MessageDetail[];
}

export async function fetchThread(messageId: string, markRead = true): Promise<ThreadResponse> {
  const q = markRead ? "?markRead=1" : "";
  return jsonOrThrow(
    await fetch(`/api/admin/email/messages/${messageId}${q}`, { cache: "no-store" })
  );
}

export async function patchMessage(
  messageId: string,
  patch: {
    unread?: boolean;
    starred?: boolean;
    folder?: EmailFolder;
    category?: EmailCategory;
    scope?: "message" | "thread";
  }
): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/admin/email/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export interface SendInput {
  mailboxId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  inReplyToMessageId?: string;
  forwardMessageId?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}

export async function sendMessage(input: SendInput): Promise<{ messageId: string; resendId: string }> {
  return jsonOrThrow(
    await fetch("/api/admin/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}
