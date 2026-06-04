/**
 * POST /api/admin/bookkeeper — AI bookkeeper with vault file/folder creation.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage, type ContentPart } from "@/lib/openrouter/client";
import { ADMIN_BOOKKEEPER_SYSTEM } from "@/lib/openrouter/prompts";
import { requireAdminRoute } from "@/lib/admin/session";
import { getFileNode } from "@/lib/admin/files/repository";
import {
  BookkeeperResponseSchema,
  executeVaultActions,
  formatVaultTreeForPrompt,
} from "@/lib/admin/files/bookkeeper-actions";
import { listFileNodes } from "@/lib/admin/files/repository";
import { checkRate } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

const Input = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(40),
  contextFileIds: z.array(z.string().uuid()).max(6).optional(),
  /** Selected folder in the IDE — default parent for new files */
  selectedFolderId: z.string().uuid().nullable().optional(),
});

const JSON_HINT = `
Return ONE JSON object only:
{
  "reply": "markdown answer for Jaryd",
  "actions": [
    { "type": "create_folder", "name": "2026 Q1", "parentFolderName": "Receipts" },
    { "type": "create_markdown", "name": "expense-log.md", "content": "# ...", "parentFolderName": "Receipts" }
  ]
}
Use actions when Jaryd asks you to save, file, organize, or write notes/reports into the vault.
parentFolderName must match an existing folder (see vault tree). Omit parentFolderName only for top-level folders.
actions can be [] if no files should be created.
`.trim();

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "admin_chat");

    const json = await req.json().catch(() => null);
    const parsed = Input.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your message.",
        message: parsed.error.message,
      });
    }

    const flat = await listFileNodes();
    const vaultTree = formatVaultTreeForPrompt(flat);

    const contextBlocks: string[] = [];
    const visionUrls: string[] = [];

    for (const fid of parsed.data.contextFileIds ?? []) {
      const node = await getFileNode(fid);
      if (!node) continue;
      if (node.mimeType?.startsWith("image/") && node.downloadUrl) {
        visionUrls.push(node.downloadUrl);
        contextBlocks.push(`[Image: ${node.name}]`);
      } else if (node.textContent) {
        contextBlocks.push(
          `--- ${node.name} ---\n${node.textContent.slice(0, 20_000)}\n---`
        );
      }
    }

    const system = [
      ADMIN_BOOKKEEPER_SYSTEM,
      "",
      "Vault folders (use exact parentFolderName when creating files):",
      vaultTree,
      "",
      JSON_HINT,
      contextBlocks.length ? `Open file context:\n${contextBlocks.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const mapped = parsed.data.messages.map(
      (m) => ({ role: m.role, content: m.content }) as ChatMessage
    );

    if (visionUrls.length > 0) {
      const lastIdx = mapped.length - 1;
      const last = mapped[lastIdx];
      if (last?.role === "user" && typeof last.content === "string") {
        const parts: ContentPart[] = [{ type: "text", text: last.content }];
        for (const url of visionUrls.slice(0, 4)) {
          parts.push({ type: "image_url", image_url: { url, detail: "high" } });
        }
        mapped[lastIdx] = { role: "user", content: parts };
      }
    }

    const result = await chatJSON({
      task: "parse",
      schema: BookkeeperResponseSchema,
      schemaName: "BookkeeperResponse",
      messages: [{ role: "system", content: system }, ...mapped],
      temperature: 0.35,
      jsonObject: true,
      timeoutMs: 28_000,
      maxModels: 2,
    });

    const { executed, errors } = await executeVaultActions(
      result.actions,
      parsed.data.selectedFolderId ?? null
    );

    let reply = result.reply;
    if (executed.length > 0) {
      const lines = executed.map((e) =>
        e.type === "create_folder"
          ? `📁 Folder **${e.name}**`
          : `📄 Note **${e.name}**`
      );
      reply += `\n\n---\n**Saved to vault:**\n${lines.join("\n")}`;
    }
    if (errors.length > 0) {
      reply += `\n\n*(Some vault actions failed: ${errors.join("; ")})*`;
    }

    return Response.json({ reply, created: executed, actionErrors: errors });
  } catch (err) {
    return errorResponse(err);
  }
}
