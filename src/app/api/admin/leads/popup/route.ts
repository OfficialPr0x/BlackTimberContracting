import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { listPopupSubs } from "@/lib/leads/site-leads-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const subs = await listPopupSubs(200);
    return Response.json({ subs, supabase: isSupabaseConfigured() });
  } catch (err) {
    return errorResponse(err);
  }
}
