import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import {
  createFolder,
  createMarkdownFile,
  listFileNodes,
} from "@/lib/admin/files/repository";
import { buildFileTree } from "@/lib/admin/files/types";
import { z } from "zod";

export const runtime = "nodejs";

const CreateBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("folder"),
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("markdown"),
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional(),
    content: z.string().max(500_000).optional(),
  }),
]);

export async function GET() {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const flat = await listFileNodes();
    return Response.json({ nodes: flat, tree: buildFileTree(flat) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const json = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Invalid folder or note request.",
      });
    }

    const parentId = parsed.data.parentId ?? null;
    if (parsed.data.action === "folder") {
      const node = await createFolder(parsed.data.name, parentId);
      return Response.json(node);
    }
    const node = await createMarkdownFile(
      parsed.data.name,
      parentId,
      parsed.data.content ?? ""
    );
    return Response.json(node);
  } catch (err) {
    return errorResponse(err);
  }
}
