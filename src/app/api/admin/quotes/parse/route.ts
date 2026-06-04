/**
 * /api/admin/quotes/parse
 *
 * POST → take free-form text from the Cmd+K modal and return a structured
 * PARTIAL form draft (customer/project/lines/taxMode/etc) that the client
 * merges into the quote builder.
 *
 * The model is grounded by `ADMIN_PARSE_PROMPT`, which itself splices in
 * the Fernie HH supplier primer. So the parser knows about flooring,
 * roofing, siding, interior finishes, and the BC tax rules — not just decks.
 *
 * Auth: enforced server-side via `requireAdminRoute()`.
 *
 * Why a separate prompt from /api/admin/quotes/suggest:
 *   - Suggest takes a deliberate scope summary and returns a complete line
 *     list (5–25 lines).
 *   - Parse takes whatever the user blurted out (might be just a name, or
 *     might be an entire job description) and returns a partial — the
 *     client merges it into existing form state without clobbering things
 *     the user already typed.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage } from "@/lib/openrouter/client";
import { requireAdminRoute } from "@/lib/admin/session";
import { AdminQuoteParseInput, AdminQuoteParseOutput } from "@/lib/admin/schemas";
import { ADMIN_PARSE_PROMPT } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "parse");

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your request body.",
      });
    }

    const parsed = AdminQuoteParseInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Type at least 8 characters describing the job.",
        message: parsed.error.message,
      });
    }
    const input = parsed.data;

    const userMessage = [
      "Free-form description of the job:",
      input.text,
      "",
      input.currentForm
        ? `Current form snapshot (DON'T overwrite these unless you have explicit new info):\n${JSON.stringify(input.currentForm, null, 2)}`
        : "Current form is empty.",
      "",
      "Return a STRICT JSON partial of the AdminQuoteParseOutput schema. Only include fields you actually heard or could defensibly infer from the supplier primer.",
    ].join("\n");

    const messages: ChatMessage[] = [
      { role: "system", content: ADMIN_PARSE_PROMPT },
      { role: "user", content: userMessage },
    ];

    // Dedicated "parse" task: Gemini Flash → Claude Sonnet, ~22s timeout each.
    // Do NOT use "explain" (GPT-5 primary) — it 502s on Vercel from slow/failed
    // strict-json calls before fallbacks finish.
    const result = await chatJSON({
      task: "parse",
      schema: AdminQuoteParseOutput,
      schemaName: "AdminQuoteParseOutput",
      messages,
      temperature: 0.1,
      timeoutMs: 22_000,
      strict: false,
      maxModels: 2,
    });

    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
