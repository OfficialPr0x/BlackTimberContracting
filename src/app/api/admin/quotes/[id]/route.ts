/**
 * GET /api/admin/quotes/[id] — load one saved document (for PDF view fallback).
 */

import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { loadQuote } from "@/lib/admin/quotes";

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
