import type { AdminQuoteSaved } from "@/lib/admin/schemas";

export type EsignStatus = "draft" | "sent" | "viewed" | "signed" | "void" | "expired";

export type EsignEventType =
  | "created"
  | "sent"
  | "viewed"
  | "signed"
  | "voided"
  | "reminder"
  | "email_sent"
  | "email_failed";

export type EsignDocumentSnapshot =
  | { kind: "quote"; quote: AdminQuoteSaved }
  | { kind: "markdown"; title: string; content: string }
  | { kind: "html"; html: string };

export interface EsignEnvelopeRow {
  id: string;
  title: string;
  status: EsignStatus;
  sourceType: string | null;
  sourceRef: string | null;
  signerName: string;
  signerEmail: string;
  signerMessage: string | null;
  documentSnapshot: EsignDocumentSnapshot;
  expiresAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  voidedAt: string | null;
  hasSignature: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EsignEventRow {
  id: string;
  envelopeId: string;
  eventType: EsignEventType;
  actor: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface EsignEnvelopeDetail extends EsignEnvelopeRow {
  events: EsignEventRow[];
  /** Only returned once on create/send — never stored plain */
  signUrl?: string;
}

export interface CreateEsignInput {
  title: string;
  signerName: string;
  signerEmail: string;
  signerMessage?: string;
  documentSnapshot: EsignDocumentSnapshot;
  sourceType?: "quote" | "vault_file" | "custom";
  sourceRef?: string;
  expiresInDays?: number;
  sendNow?: boolean;
}
