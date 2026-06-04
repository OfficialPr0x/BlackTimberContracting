/**
 * Quote persistence via Supabase (production on Vercel).
 * Requires schema.sql applied and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import "server-only";
import { AiError } from "@/lib/openrouter/errors";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AdminQuoteSaved } from "./schemas";

function supabaseError(context: string, err: { message?: string } | null): never {
  throw new AiError({
    code: "internal",
    status: 500,
    clientMessage:
      "Could not save to the database. Check Supabase env vars on Vercel and that you ran supabase/schema.sql.",
    message: `${context}: ${err?.message ?? "unknown"}`,
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

  const { error } = await sb.rpc("upsert_document", {
    p_document: record,
    p_lines: record.lines,
  });

  if (error) supabaseError("upsert_document", error);
  return record;
}

export async function loadQuoteSupabase(id: string): Promise<AdminQuoteSaved | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb.rpc("get_document", { p_id: id });
  if (error) supabaseError("get_document", error);
  if (!data) return null;

  return data as AdminQuoteSaved;
}

/** List recent documents for the admin sidebar. */
export async function listQuotesSupabase(limit = 50): Promise<AdminQuoteSaved[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb.rpc("list_documents", { p_limit: limit });
  if (error) supabaseError("list_documents", error);

  const rows = (data ?? []) as Array<{
    id: string;
    customerName: string;
    grandTotalCAD: number;
    updatedAt: string;
    status: string;
  }>;

  // Sidebar only needs summary fields; fill a minimal AdminQuoteSaved shell.
  return rows.map((row) => ({
    id: row.id,
    documentType: row.id.startsWith("I-")
      ? "invoice"
      : row.id.startsWith("E-")
      ? "estimate"
      : "quote",
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
