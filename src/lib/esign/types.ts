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

/** Available typed-signature script fonts the signer can choose from. */
export type EsignSignatureFont = "dancing" | "greatvibes" | "sacramento" | "caveat";

/**
 * Structured, typed signature capture (enterprise e-sign, no drawing).
 * This is the legal record of who signed + what they attested to.
 */
export interface EsignSignatureFields {
  /** Full legal name the signer typed. */
  legalName: string;
  /** Text rendered as the signature (defaults to legalName). */
  signatureText: string;
  /** Script font chosen for the rendered signature. */
  signatureFont: EsignSignatureFont;
  /** Optional role/title, e.g. "Owner", "Project Manager". */
  title?: string;
  /** Optional company/organization the signer represents. */
  company?: string;
  /** Optional mailing address (required when require_address is set). */
  address?: string;
  /** Date the signer attests to (YYYY-MM-DD). */
  dateSigned: string;
  /** Exact consent language the signer accepted. */
  consentText: string;
}

export interface EsignEnvelopeRow {
  id: string;
  title: string;
  status: EsignStatus;
  sourceType: string | null;
  sourceRef: string | null;
  /** Branded public signing link id (bt-…). */
  slug: string | null;
  /** Human reference (BT-YYYY-XXXXX). */
  documentNumber: string | null;
  signerName: string;
  signerEmail: string;
  signerMessage: string | null;
  documentSnapshot: EsignDocumentSnapshot;
  requireAddress: boolean;
  signatureFields: EsignSignatureFields | null;
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
  requireAddress?: boolean;
  expiresInDays?: number;
  sendNow?: boolean;
}
