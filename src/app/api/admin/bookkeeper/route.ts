/**
 * POST /api/admin/bookkeeper — streaming AI bookkeeper (admin only).
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatStream, type ChatMessage, type ContentPart } from "@/lib/openrouter/client";
import { ADMIN_BOOKKEEPER_SYSTEM } from "@/lib/openrouter/prompts";
import { requireAdminRoute } from "@/lib/admin/session";
import { getFileNode } from "@/lib/admin/files/repository";
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
  /** Vault files to ground the reply (receipts, notes, spreadsheets metadata). */
  contextFileIds: z.array(z.string().uuid()).max(6).optional(),
});

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

    const contextBlocks: string[] = [];
    const visionUrls: string[] = [];

    for (const fid of parsed.data.contextFileIds ?? []) {
      const node = await getFileNode(fid);
      if (!node) continue;
      if (node.mimeType?.startsWith("image/") && node.downloadUrl) {
        visionUrls.push(node.downloadUrl);
        contextBlocks.push(`[Image file: ${node.name}]`);
      } else if (node.textContent) {
        contextBlocks.push(
          `--- File: ${node.name} ---\n${node.textContent.slice(0, 24_000)}\n---`
        );
      } else {
        contextBlocks.push(
          `[Attached file: ${node.name}, type ${node.mimeType ?? "unknown"}, ${node.sizeBytes ?? 0} bytes]`
        );
      }
    }

    const system =
      contextBlocks.length > 0
        ? `${ADMIN_BOOKKEEPER_SYSTEM}\n\nVault context:\n${contextBlocks.join("\n")}`
        : ADMIN_BOOKKEEPER_SYSTEM;

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

    const messages: ChatMessage[] = [{ role: "system", content: system }, ...mapped];

    const stream = await chatStream({ task: "chat", messages, temperature: 0.35 });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
