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
import {
  analyzePaperworkGaps,
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
    contextFileIds: z.array(z.string().uuid()).max(6).optional(),
    /** Photos uploaded from chat — vision + file_bookkeeping_record filing */
    attachmentFileIds: z.array(z.string().uuid()).max(4).optional(),
    selectedFolderId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const last = data.messages[data.messages.length - 1];
    const hasAttachments = (data.attachmentFileIds?.length ?? 0) > 0;
    if (last?.role === "user" && !last.content.trim() && !hasAttachments) {
      ctx.addIssue({
        code: "custom",
        message: "Message or photo required.",
        path: ["messages"],
      });
    }
  });

const JSON_HINT = `
Return ONE JSON object only:
{
  "reply": "markdown answer for Jaryd",
  "actions": [
    { "type": "create_folder", "name": "2026 Q1", "parentFolderName": "Receipts" },
    { "type": "create_markdown", "name": "expense-log.md", "content": "# ...", "parentFolderName": "Receipts" },
    { "type": "archive_document", "documentId": "I-20260604-AB3C", "parentFolderName": "Quotes & Invoices" },
    { "type": "create_esign", "documentId": "Q-20260604-AB3C", "sendNow": true, "signerMessage": "Please review and sign." },
    { "type": "file_bookkeeping_record", "fileId": "uuid-from-attachments", "parentFolderName": "Receipts", "imageName": "2026-06-04-fernie-hh.jpg", "recordName": "2026-06-04-fernie-hh.md", "recordContent": "# Receipt\\n..." }
  ]
}
Use actions when Jaryd asks you to save, file, organize, or write notes/reports into the vault.
When photos are attached, ALWAYS return file_bookkeeping_record per image (vision-read, categorize, rename image, markdown record).
- create_esign: send a quote/estimate/invoice for client e-signature (needs customer email on quote or signerEmail). Track in Admin → E-Sign.
- archive_document: snapshot a live Q-/E-/I- from the register (accurate totals/lines). Use after sending quotes or when filing paperwork.
- create_markdown: free-form notes (receipt logs, GST summaries). Never invent dollar amounts for documents — use archive_document instead.
parentFolderName must match an existing folder (see vault tree). Default quotes/invoices to "Quotes & Invoices".
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

    const [flat, docRows] = await Promise.all([
      listFileNodes(),
      fetchDocumentsForBookkeeper(80),
    ]);
    const vaultTree = formatVaultTreeForPrompt(flat);
    const docRegister = formatDocumentsRegisterForPrompt(docRows);
    const gaps = analyzePaperworkGaps(docRows);

    const mentionedIds = extractDocumentIdsFromMessages(parsed.data.messages);
    const detailDocs = await loadDocumentsForBookkeeper(mentionedIds);
    const docDetails = detailDocs.map(formatDocumentDetailForPrompt).join("\n\n");

    const contextBlocks: string[] = [];
    const visionUrls: string[] = [];
    const attachmentLines: string[] = [];

    const allFileIds = [
      ...new Set([
        ...(parsed.data.attachmentFileIds ?? []),
        ...(parsed.data.contextFileIds ?? []),
      ]),
    ];

    for (const fid of allFileIds) {
      const node = await getFileNode(fid);
      if (!node) continue;
      const isAttachment = parsed.data.attachmentFileIds?.includes(fid);
      if (node.mimeType?.startsWith("image/") && node.downloadUrl) {
        visionUrls.push(node.downloadUrl);
        const line = `- fileId ${fid}: ${node.name}${isAttachment ? " (chat upload)" : ""}`;
        if (isAttachment) attachmentLines.push(line);
        else contextBlocks.push(`[Image: ${node.name}]`);
      } else if (node.textContent) {
        contextBlocks.push(
          `--- ${node.name} ---\n${node.textContent.slice(0, 20_000)}\n---`
        );
      } else if (isAttachment) {
        attachmentLines.push(`- fileId ${fid}: ${node.name} (non-image upload)`);
      }
    }

    const system = [
      ADMIN_BOOKKEEPER_SYSTEM,
      "",
      "Live quotes / estimates / invoices (admin tool — source of truth for AR):",
      docRegister,
      gaps.length
        ? `\nPaperwork alerts (proactively mention in reply when relevant):\n${gaps.map((g) => `- ${g}`).join("\n")}`
        : "",
      "",
      "Vault folders (use exact parentFolderName when creating files):",
      vaultTree,
      "",
      JSON_HINT,
      docDetails ? `Referenced documents (full detail):\n${docDetails}` : "",
      contextBlocks.length ? `Open vault file context:\n${contextBlocks.join("\n")}` : "",
      attachmentLines.length
        ? `Chat photo attachments (use these fileId values in file_bookkeeping_record):\n${attachmentLines.join("\n")}`
        : "",
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
        const userText =
          last.content.trim() ||
          "Process the attached photo(s) for bookkeeping: read each image, categorize into the correct vault folder, rename the image file clearly, and create a markdown record with vendor, date, amounts (only if visible), GST/PST if shown, category, and notes.";
        const parts: ContentPart[] = [{ type: "text", text: userText }];
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
          : e.type === "archive_document"
          ? `📋 Archived **${e.documentId ?? e.name}** → ${e.name}`
          : e.type === "create_esign"
          ? `✍️ E-sign sent **${e.documentId ?? e.name}**${e.signUrl ? ` — [portal link](${e.signUrl})` : ""}`
          : e.type === "file_bookkeeping_record"
          ? `🧾 Filed **${e.imageName ?? "image"}** + **${e.name}** → ${e.parentFolderName ?? "vault"}`
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
