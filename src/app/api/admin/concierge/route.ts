/**
 * POST /api/admin/concierge — onsite AI estimator (admin only).
 *
 * Vision + session memory + backend actions. Jaryd walks a live in-person
 * estimate: uploads job-site photos, describes scope by voice/text, and the
 * agent builds a transparent line-item draft. On command it saves a real
 * Q-/E-/I- document and can send it for e-signature.
 *
 * Follows the bookkeeper's proven JSON-actions pattern (not streaming) because
 * the estimator returns a structured draft + executes backend actions.
 */

import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage, type ContentPart } from "@/lib/openrouter/client";
import { ESTIMATOR_SYSTEM } from "@/lib/openrouter/prompts";
import { requireAdminRoute } from "@/lib/admin/session";
import {
  EstimatorResponseSchema,
  ESTIMATOR_JSON_HINT,
  executeEstimatorActions,
  previewDraftTotals,
} from "@/lib/admin/estimator-actions";
import {
  extractDocumentIdsFromMessages,
  fetchDocumentsForBookkeeper,
  formatDocumentDetailForPrompt,
  formatDocumentsRegisterForPrompt,
  loadDocumentsForBookkeeper,
} from "@/lib/admin/bookkeeper-documents";
import { checkRate } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

const InputImage = z.object({
  /** data:image/... base64 (preferred for live onsite) or https URL */
  url: z
    .string()
    .min(20)
    .max(8_000_000)
    .refine(
      (u) => u.startsWith("data:image/") || /^https?:\/\//i.test(u),
      "Image must be a data URL or https URL"
    ),
  caption: z.string().max(160).optional(),
});

const Input = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(8000),
        })
      )
      .min(1)
      .max(40),
    /** Photos attached to the CURRENT turn (vision). */
    images: z.array(InputImage).max(4).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const last = data.messages[data.messages.length - 1];
    const hasImages = (data.images?.length ?? 0) > 0;
    if (last?.role === "user" && !last.content.trim() && !hasImages) {
      ctx.addIssue({ code: "custom", message: "Message or photo required.", path: ["messages"] });
    }
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

    // Backend context: live documents register + detail for any referenced IDs.
    const docRows = await fetchDocumentsForBookkeeper(60);
    const docRegister = formatDocumentsRegisterForPrompt(docRows);
    const mentionedIds = extractDocumentIdsFromMessages(parsed.data.messages);
    const detailDocs = await loadDocumentsForBookkeeper(mentionedIds);
    const docDetails = detailDocs.map(formatDocumentDetailForPrompt).join("\n\n");

    const today = new Date().toISOString().slice(0, 10);

    const system = [
      ESTIMATOR_SYSTEM,
      "",
      `Today: ${today}`,
      "",
      "Live documents in the backend (source of truth — reference real IDs, never invent them):",
      docRegister,
      docDetails ? `\nReferenced documents (full detail):\n${docDetails}` : "",
      "",
      ESTIMATOR_JSON_HINT,
    ]
      .filter(Boolean)
      .join("\n");

    const mapped: ChatMessage[] = parsed.data.messages.map(
      (m) => ({ role: m.role, content: m.content }) as ChatMessage
    );

    // Attach current-turn photos to the last user message for vision.
    if (parsed.data.images.length > 0) {
      const lastIdx = mapped.length - 1;
      const last = mapped[lastIdx];
      if (last?.role === "user" && typeof last.content === "string") {
        const userText =
          last.content.trim() ||
          "Read these job-site photos: identify scope, rough dimensions, materials, condition and red flags, then build / update the estimate draft.";
        const parts: ContentPart[] = [{ type: "text", text: userText }];
        for (const img of parsed.data.images.slice(0, 4)) {
          if (img.caption) parts.push({ type: "text", text: `(photo note: ${img.caption})` });
          parts.push({ type: "image_url", image_url: { url: img.url, detail: "high" } });
        }
        mapped[lastIdx] = { role: "user", content: parts };
      }
    }

    const result = await chatJSON({
      task: "quote",
      schema: EstimatorResponseSchema,
      schemaName: "EstimatorResponse",
      messages: [{ role: "system", content: system }, ...mapped],
      temperature: 0.4,
      jsonObject: true,
      timeoutMs: 45_000,
      maxModels: 2,
      maxUsd: 0.9,
    });

    const draft = result.draft ?? null;
    const draftTotals = draft && draft.lines.length > 0 ? previewDraftTotals(draft) : null;

    const { executed, errors } = await executeEstimatorActions(
      result.actions,
      draft,
      auth.session.sub
    );

    let reply = result.reply;
    if (executed.length > 0) {
      const lines = executed.map((e) =>
        e.type === "create_document"
          ? `📄 Saved **${e.id}** (${e.documentType}) — ${e.name} · $${(e.grandTotalCAD ?? 0).toFixed(2)} — [preview PDF](${e.previewUrl})`
          : `✍️ Sent for signature **${e.name}**${e.signUrl ? ` — [portal link](${e.signUrl})` : ""}`
      );
      reply += `\n\n---\n**Done:**\n${lines.join("\n")}`;
    }
    if (errors.length > 0) {
      reply += `\n\n*(Heads up: ${errors.join("; ")})*`;
    }

    return Response.json({
      reply,
      draft,
      draftTotals,
      created: executed,
      actionErrors: errors,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
