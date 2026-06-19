import { errorResponse } from "@/lib/openrouter/errors";
import { getEsignBySlug, markEsignViewed } from "@/lib/esign/repository";
import { deliverEsignViewedNotification } from "@/lib/esign/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const found = await getEsignBySlug(slug);
    if (!found) {
      return Response.json({ error: { message: "Link invalid or expired." } }, { status: 404 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const wasUnviewed = !found.viewedAt;
    const updated = await markEsignViewed(found.id, { ip, userAgent });
    if (wasUnviewed && updated) {
      await deliverEsignViewedNotification(updated);
    }

    return Response.json({ status: updated?.status ?? found.status });
  } catch (err) {
    return errorResponse(err);
  }
}
