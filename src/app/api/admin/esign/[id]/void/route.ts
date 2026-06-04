import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { voidEsignEnvelope } from "@/lib/esign/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const envelope = await voidEsignEnvelope(id);
    return Response.json({ envelope });
  } catch (err) {
    return errorResponse(err);
  }
}
