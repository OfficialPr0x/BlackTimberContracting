import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { completeEsignSignature, getEsignByToken } from "@/lib/esign/repository";
import { deliverEsignSignedNotifications } from "@/lib/esign/notify";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  signatureDataUrl: z.string().min(100).max(500_000),
  consentAccepted: z.literal(true),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Signature and agreement are required.",
      });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const updated = await completeEsignSignature({
      plainToken: token,
      signatureDataUrl: parsed.data.signatureDataUrl,
      consentAccepted: true,
      ip,
      userAgent,
    });

    if (!updated) {
      return Response.json({ error: { message: "Link invalid or expired." } }, { status: 404 });
    }

    await deliverEsignSignedNotifications(updated);

    return Response.json({
      status: updated.status,
      signedAt: updated.signedAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
