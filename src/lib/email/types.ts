/**
 * Shared types for the custom email client.
 *
 * camelCase TS shapes that map 1:1 onto the snake_case columns in
 * supabase/email-inbox.sql. The repository layer is the only place that
 * translates between the two.
 */

export type EmailDirection = "inbound" | "outbound";

export type EmailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "archive"
  | "spam"
  | "trash";

export type EmailCategory =
  | "primary"
  | "promotions"
  | "social"
  | "updates"
  | "forums";

export type EmailStatus =
  | "received"
  | "draft"
  | "queued"
  | "scheduled"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed"
  | "canceled";

export type MailboxKind = "shared" | "personal";

export const EMAIL_FOLDERS: EmailFolder[] = [
  "inbox",
  "sent",
  "drafts",
  "archive",
  "spam",
  "trash",
];

export interface Mailbox {
  id: string;
  address: string;
  displayName: string;
  kind: MailboxKind;
  ownerLabel: string | null;
  description: string | null;
  signatureHtml: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FolderCount {
  total: number;
  unread: number;
}

/** folder name -> counts; only folders with rows appear. */
export type FolderCounts = Partial<Record<EmailFolder, FolderCount>>;

export interface AttachmentMeta {
  id: string;
  resendAttachmentId: string | null;
  filename: string | null;
  contentType: string;
  sizeBytes: number;
  contentId: string | null;
  contentDisposition: string;
  storagePath: string | null;
  /** True when a copy lives in Supabase Storage (download is always available). */
  stored: boolean;
}

/** Lightweight row for list views. */
export interface MessageListItem {
  id: string;
  mailboxId: string;
  threadId: string | null;
  direction: EmailDirection;
  folder: EmailFolder;
  category: EmailCategory;
  status: EmailStatus;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string;
  snippet: string;
  hasAttachments: boolean;
  starred: boolean;
  unread: boolean;
  emailDate: string;
}

/** Full message including body + attachments for the reading pane. */
export interface MessageDetail extends MessageListItem {
  ccAddresses: string[];
  bccAddresses: string[];
  replyTo: string | null;
  rfcMessageId: string | null;
  inReplyTo: string | null;
  refIds: string[];
  resendId: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  tags: Record<string, string>;
  attachments: AttachmentMeta[];
}

export interface ThreadSummary {
  id: string;
  mailboxId: string;
  subject: string;
  snippet: string;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
}

export interface ThreadDetail {
  thread: ThreadSummary;
  messages: MessageDetail[];
}

export interface DeliverabilityEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/** Payload for composing a new message / reply / forward. */
export interface ComposeInput {
  mailboxId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  /** When set, thread the reply against this message. */
  inReplyToMessageId?: string;
  /** When forwarding an inbound message via Resend's forward helper. */
  forwardMessageId?: string;
  attachments?: ComposeAttachment[];
  tags?: Record<string, string>;
}

export interface ComposeAttachment {
  filename: string;
  /** Base64-encoded content. */
  content: string;
  contentType?: string;
}
