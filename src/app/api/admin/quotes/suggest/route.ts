/**
 * /api/admin/quotes/suggest
 *
 * POST → take a free-form project scope and return a structured list of
 * line items (descriptions, quantities, UOM, CAD unit prices, source) that
 * the admin can review, edit, and turn into a real customer quote.
 *
 * The model is grounded by `ADMIN_SUGGEST_PROMPT`, which itself splices in
 * the Fernie HH supplier primer. So suggestions reference real local
 * stocked vs special-order behavior, real CAD ballparks, real waste
 * factors, and labor lines at Kootenay 2026 rates.
 *
 * Auth: enforced server-side via `requireAdminRoute()`.
 *
 * Why we reuse the "quote" model task (rather than adding "admin_suggest"
 * to models.ts): the reasoning is identical to the public quote endpoint
 * — supplier-grounded structured reasoning that benefits from a Claude-
 * class model and the same fallback chain. Adding a new task slot would
 * be premature; collapse later if behavior diverges.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage } from "@/lib/openrouter/client";
import { requireAdminRoute } from "@/lib/admin/session";
import { AdminQuoteSuggestInput, AdminQuoteSuggestOutput } from "@/lib/admin/schemas";
import { ADMIN_SUGGEST_PROMPT } from "@/lib/openrouter/prompts";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    // Reuse the "quote" rate-limit bucket — same per-IP budget, same kind
    // of expensive structured call. Defends against an admin tab gone rogue
    // (e.g., infinite "suggest" loop in dev).
    checkRate(req, "quote");

    const json = await req.json().catch(() => null);
    if (!json) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Couldn't read your request body.",
      });
    }

    const parsed = AdminQuoteSuggestInput.safeParse(json);
    if (!parsed.success) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Suggest input was invalid. Need at least an 8-character scope.",
        message: parsed.error.message,
      });
    }
    const input = parsed.data;

    const userMessage = [
      `Project scope (free-form):`,
      input.scope,
      ``,
      input.project?.type ? `Project type: ${input.project.type}` : "",
      input.project?.lengthFt && input.project?.widthFt
        ? `Dimensions: ${input.project.lengthFt} ft × ${input.project.widthFt} ft (${
            input.project.lengthFt * input.project.widthFt
          } sq ft)`
        : "",
      input.project?.material ? `Material: ${input.project.material}` : "",
      input.location ? `Job site location: ${input.location}` : "",
      ``,
      `Produce a structured set of line items grounded in Fernie HH PRO supply, plus labor and any subcontracted lines (e.g., helical piles).`,
    ]
      .filter(Boolean)
      .join("\n");

    const messages: ChatMessage[] = [
      { role: "system", content: ADMIN_SUGGEST_PROMPT },
      { role: "user", content: userMessage },
    ];

    const result = await chatJSON({
      task: "quote", // see header comment for why we reuse the quote model
      schema: AdminQuoteSuggestOutput,
      schemaName: "AdminQuoteSuggestOutput",
      messages,
      temperature: 0.2,
    });

    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
