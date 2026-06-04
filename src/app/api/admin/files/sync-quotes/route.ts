/**
 * POST /api/admin/files/sync-quotes
 * Copies all Q-/E-/I- documents into vault folder "Quotes & Invoices".
 */

import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { syncDocumentsToVault } from "@/lib/admin/files/sync-documents-vault";
import { listFileNodes } from "@/lib/admin/files/repository";
import { buildFileTree } from "@/lib/admin/files/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const sync = await syncDocumentsToVault();
    const flat = await listFileNodes();

    return Response.json({
      sync,
      nodes: flat,
      tree: buildFileTree(flat),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
