import "server-only";

import { AiError } from "@/lib/openrouter/errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { generateSignToken, hashSignToken } from "./tokens";
import type {
  CreateEsignInput,
  EsignDocumentSnapshot,
  EsignEnvelopeDetail,
  EsignEnvelopeRow,
  EsignEventRow,
  EsignEventType,
  EsignStatus,
} from "./types";
import { signPortalUrl } from "./site-url";

function requireSb() {
  if (!isSupabaseConfigured()) {
    throw new AiError({
      code: "internal",
      status: 503,
      clientMessage:
        "E-sign needs Supabase. Run supabase/esign-schema.sql and set SUPABASE_SECRET_KEY.",
      message: "Supabase not configured for esign",
    });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new AiError({
      code: "internal",
      status: 503,
      clientMessage: "Database unavailable.",
      message: "Supabase admin null",
    });
  }
  return sb;
}

function mapEnvelope(row: Record<string, unknown>): EsignEnvelopeRow {
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as EsignStatus,
    sourceType: (row.source_type as string) ?? null,
    sourceRef: (row.source_ref as string) ?? null,
    signerName: row.signer_name as string,
    signerEmail: row.signer_email as string,
    signerMessage: (row.signer_message as string) ?? null,
    documentSnapshot: row.document_snapshot as EsignDocumentSnapshot,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    viewedAt: row.viewed_at ? String(row.viewed_at) : null,
    signedAt: row.signed_at ? String(row.signed_at) : null,
    voidedAt: row.voided_at ? String(row.voided_at) : null,
    hasSignature: !!(row.signature_data_url as string | null),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Record<string, unknown>): EsignEventRow {
  return {
    id: row.id as string,
    envelopeId: row.envelope_id as string,
    eventType: row.event_type as EsignEventType,
    actor: row.actor as string,
    meta: (row.meta as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

export async function insertEsignEmailEvent(
  envelopeId: string,
  eventType: "email_sent" | "email_failed",
  meta: Record<string, unknown> = {}
): Promise<void> {
  return insertEvent(envelopeId, eventType, "system", meta);
}

async function insertEvent(
  envelopeId: string,
  eventType: EsignEventType,
  actor: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const sb = requireSb();
  const { error } = await sb.from("esign_events").insert({
    envelope_id: envelopeId,
    event_type: eventType,
    actor,
    meta,
  });
  if (error) console.error("[esign_events]", error.message);
}

export async function listEsignEnvelopes(limit = 60): Promise<EsignEnvelopeRow[]> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("esign_envelopes")
    .select(
      "id, title, status, source_type, source_ref, signer_name, signer_email, signer_message, document_snapshot, expires_at, sent_at, viewed_at, signed_at, voided_at, signature_data_url, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[list esign]", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapEnvelope(r as Record<string, unknown>));
}

export async function getEsignEnvelope(id: string): Promise<EsignEnvelopeDetail | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("esign_envelopes")
    .select(
      "id, title, status, source_type, source_ref, signer_name, signer_email, signer_message, document_snapshot, expires_at, sent_at, viewed_at, signed_at, voided_at, signature_data_url, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const { data: events } = await sb
    .from("esign_events")
    .select("id, envelope_id, event_type, actor, meta, created_at")
    .eq("envelope_id", id)
    .order("created_at", { ascending: true });

  return {
    ...mapEnvelope(data as Record<string, unknown>),
    events: (events ?? []).map((e) => mapEvent(e as Record<string, unknown>)),
  };
}

export async function createEsignEnvelope(
  input: CreateEsignInput
): Promise<{ envelope: EsignEnvelopeDetail; signToken: string }> {
  const sb = requireSb();
  const signToken = generateSignToken();
  const tokenHash = hashSignToken(signToken);
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86400_000).toISOString()
      : new Date(Date.now() + 30 * 86400_000).toISOString();

  const { data, error } = await sb
    .from("esign_envelopes")
    .insert({
      title: input.title.trim(),
      status: "draft",
      source_type: input.sourceType ?? null,
      source_ref: input.sourceRef ?? null,
      signer_name: input.signerName.trim(),
      signer_email: input.signerEmail.trim().toLowerCase(),
      signer_message: input.signerMessage?.trim() ?? null,
      document_snapshot: input.documentSnapshot,
      sign_token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not create signing envelope.",
      message: error?.message ?? "insert failed",
    });
  }

  const id = data.id as string;
  await insertEvent(id, "created", "admin", { sourceRef: input.sourceRef });

  const detail = await getEsignEnvelope(id);
  if (!detail) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Envelope created but could not load.",
    });
  }

  if (input.sendNow) {
    await sendEsignEnvelope(id, signToken);
    const refreshed = await getEsignEnvelope(id);
    return {
      envelope: { ...(refreshed ?? detail), signUrl: signPortalUrl(signToken) },
      signToken,
    };
  }

  return {
    envelope: { ...detail, signUrl: signPortalUrl(signToken) },
    signToken,
  };
}

export async function getEsignByToken(
  plainToken: string
): Promise<(EsignEnvelopeDetail & { plainToken: string }) | null> {
  const sb = requireSb();
  const hash = hashSignToken(plainToken);
  const { data, error } = await sb
    .from("esign_envelopes")
    .select(
      "id, title, status, source_type, source_ref, signer_name, signer_email, signer_message, document_snapshot, expires_at, sent_at, viewed_at, signed_at, voided_at, signature_data_url, created_at, updated_at"
    )
    .eq("sign_token_hash", hash)
    .maybeSingle();

  if (error || !data) return null;

  const row = mapEnvelope(data as Record<string, unknown>);
  if (row.status === "void") return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date() && row.status !== "signed") {
    await sb.from("esign_envelopes").update({ status: "expired" }).eq("id", row.id);
    return null;
  }

  const { data: events } = await sb
    .from("esign_events")
    .select("id, envelope_id, event_type, actor, meta, created_at")
    .eq("envelope_id", row.id)
    .order("created_at", { ascending: true });

  return {
    ...row,
    events: (events ?? []).map((e) => mapEvent(e as Record<string, unknown>)),
    plainToken,
  };
}

export async function markEsignViewed(
  envelopeId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<EsignEnvelopeRow | null> {
  const sb = requireSb();
  const now = new Date().toISOString();

  const { data: current } = await sb
    .from("esign_envelopes")
    .select("status, viewed_at")
    .eq("id", envelopeId)
    .single();

  if (!current || current.status === "signed" || current.status === "void") {
    return getEsignEnvelope(envelopeId).then((d) => d ?? null);
  }

  const nextStatus =
    current.status === "sent" || current.status === "draft" ? "viewed" : current.status;

  await sb
    .from("esign_envelopes")
    .update({
      status: nextStatus,
      viewed_at: current.viewed_at ?? now,
    })
    .eq("id", envelopeId);

  if (!current.viewed_at) {
    await insertEvent(envelopeId, "viewed", "signer", meta);
  }

  const detail = await getEsignEnvelope(envelopeId);
  return detail;
}

export async function completeEsignSignature(params: {
  plainToken: string;
  signatureDataUrl: string;
  consentAccepted: boolean;
  ip?: string;
  userAgent?: string;
}): Promise<EsignEnvelopeRow | null> {
  if (!params.consentAccepted) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "You must agree to sign electronically.",
    });
  }
  if (!params.signatureDataUrl.startsWith("data:image/png;base64,")) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "Invalid signature image.",
    });
  }
  if (params.signatureDataUrl.length > 500_000) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "Signature image too large.",
    });
  }

  const found = await getEsignByToken(params.plainToken);
  if (!found) return null;
  if (found.status === "signed") return found;
  if (found.status === "void" || found.status === "expired") return null;

  const sb = requireSb();
  const now = new Date().toISOString();

  const { error } = await sb
    .from("esign_envelopes")
    .update({
      status: "signed",
      signed_at: now,
      signature_data_url: params.signatureDataUrl,
      signer_ip: params.ip ?? null,
      signer_user_agent: params.userAgent?.slice(0, 500) ?? null,
      consent_accepted_at: now,
    })
    .eq("id", found.id);

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not save signature.",
      message: error.message,
    });
  }

  await insertEvent(found.id, "signed", "signer", {
    ip: params.ip,
  });

  return getEsignEnvelope(found.id);
}

export async function sendEsignEnvelope(
  envelopeId: string,
  knownPlainToken?: string
): Promise<EsignEnvelopeDetail> {
  const detail = await getEsignEnvelope(envelopeId);
  if (!detail) {
    throw new AiError({
      code: "invalid_input",
      status: 404,
      clientMessage: "Envelope not found.",
    });
  }
  if (detail.status === "signed" || detail.status === "void") {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: `Cannot send — document is ${detail.status}.`,
    });
  }

  const sb = requireSb();
  const now = new Date().toISOString();
  const nextStatus = detail.status === "draft" ? "sent" : detail.status;

  await sb
    .from("esign_envelopes")
    .update({
      status: nextStatus,
      sent_at: detail.sentAt ?? now,
    })
    .eq("id", envelopeId);

  await insertEvent(envelopeId, "sent", "admin", {});

  const refreshed = await getEsignEnvelope(envelopeId);
  if (!refreshed) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Send recorded but envelope could not reload.",
    });
  }

  if (knownPlainToken) {
    refreshed.signUrl = signPortalUrl(knownPlainToken);
  }

  return refreshed;
}

export async function voidEsignEnvelope(envelopeId: string): Promise<EsignEnvelopeRow | null> {
  const sb = requireSb();
  const now = new Date().toISOString();
  await sb
    .from("esign_envelopes")
    .update({ status: "void", voided_at: now })
    .eq("id", envelopeId);
  await insertEvent(envelopeId, "voided", "admin", {});
  return getEsignEnvelope(envelopeId);
}

/** Regenerate token only for draft envelopes (returns new plain token once). */
export async function rotateSignToken(envelopeId: string): Promise<string> {
  const signToken = generateSignToken();
  const sb = requireSb();
  const { error } = await sb
    .from("esign_envelopes")
    .update({ sign_token_hash: hashSignToken(signToken) })
    .eq("id", envelopeId)
    .in("status", ["draft", "sent", "viewed"]);

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not refresh sign link.",
      message: error.message,
    });
  }
  return signToken;
}
