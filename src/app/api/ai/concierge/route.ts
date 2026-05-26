/**
 * POST /api/ai/concierge
 *
 * Body: { messages: ChatMessage[] }  — entire conversation, OpenAI-style
 * Returns: text/plain stream of token deltas (NOT SSE; raw text)
 *
 * Streaming chat for the floating concierge widget. Caller reads the body as
 * a stream and appends incrementally.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatStream, type ChatMessage } from "@/lib/openrouter/client";
import { CONCIERGE_SYSTEM } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;

const ConciergeInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40), // cap conversation length to prevent runaway context bills
});

export async function POST(req: Request) {
  try {
    checkRate(req, "chat");

    const json = await req.json().catch(() => null);
    const parsed = ConciergeInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your chat message.",
        message: parsed.error.message,
      });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: CONCIERGE_SYSTEM },
      ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ];

    const stream = await chatStream({ task: "chat", messages, temperature: 0.7 });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
