import { z } from "zod";
import { requireAdminRoute } from "@/lib/admin/session";
import { emailErrorResponse } from "@/lib/email/http";
import {
  getMessage,
  getThread,
  moveToFolder,
  setCategory,
  setStarred,
  setThreadUnread,
  setUnread,
} from "@/lib/email/repository";
import type { MessageDetail } from "@/lib/email/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rewrite inline cid: references to our attachment proxy so images render. */
function rewriteCids(m: MessageDetail): MessageDetail {
  if (!m.bodyHtml || m.attachments.length === 0) return m;
  let html = m.bodyHtml;
  for (const att of m.attachments) {
    if (!att.contentId) continue;
    const id = att.contentId.replace(/^<|>$/g, "");
    const url = `/api/admin/email/attachments/${att.id}/raw`;
    html = html
      .replaceAll(`cid:${id}`, url)
      .replaceAll(`cid:${att.contentId}`, url);
  }
  return { ...m, bodyHtml: html };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const url = new URL(req.url);
    const markRead = url.searchParams.get("markRead") === "1";

    const message = await getMessage(id);
    if (!message) {
      return Response.json(
        { error: { code: "not_found", message: "Message not found" } },
        { status: 404 }
      );
    }

    if (markRead && message.unread) {
      await setUnread(id, false);
      message.unread = false;
    }

    if (message.threadId) {
      const thread = await getThread(message.threadId);
      if (thread) {
        return Response.json({
          thread: thread.thread,
          messages: thread.messages.map(rewriteCids),
        });
      }
    }
    return Response.json({ thread: null, messages: [rewriteCids(message)] });
  } catch (err) {
    return emailErrorResponse(err);
  }
}

const PatchSchema = z.object({
  unread: z.boolean().optional(),
  starred: z.boolean().optional(),
  folder: z.enum(["inbox", "sent", "drafts", "archive", "spam", "trash"]).optional(),
  category: z.enum(["primary", "promotions", "social", "updates", "forums"]).optional(),
  scope: z.enum(["message", "thread"]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const body = PatchSchema.parse(await req.json());

    if (body.unread !== undefined) {
      if (body.scope === "thread") {
        const msg = await getMessage(id);
        if (msg?.threadId) await setThreadUnread(msg.threadId, body.unread);
        else await setUnread(id, body.unread);
      } else {
        await setUnread(id, body.unread);
      }
    }
    if (body.starred !== undefined) await setStarred(id, body.starred);
    if (body.folder !== undefined) await moveToFolder(id, body.folder);
    if (body.category !== undefined) await setCategory(id, body.category);

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return emailErrorResponse(err);
  }
}
