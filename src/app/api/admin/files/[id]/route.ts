import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import {
  deleteFileNode,
  getFileNode,
  updateMarkdownContent,
} from "@/lib/admin/files/repository";
import { z } from "zod";

export const runtime = "nodejs";

const PutBody = z.object({
  content: z.string().max(500_000),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const node = await getFileNode(id);
    if (!node) {
      return Response.json({ error: { message: "Not found." } }, { status: 404 });
    }
    return Response.json(node);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = PutBody.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Invalid content.",
      });
    }

    await updateMarkdownContent(id, parsed.data.content);
    const node = await getFileNode(id);
    return Response.json(node);
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
    await deleteFileNode(id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
