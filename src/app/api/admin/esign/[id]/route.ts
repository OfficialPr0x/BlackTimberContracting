import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { getEsignEnvelope } from "@/lib/esign/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const envelope = await getEsignEnvelope(id);
    if (!envelope) {
      return Response.json({ error: { message: "Not found" } }, { status: 404 });
    }
    return Response.json({ envelope });
  } catch (err) {
    return errorResponse(err);
  }
}
