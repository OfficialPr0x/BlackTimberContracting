import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import {
  deleteFileNode,
  getFileNode,
  updateFileNodeMeta,
  updateMarkdownContent,
} from "@/lib/admin/files/repository";
import { z } from "zod";

export const runtime = "nodejs";

const PatchBody = z
  .object({
    content: z.string().max(500_000).optional(),
    name: z.string().min(1).max(255).optional(),
    parentId: z.string().uuid().nullable().optional(),
  })
  .refine((b) => b.content !== undefined || b.name !== undefined || b.parentId !== undefined, {
    message: "Nothing to update.",
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

    if (parsed.data.content !== undefined) {
      await updateMarkdownContent(id, parsed.data.content);
    }
    if (parsed.data.name !== undefined || parsed.data.parentId !== undefined) {
      await updateFileNodeMeta(id, {
        name: parsed.data.name,
        parentId: parsed.data.parentId,
      });
    }

    const node = await getFileNode(id);
    return Response.json(node);
  } catch (err) {
    return errorResponse(err);
  }
}

/** @deprecated Use PATCH */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return PATCH(req, ctx);
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
