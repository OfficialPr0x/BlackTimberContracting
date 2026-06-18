/**
 * Email repository — the only module that touches the email_* tables.
 *
 * Translates between snake_case rows and the camelCase types in ./types.
 * All access goes through the Supabase service-role client; callers must do
 * their own admin-session check first (see requireAdminRoute).
 */

import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { makeSnippet, normalizeSubject } from "./addresses";
import type {
  AttachmentMeta,
  ComposeInput,
  DeliverabilityEvent,
  EmailCategory,
  EmailDirection,
  EmailFolder,
  EmailStatus,
  FolderCounts,
  Mailbox,
  MailboxKind,
  MessageDetail,
  MessageListItem,
  ThreadDetail,
} from "./types";

class EmailRepoError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "EmailRepoError";
    this.status = status;
  }
}

function requireSb() {
  if (!isSupabaseConfigured()) {
    throw new EmailRepoError(
      "Email needs Supabase. Run supabase/email-inbox.sql and set SUPABASE_SECRET_KEY.",
      503
    );
  }
  const sb = getSupabaseAdmin();
  if (!sb) throw new EmailRepoError("Database unavailable.", 503);
  return sb;
}

export { EmailRepoError };

// -----------------------------------------------------------------------------
// Row mappers
// -----------------------------------------------------------------------------

type Row = Record<string, unknown>;

function s(v: unknown): string {
  return v == null ? "" : String(v);
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

function mapMailbox(row: Row): Mailbox {
  return {
    id: row.id as string,
    address: row.address as string,
    displayName: row.display_name as string,
    kind: row.kind as MailboxKind,
    ownerLabel: (row.owner_label as string) ?? null,
    description: (row.description as string) ?? null,
    signatureHtml: (row.signature_html as string) ?? null,
    active: !!row.active,
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at),
  };
}

function mapListItem(row: Row): MessageListItem {
  return {
    id: row.id as string,
    mailboxId: row.mailbox_id as string,
    threadId: (row.thread_id as string) ?? null,
    direction: row.direction as EmailDirection,
    folder: row.folder as EmailFolder,
    category: row.category as EmailCategory,
    status: row.status as EmailStatus,
    fromAddress: s(row.from_address),
    fromName: (row.from_name as string) ?? null,
    toAddresses: arr(row.to_addresses),
    subject: s(row.subject),
    snippet: s(row.snippet),
    hasAttachments: !!row.has_attachments,
    starred: !!row.starred,
    unread: !!row.unread,
    emailDate: s(row.email_date),
  };
}

function mapDetail(row: Row, attachments: AttachmentMeta[]): MessageDetail {
  return {
    ...mapListItem(row),
    ccAddresses: arr(row.cc_addresses),
    bccAddresses: arr(row.bcc_addresses),
    replyTo: (row.reply_to as string) ?? null,
    rfcMessageId: (row.rfc_message_id as string) ?? null,
    inReplyTo: (row.in_reply_to as string) ?? null,
    refIds: arr(row.ref_ids),
    resendId: (row.resend_id as string) ?? null,
    bodyHtml: (row.body_html as string) ?? null,
    bodyText: (row.body_text as string) ?? null,
    tags: (row.tags as Record<string, string>) ?? {},
    attachments,
  };
}

function mapAttachment(row: Row): AttachmentMeta {
  return {
    id: row.id as string,
    resendAttachmentId: (row.resend_attachment_id as string) ?? null,
    filename: (row.filename as string) ?? null,
    contentType: s(row.content_type) || "application/octet-stream",
    sizeBytes: Number(row.size_bytes ?? 0),
    contentId: (row.content_id as string) ?? null,
    contentDisposition: s(row.content_disposition) || "attachment",
    storagePath: (row.storage_path as string) ?? null,
    stored: !!row.storage_path,
  };
}

// -----------------------------------------------------------------------------
// Mailboxes
// -----------------------------------------------------------------------------

export async function listMailboxes(includeInactive = false): Promise<Mailbox[]> {
  const sb = requireSb();
  let q = sb.from("email_mailboxes").select("*").order("kind").order("address");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new EmailRepoError(error.message);
  return (data ?? []).map(mapMailbox);
}

export async function getMailbox(id: string): Promise<Mailbox | null> {
  const sb = requireSb();
  const { data, error } = await sb.from("email_mailboxes").select("*").eq("id", id).maybeSingle();
  if (error) throw new EmailRepoError(error.message);
  return data ? mapMailbox(data) : null;
}

export async function getMailboxByAddress(address: string): Promise<Mailbox | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_mailboxes")
    .select("*")
    .eq("address", address.toLowerCase())
    .maybeSingle();
  if (error) throw new EmailRepoError(error.message);
  return data ? mapMailbox(data) : null;
}

export async function createMailbox(input: {
  address: string;
  displayName: string;
  kind?: MailboxKind;
  ownerLabel?: string | null;
  description?: string | null;
  signatureHtml?: string | null;
}): Promise<Mailbox> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_mailboxes")
    .insert({
      address: input.address.toLowerCase().trim(),
      display_name: input.displayName.trim(),
      kind: input.kind ?? "personal",
      owner_label: input.ownerLabel ?? null,
      description: input.description ?? null,
      signature_html: input.signatureHtml ?? null,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new EmailRepoError("That address already exists.", 409);
    throw new EmailRepoError(error.message);
  }
  return mapMailbox(data);
}

export async function updateMailbox(
  id: string,
  patch: Partial<{
    displayName: string;
    kind: MailboxKind;
    ownerLabel: string | null;
    description: string | null;
    signatureHtml: string | null;
    active: boolean;
  }>
): Promise<Mailbox> {
  const sb = requireSb();
  const row: Row = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.ownerLabel !== undefined) row.owner_label = patch.ownerLabel;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.signatureHtml !== undefined) row.signature_html = patch.signatureHtml;
  if (patch.active !== undefined) row.active = patch.active;
  const { data, error } = await sb
    .from("email_mailboxes")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new EmailRepoError(error.message);
  return mapMailbox(data);
}

// -----------------------------------------------------------------------------
// Listing / reading messages
// -----------------------------------------------------------------------------

export interface ListMessagesOptions {
  mailboxId: string;
  folder: EmailFolder;
  category?: EmailCategory;
  search?: string;
  starredOnly?: boolean;
  limit?: number;
  beforeDate?: string;
}

export async function listMessages(opts: ListMessagesOptions): Promise<MessageListItem[]> {
  const sb = requireSb();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let q = sb
    .from("email_messages")
    .select(
      "id,mailbox_id,thread_id,direction,folder,category,status,from_address,from_name,to_addresses,subject,snippet,has_attachments,starred,unread,email_date"
    )
    .eq("mailbox_id", opts.mailboxId)
    .eq("folder", opts.folder)
    .order("email_date", { ascending: false })
    .limit(limit);

  if (opts.category) q = q.eq("category", opts.category);
  if (opts.starredOnly) q = q.eq("starred", true);
  if (opts.beforeDate) q = q.lt("email_date", opts.beforeDate);
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim().replace(/[%_]/g, "\\$&")}%`;
    q = q.or(
      `subject.ilike.${term},snippet.ilike.${term},from_address.ilike.${term}`
    );
  }

  const { data, error } = await q;
  if (error) throw new EmailRepoError(error.message);
  return (data ?? []).map(mapListItem);
}

/** Starred messages across all folders except trash. */
export async function listStarred(mailboxId: string, limit = 100): Promise<MessageListItem[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_messages")
    .select(
      "id,mailbox_id,thread_id,direction,folder,category,status,from_address,from_name,to_addresses,subject,snippet,has_attachments,starred,unread,email_date"
    )
    .eq("mailbox_id", mailboxId)
    .eq("starred", true)
    .neq("folder", "trash")
    .order("email_date", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw new EmailRepoError(error.message);
  return (data ?? []).map(mapListItem);
}

async function loadAttachments(messageIds: string[]): Promise<Map<string, AttachmentMeta[]>> {
  const map = new Map<string, AttachmentMeta[]>();
  if (messageIds.length === 0) return map;
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_attachments")
    .select("*")
    .in("message_id", messageIds);
  if (error) throw new EmailRepoError(error.message);
  for (const row of data ?? []) {
    const mid = row.message_id as string;
    const list = map.get(mid) ?? [];
    list.push(mapAttachment(row));
    map.set(mid, list);
  }
  return map;
}

export async function getMessage(id: string): Promise<MessageDetail | null> {
  const sb = requireSb();
  const { data, error } = await sb.from("email_messages").select("*").eq("id", id).maybeSingle();
  if (error) throw new EmailRepoError(error.message);
  if (!data) return null;
  const att = await loadAttachments([id]);
  return mapDetail(data, att.get(id) ?? []);
}

/** Full thread (chronological) for the message's thread, plus the thread row. */
export async function getThread(threadId: string): Promise<ThreadDetail | null> {
  const sb = requireSb();
  const [{ data: threadRow, error: tErr }, { data: msgRows, error: mErr }] = await Promise.all([
    sb.from("email_threads").select("*").eq("id", threadId).maybeSingle(),
    sb
      .from("email_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("email_date", { ascending: true }),
  ]);
  if (tErr) throw new EmailRepoError(tErr.message);
  if (mErr) throw new EmailRepoError(mErr.message);
  if (!threadRow) return null;

  const ids = (msgRows ?? []).map((r) => r.id as string);
  const att = await loadAttachments(ids);
  return {
    thread: {
      id: threadRow.id as string,
      mailboxId: threadRow.mailbox_id as string,
      subject: s(threadRow.subject),
      snippet: s(threadRow.snippet),
      lastMessageAt: s(threadRow.last_message_at),
      messageCount: Number(threadRow.message_count ?? 0),
      unreadCount: Number(threadRow.unread_count ?? 0),
      hasAttachments: !!threadRow.has_attachments,
    },
    messages: (msgRows ?? []).map((r) => mapDetail(r, att.get(r.id as string) ?? [])),
  };
}

export async function folderCounts(mailboxId: string): Promise<FolderCounts> {
  const sb = requireSb();
  const { data, error } = await sb.rpc("email_folder_counts", { p_mailbox_id: mailboxId });
  if (error) throw new EmailRepoError(error.message);
  return (data ?? {}) as FolderCounts;
}

export async function getDeliverabilityEvents(messageId: string): Promise<DeliverabilityEvent[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_events")
    .select("id,event_type,occurred_at,payload")
    .eq("message_id", messageId)
    .order("occurred_at", { ascending: true });
  if (error) throw new EmailRepoError(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    eventType: s(r.event_type),
    occurredAt: s(r.occurred_at),
    payload: (r.payload as Record<string, unknown>) ?? {},
  }));
}

// -----------------------------------------------------------------------------
// Mutations: read / star / move / trash
// -----------------------------------------------------------------------------

export async function setUnread(messageId: string, unread: boolean): Promise<void> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_messages")
    .update({ unread })
    .eq("id", messageId)
    .select("thread_id")
    .single();
  if (error) throw new EmailRepoError(error.message);
  await recalcThread(data?.thread_id as string | null);
}

export async function setStarred(messageId: string, starred: boolean): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("email_messages").update({ starred }).eq("id", messageId);
  if (error) throw new EmailRepoError(error.message);
}

export async function moveToFolder(messageId: string, folder: EmailFolder): Promise<void> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_messages")
    .update({ folder })
    .eq("id", messageId)
    .select("thread_id")
    .single();
  if (error) throw new EmailRepoError(error.message);
  await recalcThread(data?.thread_id as string | null);
}

export async function setCategory(messageId: string, category: EmailCategory): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("email_messages").update({ category }).eq("id", messageId);
  if (error) throw new EmailRepoError(error.message);
}

/** Mark every message in a thread read/unread. */
export async function setThreadUnread(threadId: string, unread: boolean): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("email_messages").update({ unread }).eq("thread_id", threadId);
  if (error) throw new EmailRepoError(error.message);
  await recalcThread(threadId);
}

async function recalcThread(threadId: string | null): Promise<void> {
  if (!threadId) return;
  const sb = requireSb();
  const { error } = await sb.rpc("email_recalc_thread", { p_thread_id: threadId });
  if (error) throw new EmailRepoError(error.message);
}

// -----------------------------------------------------------------------------
// Thread resolution
// -----------------------------------------------------------------------------

interface ResolveThreadInput {
  mailboxId: string;
  subject: string;
  inReplyTo: string | null;
  refIds: string[];
}

async function resolveThreadId(input: ResolveThreadInput): Promise<string> {
  const sb = requireSb();

  // 1) Match by RFC Message-ID chain (most reliable).
  const candidateIds = [input.inReplyTo, ...input.refIds].filter(Boolean) as string[];
  if (candidateIds.length > 0) {
    const { data, error } = await sb
      .from("email_messages")
      .select("thread_id")
      .eq("mailbox_id", input.mailboxId)
      .in("rfc_message_id", candidateIds)
      .not("thread_id", "is", null)
      .limit(1);
    if (error) throw new EmailRepoError(error.message);
    if (data && data[0]?.thread_id) return data[0].thread_id as string;
  }

  // 2) Match by normalized subject within the same mailbox (recent threads).
  const subjNorm = normalizeSubject(input.subject);
  if (subjNorm) {
    const { data, error } = await sb
      .from("email_threads")
      .select("id")
      .eq("mailbox_id", input.mailboxId)
      .eq("subject_norm", subjNorm)
      .order("last_message_at", { ascending: false })
      .limit(1);
    if (error) throw new EmailRepoError(error.message);
    if (data && data[0]?.id) return data[0].id as string;
  }

  // 3) Create a new thread.
  const { data, error } = await sb
    .from("email_threads")
    .insert({
      mailbox_id: input.mailboxId,
      subject: input.subject,
      subject_norm: subjNorm,
    })
    .select("id")
    .single();
  if (error) throw new EmailRepoError(error.message);
  return data.id as string;
}

// -----------------------------------------------------------------------------
// Ingestion: inbound + outbound
// -----------------------------------------------------------------------------

export interface SaveInboundInput {
  mailboxId: string;
  resendId: string;
  rfcMessageId: string;
  inReplyTo: string | null;
  refIds: string[];
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  replyTo: string | null;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  category: EmailCategory;
  folder: EmailFolder;
  emailDate: string;
  rawUrl: string | null;
  rawUrlExpiresAt: string | null;
  attachments: {
    resendAttachmentId: string;
    filename: string | null;
    contentType: string;
    sizeBytes: number;
    contentId: string | null;
    contentDisposition: string | null;
  }[];
}

/** Returns the new message id, or the existing id if already ingested. */
export async function saveInboundMessage(input: SaveInboundInput): Promise<string> {
  const sb = requireSb();

  // Idempotency: same Resend inbound id already stored?
  const { data: existing } = await sb
    .from("email_messages")
    .select("id")
    .eq("resend_id", input.resendId)
    .eq("direction", "inbound")
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const threadId = await resolveThreadId({
    mailboxId: input.mailboxId,
    subject: input.subject,
    inReplyTo: input.inReplyTo,
    refIds: input.refIds,
  });

  const { data, error } = await sb
    .from("email_messages")
    .insert({
      mailbox_id: input.mailboxId,
      thread_id: threadId,
      direction: "inbound",
      folder: input.folder,
      category: input.category,
      status: "received",
      resend_id: input.resendId,
      rfc_message_id: input.rfcMessageId,
      in_reply_to: input.inReplyTo,
      ref_ids: input.refIds,
      from_address: input.fromAddress,
      from_name: input.fromName,
      to_addresses: input.toAddresses,
      cc_addresses: input.ccAddresses,
      bcc_addresses: input.bccAddresses,
      reply_to: input.replyTo,
      subject: input.subject,
      snippet: makeSnippet(input.bodyHtml, input.bodyText),
      body_html: input.bodyHtml,
      body_text: input.bodyText,
      has_attachments: input.attachments.length > 0,
      unread: true,
      raw_url: input.rawUrl,
      raw_url_expires_at: input.rawUrlExpiresAt,
      email_date: input.emailDate,
    })
    .select("id")
    .single();
  if (error) throw new EmailRepoError(error.message);
  const messageId = data.id as string;

  if (input.attachments.length > 0) {
    const rows = input.attachments.map((a) => ({
      message_id: messageId,
      resend_attachment_id: a.resendAttachmentId,
      filename: a.filename,
      content_type: a.contentType,
      size_bytes: a.sizeBytes,
      content_id: a.contentId,
      content_disposition: a.contentDisposition ?? "attachment",
    }));
    const { error: attErr } = await sb.from("email_attachments").insert(rows);
    if (attErr) throw new EmailRepoError(attErr.message);
  }

  await recalcThread(threadId);
  return messageId;
}

export interface SaveOutboundInput {
  mailboxId: string;
  resendId: string;
  rfcMessageId: string | null;
  inReplyTo: string | null;
  refIds: string[];
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  replyTo: string | null;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  tags: Record<string, string>;
  hasAttachments: boolean;
}

export async function saveOutboundMessage(input: SaveOutboundInput): Promise<string> {
  const sb = requireSb();
  const threadId = await resolveThreadId({
    mailboxId: input.mailboxId,
    subject: input.subject,
    inReplyTo: input.inReplyTo,
    refIds: input.refIds,
  });

  const { data, error } = await sb
    .from("email_messages")
    .insert({
      mailbox_id: input.mailboxId,
      thread_id: threadId,
      direction: "outbound",
      folder: "sent",
      category: "primary",
      status: "sent",
      resend_id: input.resendId,
      rfc_message_id: input.rfcMessageId,
      in_reply_to: input.inReplyTo,
      ref_ids: input.refIds,
      from_address: input.fromAddress,
      from_name: input.fromName,
      to_addresses: input.toAddresses,
      cc_addresses: input.ccAddresses,
      bcc_addresses: input.bccAddresses,
      reply_to: input.replyTo,
      subject: input.subject,
      snippet: makeSnippet(input.bodyHtml, input.bodyText),
      body_html: input.bodyHtml,
      body_text: input.bodyText,
      has_attachments: input.hasAttachments,
      unread: false,
      tags: input.tags,
      email_date: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new EmailRepoError(error.message);
  await recalcThread(threadId);
  return data.id as string;
}

// -----------------------------------------------------------------------------
// Webhook helpers
// -----------------------------------------------------------------------------

/** Returns true if this svix-id is new (insert succeeded); false if duplicate. */
export async function markWebhookSeen(svixId: string, eventType: string): Promise<boolean> {
  const sb = requireSb();
  const { error } = await sb
    .from("email_webhook_events")
    .insert({ svix_id: svixId, event_type: eventType });
  if (error) {
    if (error.code === "23505") return false; // duplicate delivery
    throw new EmailRepoError(error.message);
  }
  return true;
}

const STATUS_FROM_EVENT: Record<string, EmailStatus> = {
  "email.sent": "sent",
  "email.scheduled": "scheduled",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

// Higher = more advanced in lifecycle; never regress status on out-of-order events.
const STATUS_RANK: Record<string, number> = {
  draft: 0,
  queued: 1,
  scheduled: 1,
  sent: 2,
  delivery_delayed: 3,
  delivered: 4,
  opened: 5,
  clicked: 6,
  received: 2,
  bounced: 7,
  complained: 7,
  failed: 7,
  suppressed: 7,
  canceled: 7,
};

/**
 * Record a deliverability event for an outbound message identified by its
 * Resend email id. Updates message status (monotonically) + appends to
 * email_events. Returns the affected message id (or null if unknown).
 */
export async function recordDeliverabilityEvent(input: {
  resendEmailId: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}): Promise<{ messageId: string | null; mailboxId: string | null }> {
  const sb = requireSb();
  const { data: msg } = await sb
    .from("email_messages")
    .select("id,status,mailbox_id")
    .eq("resend_id", input.resendEmailId)
    .eq("direction", "outbound")
    .maybeSingle();

  const messageId = (msg?.id as string) ?? null;

  await sb.from("email_events").insert({
    message_id: messageId,
    resend_email_id: input.resendEmailId,
    event_type: input.eventType,
    payload: input.payload,
    occurred_at: input.occurredAt,
  });

  const nextStatus = STATUS_FROM_EVENT[input.eventType];
  if (messageId && nextStatus) {
    const current = (msg?.status as string) ?? "sent";
    if ((STATUS_RANK[nextStatus] ?? 0) >= (STATUS_RANK[current] ?? 0)) {
      await sb.from("email_messages").update({ status: nextStatus }).eq("id", messageId);
    }
  }

  return { messageId, mailboxId: (msg?.mailbox_id as string) ?? null };
}

// -----------------------------------------------------------------------------
// Attachments storage pointers
// -----------------------------------------------------------------------------

export async function getAttachment(id: string): Promise<
  (AttachmentMeta & { messageId: string; resendEmailId: string | null }) | null
> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("email_attachments")
    .select("*, email_messages!inner(resend_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new EmailRepoError(error.message);
  if (!data) return null;
  const joined = data.email_messages as { resend_id?: string } | null;
  return {
    ...mapAttachment(data),
    messageId: data.message_id as string,
    resendEmailId: joined?.resend_id ?? null,
  };
}

export async function setAttachmentStoragePath(id: string, storagePath: string): Promise<void> {
  const sb = requireSb();
  const { error } = await sb
    .from("email_attachments")
    .update({ storage_path: storagePath })
    .eq("id", id);
  if (error) throw new EmailRepoError(error.message);
}

// Re-export for routes that compose then persist.
export type { ComposeInput };
