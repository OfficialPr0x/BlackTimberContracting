import { z } from "zod";
import { requireAdminRoute } from "@/lib/admin/session";
import { emailErrorResponse } from "@/lib/email/http";
import { updateMailbox } from "@/lib/email/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  kind: z.enum(["shared", "personal"]).optional(),
  ownerLabel: z.string().max(120).nullish(),
  description: z.string().max(400).nullish(),
  signatureHtml: z.string().max(8000).nullish(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const body = PatchSchema.parse(await req.json());
    const mailbox = await updateMailbox(id, {
      displayName: body.displayName,
      kind: body.kind,
      ownerLabel: body.ownerLabel ?? undefined,
      description: body.description ?? undefined,
      signatureHtml: body.signatureHtml ?? undefined,
      active: body.active,
    });
    return Response.json({ mailbox });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return emailErrorResponse(err);
  }
}
