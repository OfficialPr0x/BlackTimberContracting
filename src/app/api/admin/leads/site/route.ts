import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { listSiteLeads } from "@/lib/leads/site-leads-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const leads = await listSiteLeads(150);
    return Response.json({ leads });
  } catch (err) {
    return errorResponse(err);
  }
}
