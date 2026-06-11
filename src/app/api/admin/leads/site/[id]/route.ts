import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { updateSiteLead } from "@/lib/leads/site-leads-repository";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  status: z.enum(["new", "estimate", "booked", "contacted", "won", "lost"]).optional(),
  tags: z.array(z.string().max(80)).max(20).optional(),
  notes: z.string().max(4000).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = PatchBody.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Invalid update.",
      });
    }

    const ok = await updateSiteLead(id, parsed.data);
    if (!ok) {
      return Response.json({ error: { message: "Update failed" } }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
