import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { completeEsignSignature } from "@/lib/esign/repository";
import { deliverEsignSignedNotifications } from "@/lib/esign/notify";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  signatureDataUrl: z.string().min(100).max(500_000),
  consentAccepted: z.literal(true),
  signatureFields: z.object({
    legalName: z.string().min(1).max(120),
    signatureText: z.string().min(1).max(120),
    signatureFont: z.enum(["dancing", "greatvibes", "sacramento", "caveat"]),
    title: z.string().max(120).optional(),
    company: z.string().max(160).optional(),
    address: z.string().max(400).optional(),
    dateSigned: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    consentText: z.string().min(1).max(1000),
  }),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Please complete all required signing fields.",
        message: parsed.error.message,
      });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const updated = await completeEsignSignature({
      slug,
      signatureDataUrl: parsed.data.signatureDataUrl,
      signatureFields: parsed.data.signatureFields,
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
