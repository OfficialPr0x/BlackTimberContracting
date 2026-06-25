/**
 * /api/admin/qr/[id]
 *   PATCH  → archive / unarchive a QR code { archived: boolean }
 *   DELETE → permanently delete a QR code (and its scan history)
 */

import { z } from "zod";
import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { setQrArchived, deleteQrCode } from "@/lib/admin/qr-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({ archived: z.boolean() });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Invalid request.",
      });
    }

    const ok = await setQrArchived(id, parsed.data.archived);
    if (!ok) {
      throw new AiError({
        code: "internal",
        status: 500,
        clientMessage: "Could not update the QR code.",
      });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const ok = await deleteQrCode(id);
    if (!ok) {
      throw new AiError({
        code: "internal",
        status: 500,
        clientMessage: "Could not delete the QR code.",
      });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
