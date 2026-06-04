/**
 * GET /api/admin/storage-check — diagnose Supabase save issues (admin only).
 */

import { requireAdminRoute } from "@/lib/admin/session";
import { getSupabaseAdmin, getSupabaseConfigStatus } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminRoute();
  if (!auth.ok) return auth.response;

  const config = getSupabaseConfigStatus();
  if (!config.ok) {
    return Response.json({
      ok: false,
      step: "env",
      message: `Missing: ${config.missing.join(", ")}`,
    });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return Response.json({
      ok: false,
      step: "client",
      message: "Supabase client could not be created.",
    });
  }

  const { error: listError } = await sb.rpc("list_documents", { p_limit: 1 });
  if (listError) {
    return Response.json({
      ok: false,
      step: "list_documents",
      code: listError.code,
      message: listError.message,
      hint: listError.hint,
    });
  }

  const testId = "Q-20990101-TEST";
  const testDoc = {
    id: testId,
    documentType: "quote",
    status: "draft",
    customer: { name: "Storage Check" },
    project: { type: "other", scopeSummary: "Diagnostic ping from /api/admin/storage-check" },
    lines: [
      {
        id: `${testId}-L1`,
        description: "Test line",
        quantity: 1,
        uom: "EA",
        unitPriceCAD: 1,
        source: "other",
      },
    ],
    taxMode: "real_property_install",
    freightCAD: 0,
    validUntil: "2099-01-01",
    totals: {
      subtotalCAD: 1,
      freightCAD: 0,
      gstCAD: 0.05,
      pstCAD: 0,
      grandTotalCAD: 1.05,
      maxLeadTimeDays: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "storage-check",
  };

  const { error: upsertError } = await sb.rpc("upsert_document", {
    p_document: testDoc,
    p_lines: testDoc.lines,
  });

  if (upsertError) {
    return Response.json({
      ok: false,
      step: "upsert_document",
      code: upsertError.code,
      message: upsertError.message,
      hint: upsertError.hint,
    });
  }

  await sb.from("documents").delete().eq("id", testId);

  return Response.json({
    ok: true,
    message: "Supabase is configured and upsert_document works.",
  });
}
