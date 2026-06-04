/**
 * POST /api/admin/bookkeeper — streaming AI bookkeeper (admin only).
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatStream, type ChatMessage } from "@/lib/openrouter/client";
import { ADMIN_BOOKKEEPER_SYSTEM } from "@/lib/openrouter/prompts";
import { requireAdminRoute } from "@/lib/admin/session";
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

    const messages: ChatMessage[] = [
      { role: "system", content: ADMIN_BOOKKEEPER_SYSTEM },
      ...parsed.data.messages.map(
        (m) => ({ role: m.role, content: m.content }) as ChatMessage
      ),
    ];

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
