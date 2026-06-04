import { errorResponse } from "@/lib/openrouter/errors";
import { getEsignByToken } from "@/lib/esign/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public — load envelope for client signing portal (no admin auth). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;
    const envelope = await getEsignByToken(token);
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
      signerName: envelope.signerName,
      signerMessage: envelope.signerMessage,
      documentSnapshot: envelope.documentSnapshot,
      signedAt: envelope.signedAt,
      expiresAt: envelope.expiresAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
