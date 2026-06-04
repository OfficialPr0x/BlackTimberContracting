import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { getFileNode, updateMarkdownContent } from "@/lib/admin/files/repository";
import { chatJSON } from "@/lib/openrouter/client";
import { ADMIN_BOOKKEEPER_SYSTEM } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  instruction: z.string().min(4).max(4000),
});

const AiEditOutput = z.object({
  content: z.string(),
  summary: z.string().max(400),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "admin_chat");

    const { id } = await ctx.params;
    const node = await getFileNode(id);
    if (!node) {
      throw new AiError({
        code: "invalid_input",
        status: 404,
        clientMessage: "File not found.",
      });
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Describe what to change.",
      });
    }

    const current = node.textContent ?? "";
    const result = await chatJSON({
      task: "parse",
      schema: AiEditOutput,
      schemaName: "MarkdownAiEdit",
      jsonObject: true,
      temperature: 0.2,
      timeoutMs: 20_000,
      messages: [
        { role: "system", content: ADMIN_BOOKKEEPER_SYSTEM },
        {
          role: "user",
          content: [
            `Edit this markdown file "${node.name}".`,
            `Instruction: ${parsed.data.instruction}`,
            "",
            "Current content:",
            "```markdown",
            current.slice(0, 120_000),
            "```",
            "",
            'Return JSON: { "content": "<full updated markdown>", "summary": "<one line>" }',
          ].join("\n"),
        },
      ],
    });

    await updateMarkdownContent(id, result.content);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
