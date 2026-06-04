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

/** Shown to the model when using json_object mode (no strict json_schema). */
const PARSE_JSON_HINT = `
Return ONE JSON object only. Required: "appliedSummary" (string), "uncertainties" (string array, can be []).
Optional fields — omit if unknown:
  documentType: "quote" | "estimate" | "invoice"
  customer: { name?, email?, phone?, billingAddress?, jobSiteAddress? }
  project: { type?, scopeSummary?, lengthFt?, widthFt?, material?, notes? }
  lines: [{ description, quantity, uom, unitPriceCAD, source, leadTimeDays?, notes? }]
  taxMode: "real_property_install" | "supply_only" | "mixed_split" | "exempt"
  freightCAD: number
  paymentTerms: string
If the user gave explicit $/sqft or $/LF prices, use those as unitPriceCAD. CAD only.
`.trim();

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
      PARSE_JSON_HINT,
    ].join("\n");

    const messages: ChatMessage[] = [
      { role: "system", content: ADMIN_PARSE_PROMPT },
      { role: "user", content: userMessage },
    ];

    // json_object + Zod validation — works on Gemini Flash & Claude Haiku.
    // json_schema strict mode was 502ing in production.
    const result = await chatJSON({
      task: "parse",
      schema: AdminQuoteParseOutput,
      schemaName: "AdminQuoteParseOutput",
      messages,
      temperature: 0.1,
      timeoutMs: 14_000,
      jsonObject: true,
      maxModels: 2,
    });

    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
