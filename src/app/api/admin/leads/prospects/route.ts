import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { listProspectLeads } from "@/lib/leads/prospects-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const prospects = await listProspectLeads(100);
    return Response.json({ prospects });
  } catch (err) {
    return errorResponse(err);
  }
}
