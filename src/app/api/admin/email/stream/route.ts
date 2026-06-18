/**
 * Server-Sent Events stream for live inbox updates.
 *
 * The browser can't talk to Supabase Realtime directly (RLS denies anon and we
 * have no Supabase Auth), so this route subscribes server-side with the service
 * role client and forwards row changes as SSE. The client uses EventSource,
 * which auto-reconnects; we also cap the connection lifetime and the UI polls
 * as a fallback, so updates are never missed.
 */

import { requireAdminRoute } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = await requireAdminRoute();
  if (!auth.ok) return auth.response;

  const mailboxId = new URL(req.url).searchParams.get("mailboxId");
  if (!mailboxId || !/^[0-9a-f-]{36}$/i.test(mailboxId)) {
    return Response.json(
      { error: { code: "invalid_input", message: "Valid mailboxId is required" } },
      { status: 400 }
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return Response.json(
      { error: { code: "internal", message: "Database unavailable" } },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* controller already closed */
        }
      };
      const send = (event: string, data: unknown) =>
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      send("ready", { mailboxId });

      const channel = sb
        .channel(`email-inbox:${mailboxId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "email_messages",
            filter: `mailbox_id=eq.${mailboxId}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
            send("message", {
              eventType: payload.eventType,
              id: row.id,
              folder: row.folder,
              unread: row.unread,
              direction: row.direction,
            });
          }
        )
        .subscribe();

      const heartbeat = setInterval(() => enqueue(": ping\n\n"), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        void sb.removeChannel(channel);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
