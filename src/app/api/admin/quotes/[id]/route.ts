/**
 * GET /api/admin/quotes/[id] — load one saved document (for PDF view fallback).
 */

import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { deleteVaultArchivesForDocument } from "@/lib/admin/files/sync-documents-vault";
import { deleteQuote, loadQuote } from "@/lib/admin/quotes";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const quote = await loadQuote(id);
    if (!quote) {
      return Response.json({ error: { message: "Document not found." } }, { status: 404 });
    }
    return Response.json(quote);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    if (!/^[QEI]-\d{8}-[A-Z0-9]{4}$/.test(id)) {
      return Response.json({ error: { message: "Invalid document ID." } }, { status: 400 });
    }

    await deleteQuote(id);

    let vaultRemoved = 0;
    try {
      vaultRemoved = await deleteVaultArchivesForDocument(id);
    } catch (err) {
      console.warn("[delete document] vault cleanup failed", err);
    }

    return Response.json({ ok: true, id, vaultRemoved });
  } catch (err) {
    return errorResponse(err);
  }
}
