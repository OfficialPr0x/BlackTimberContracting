/**
 * POST /api/admin/email/signature
 *
 * Generates a clean, email-safe HTML signature for a mailbox using the same
 * OpenRouter setup as the rest of the admin AI tools. Returns { signatureHtml }.
 */

import { z } from "zod";
import { requireAdminRoute } from "@/lib/admin/session";
import { errorResponse } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage } from "@/lib/openrouter/client";
import { getBusinessProfile } from "@/lib/business-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  displayName: z.string().min(1).max(120),
  address: z.string().email().max(200),
  role: z.string().max(120).optional(),
  kind: z.enum(["personal", "shared"]).optional(),
  tone: z.enum(["professional", "warm", "minimal"]).optional(),
});

const OutputSchema = z.object({
  signatureHtml: z.string().min(1).max(8000),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await req.json());
    const biz = getBusinessProfile();

    const system = [
      "You write clean, modern, email-safe HTML signatures.",
      "Rules:",
      "- Output a SINGLE <table>-free block using only inline styles on <div>/<span>/<a> (no <style>, <script>, <img>, or external resources).",
      "- Keep it compact (5–7 short lines max). No marketing fluff, no quotes.",
      "- Use the brand accent color #c5a880 sparingly (e.g. the name or a thin divider).",
      "- Make the phone a tel: link and the email + website real <a> links.",
      "- Dark-mode safe: do not set a background color; use #1c1917-ish text via inline color only where needed, otherwise inherit.",
      "- Return STRICT JSON: { \"signatureHtml\": \"<...>\" }",
    ].join("\n");

    const user = [
      `Person: ${body.displayName}`,
      body.role ? `Role/Title: ${body.role}` : null,
      `Email: ${body.address}`,
      `Mailbox type: ${body.kind ?? "personal"}`,
      `Tone: ${body.tone ?? "professional"}`,
      "",
      "Company details (use these exactly):",
      `- Company: ${biz.name}`,
      `- Region: ${biz.region}`,
      `- Phone: ${biz.phone}`,
      `- Website: https://${biz.domain}`,
      biz.licenseNumber ? `- License: ${biz.licenseNumber}` : null,
      "",
      'Return ONLY JSON like {"signatureHtml":"<div ...>...</div>"}.',
    ]
      .filter(Boolean)
      .join("\n");

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    const result = await chatJSON({
      task: "parse",
      schema: OutputSchema,
      schemaName: "EmailSignature",
      messages,
      temperature: 0.6,
      jsonObject: true,
      maxUsd: 0.1,
    });

    return Response.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return errorResponse(err);
  }
}
