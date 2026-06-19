import { errorResponse } from "@/lib/openrouter/errors";
import { getEsignBySlug } from "@/lib/esign/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public — load envelope for client signing portal (no admin auth). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const envelope = await getEsignBySlug(slug);
    if (!envelope) {
      return Response.json(
        { error: { message: "This signing link is invalid or has expired." } },
        { status: 404 }
      );
    }

    return Response.json({
      id: envelope.id,
      title: envelope.title,
      status: envelope.status,
      documentNumber: envelope.documentNumber,
      requireAddress: envelope.requireAddress,
      signerName: envelope.signerName,
      signerEmail: envelope.signerEmail,
      signerMessage: envelope.signerMessage,
      documentSnapshot: envelope.documentSnapshot,
      signatureFields: envelope.status === "signed" ? envelope.signatureFields : null,
      signedAt: envelope.signedAt,
      expiresAt: envelope.expiresAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
