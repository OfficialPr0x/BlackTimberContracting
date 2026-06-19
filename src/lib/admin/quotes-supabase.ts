/**
 * Quote persistence via Supabase (production on Vercel).
 * Requires schema.sql applied and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import "server-only";
import { AiError } from "@/lib/openrouter/errors";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sanitizeDocumentForRpc } from "./sanitize-document";
import type { AdminDocumentType, AdminQuoteSaved } from "./schemas";

function supabaseHint(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("does not exist") || m.includes("could not find the function")) {
    return " Run the full supabase/schema.sql file in Supabase → SQL Editor.";
  }
  if (m.includes("permission denied") || m.includes("not authorized")) {
    return " Use SUPABASE_SECRET_KEY (sb_secret_…), not the publishable key.";
  }
  if (m.includes("invalid input value for enum")) {
    return " Schema may be out of date — re-run supabase/schema.sql.";
  }
  if (m.includes("invalid input syntax for type numeric")) {
    return " A numeric field was invalid — try saving again after this deploy.";
  }
  return "";
}

function supabaseError(
  context: string,
  err: { message?: string; code?: string; hint?: string } | null
): never {
  const detail = err?.message ?? "unknown";
  throw new AiError({
    code: "internal",
    status: 500,
    clientMessage: `Database ${context} failed: ${detail}${supabaseHint(detail)}`,
    message: `${context} [${err?.code ?? "—"}]: ${detail}${err?.hint ? ` (${err.hint})` : ""}`,
    cause: err,
  });
}

/** Persist via upsert_document RPC (matches AdminQuoteSaved JSON shape). */
export async function saveQuoteSupabase(record: AdminQuoteSaved): Promise<AdminQuoteSaved> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new AiError({
      code: "internal",
      status: 503,
      clientMessage:
        "Database not configured. Add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel — not the publishable key.",
      message: "Supabase client unavailable",
    });
  }

  const payload = sanitizeDocumentForRpc(record);
  const { error } = await sb.rpc("upsert_document", {
    p_document: payload,
    p_lines: payload.lines,
  });

  if (error) supabaseError("upsert_document", error);
  return record;
}

export async function loadQuoteSupabase(id: string): Promise<AdminQuoteSaved | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb.rpc("get_document", { p_id: id });
  if (error) {
    console.error("[get_document]", error.message);
    return null;
  }
  if (!data) return null;

  return data as AdminQuoteSaved;
}

/** List recent documents for the admin sidebar. */
export async function listQuotesSupabase(limit = 50): Promise<AdminQuoteSaved[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb.rpc("list_documents", { p_limit: limit });
  if (error) {
    console.error("[list_documents]", error.message);
    return [];
  }

  const raw = data ?? [];
  const rows = (Array.isArray(raw) ? raw : []) as Array<{
    id: string;
    documentType?: AdminDocumentType;
    customerName: string;
    grandTotalCAD: number;
    updatedAt: string;
    status: string;
  }>;

  // Sidebar only needs summary fields; fill a minimal AdminQuoteSaved shell.
  return rows.map((row) => ({
    id: row.id,
    documentType:
      row.documentType ??
      (row.id.startsWith("I-") ? "invoice" : row.id.startsWith("E-") ? "estimate" : "quote"),
    status: row.status as AdminQuoteSaved["status"],
    customer: { name: row.customerName },
    project: { type: "other", scopeSummary: "—" },
    lines: [],
    taxMode: "real_property_install",
    freightCAD: 0,
    validUntil: new Date().toISOString().slice(0, 10),
    totals: {
      subtotalCAD: row.grandTotalCAD,
      freightCAD: 0,
      gstCAD: 0,
      pstCAD: 0,
      grandTotalCAD: row.grandTotalCAD,
      maxLeadTimeDays: 0,
    },
    createdAt: row.updatedAt,
    updatedAt: row.updatedAt,
    createdBy: "admin",
  }));
}

/** Permanently delete a document and its lines/revisions (cascade). */
export async function deleteQuoteSupabase(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;

  const { error } = await sb.from("documents").delete().eq("id", id);
  if (error) {
    console.error("[delete document]", error.message);
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: `Could not delete document: ${error.message}`,
      message: error.message,
    });
  }
  return true;
}
