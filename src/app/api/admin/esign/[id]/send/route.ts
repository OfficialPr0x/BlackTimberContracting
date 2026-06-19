import { errorResponse } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { rotateSignSlug, sendEsignEnvelope } from "@/lib/esign/repository";
import { deliverEsignSentNotifications } from "@/lib/esign/notify";
import { signPortalUrl } from "@/lib/esign/site-url";

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
    const slug = await rotateSignSlug(id);
    const sent = await sendEsignEnvelope(id, slug);
    const emailErrors = await deliverEsignSentNotifications(sent, slug);

    return Response.json({
      envelope: sent,
      signUrl: signPortalUrl(slug),
      emailErrors,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
