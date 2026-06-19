/**
 * POST /api/admin/email/ai-draft
 *
 * The AI brain behind the inbox composer. Drafts new emails, replies in a
 * thread (with full conversation context), forwards, or refines an existing
 * draft — all returned as plain text the ComposeDialog drops straight into its
 * editor. Sending is unchanged: the user reviews, tweaks, and hits Send, which
 * still appends the mailbox signature and handles RFC threading.
 *
 * Same OpenRouter + admin-auth + rate-limit setup as the other admin AI tools.
 */

import { z } from "zod";
import { requireAdminRoute } from "@/lib/admin/session";
import { errorResponse } from "@/lib/openrouter/errors";
import { chatJSON, type ChatMessage } from "@/lib/openrouter/client";
import { checkRate } from "@/lib/rate-limit";
import { getBusinessProfile } from "@/lib/business-config";
import { getMailbox, getMessage, getThread } from "@/lib/email/repository";
import type { MessageDetail } from "@/lib/email/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const BodySchema = z.object({
  mailboxId: z.string().uuid(),
  mode: z.enum(["compose", "reply", "forward"]).default("compose"),
  /** A message in the thread to ground a reply/forward in (we load the whole thread from it). */
  threadMessageId: z.string().uuid().optional(),
  /** What the operator wants the email to say. Optional for replies (AI infers a sensible response). */
  instruction: z.string().max(4000).optional(),
  tone: z
    .enum(["professional", "friendly", "warm", "concise", "formal", "apologetic", "persuasive"])
    .default("professional"),
  /** Existing draft text to refine instead of writing from scratch. */
  currentDraft: z.string().max(20000).optional(),
  /** Quick one-tap refinement of the current draft. */
  refine: z
    .enum(["improve", "shorten", "expand", "more_formal", "more_casual", "fix_grammar"])
    .optional(),
  /** Recipients (for context only — helps the AI address people correctly). */
  to: z.array(z.string()).max(50).optional(),
  /** Optional subject already typed by the user. */
  subject: z.string().max(300).optional(),
});

const OutputSchema = z.object({
  subject: z.string().max(300),
  bodyText: z.string().min(1).max(20000),
});

const TONE_HINTS: Record<string, string> = {
  professional: "Professional, clear, and confident — the default for a trades business.",
  friendly: "Friendly and approachable while staying professional.",
  warm: "Warm and personable, like writing to a valued neighbour.",
  concise: "Short and to the point. Cut every unnecessary word.",
  formal: "Formal and polished, suitable for contracts or disputes.",
  apologetic: "Sincerely apologetic and accountable, while staying constructive.",
  persuasive: "Persuasive and motivating, nudging the reader toward saying yes.",
};

const REFINE_HINTS: Record<string, string> = {
  improve: "Rewrite the draft to be clearer, more natural, and better organized. Keep the meaning.",
  shorten: "Make the draft significantly shorter while keeping every key point.",
  expand: "Expand the draft with helpful detail and a clearer structure, without padding.",
  more_formal: "Rewrite the draft in a more formal, polished register.",
  more_casual: "Rewrite the draft in a warmer, more casual register.",
  fix_grammar: "Fix spelling, grammar, and punctuation only. Preserve wording and tone as much as possible.",
};

/** Strip tags from HTML as a fallback when a message has no plain-text body. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageBody(m: MessageDetail): string {
  const text = (m.bodyText ?? "").trim();
  if (text) return text;
  if (m.bodyHtml) return htmlToText(m.bodyHtml);
  return m.snippet ?? "";
}

/** Render the thread chronologically for the model, capping size. */
function renderThread(messages: MessageDetail[], selfAddress: string): string {
  const MAX_CHARS = 14000;
  const lines: string[] = [];
  for (const m of messages) {
    const who =
      m.direction === "outbound"
        ? `You (${m.fromName || m.fromAddress})`
        : `${m.fromName || m.fromAddress} <${m.fromAddress}>`;
    const when = m.emailDate ? new Date(m.emailDate).toLocaleString("en-CA") : "";
    const body = messageBody(m).slice(0, 4000);
    lines.push(`--- ${who}${when ? ` · ${when}` : ""} ---\n${body}`);
  }
  let out = lines.join("\n\n");
  if (out.length > MAX_CHARS) {
    // Keep the most recent messages — they matter most for a reply.
    out = "…(earlier messages trimmed)…\n\n" + out.slice(out.length - MAX_CHARS);
  }
  return out || `(No prior messages in this thread for ${selfAddress}.)`;
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    checkRate(req, "admin_chat");

    const body = BodySchema.parse(await req.json());
    const biz = getBusinessProfile();

    const mailbox = await getMailbox(body.mailboxId);
    if (!mailbox) {
      return Response.json(
        { error: { code: "not_found", message: "Mailbox not found." } },
        { status: 404 }
      );
    }

    const senderFirstName = (mailbox.displayName || biz.name).split(/\s+/)[0] || biz.name;

    // Load thread context for replies/forwards.
    let threadContext = "";
    let latestInbound: MessageDetail | null = null;
    if (body.threadMessageId) {
      const seed = await getMessage(body.threadMessageId);
      if (seed?.threadId) {
        const thread = await getThread(seed.threadId);
        if (thread) {
          threadContext = renderThread(thread.messages, mailbox.address);
          latestInbound =
            [...thread.messages].reverse().find((m) => m.direction === "inbound") ?? seed;
        }
      }
      if (!threadContext && seed) {
        threadContext = renderThread([seed], mailbox.address);
        latestInbound = seed.direction === "inbound" ? seed : null;
      }
    }

    const system = [
      `You are the email-writing assistant for ${biz.name}, a contracting/trades business in ${biz.region}.`,
      `You are writing AS ${mailbox.displayName} <${mailbox.address}>. Write in the first person as them.`,
      "",
      "Hard rules:",
      "- Output PLAIN TEXT only (no HTML, no markdown, no asterisks for bold).",
      "- Use real line breaks between paragraphs.",
      "- Do NOT invent facts: no prices, dates, measurements, or commitments that aren't in the instruction or thread. If a detail is unknown, ask for it or leave a clearly worded placeholder like [date].",
      "- Do NOT add a signature block, phone number, address, or company letterhead — those are appended automatically when the email is sent.",
      "- You may end with a brief sign-off line (e.g. \"Thanks,\" or \"Best,\") followed by \"" + senderFirstName + "\".",
      "- Sound like a real, competent tradesperson — grounded, helpful, no corporate fluff or emoji.",
      "- Return STRICT JSON: { \"subject\": \"...\", \"bodyText\": \"...\" }.",
      "",
      `Tone: ${TONE_HINTS[body.tone] ?? TONE_HINTS.professional}`,
    ].join("\n");

    const parts: string[] = [];

    if (body.mode === "reply") {
      parts.push("TASK: Write a reply to the most recent message in this email thread.");
      if (latestInbound) {
        parts.push(`You are replying to ${latestInbound.fromName || latestInbound.fromAddress}.`);
      }
    } else if (body.mode === "forward") {
      parts.push("TASK: Write a short forwarding note to introduce the message being forwarded below.");
    } else {
      parts.push("TASK: Write a new email.");
    }

    if (body.to?.length) parts.push(`Recipients: ${body.to.join(", ")}`);
    if (body.subject) parts.push(`Current subject line: ${body.subject}`);

    if (body.refine && body.currentDraft) {
      parts.push("");
      parts.push("REFINE the current draft below. " + (REFINE_HINTS[body.refine] ?? ""));
      parts.push("Current draft:\n" + body.currentDraft);
    } else if (body.currentDraft) {
      parts.push("");
      parts.push("There is an existing draft to build on / improve:\n" + body.currentDraft);
    }

    if (body.instruction) {
      parts.push("");
      parts.push("What I want the email to say (follow this closely):\n" + body.instruction);
    } else if (body.mode === "reply") {
      parts.push("");
      parts.push(
        "No specific instruction was given — read the thread and write the natural, helpful next reply on my behalf."
      );
    }

    if (threadContext) {
      parts.push("");
      parts.push("EMAIL THREAD (oldest first):\n" + threadContext);
    }

    parts.push("");
    parts.push(
      'Return ONLY JSON like {"subject":"...","bodyText":"Hi ...\\n\\nThanks,\\n' +
        senderFirstName +
        '"}. For a reply, keep the existing subject (add "Re: " only if it is missing).'
    );

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: parts.filter((p) => p !== null).join("\n") },
    ];

    const result = await chatJSON({
      task: "chat",
      schema: OutputSchema,
      schemaName: "EmailDraft",
      messages,
      temperature: body.refine === "fix_grammar" ? 0.2 : 0.6,
      jsonObject: true,
      maxUsd: 0.2,
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
