/**
 * Resend webhook endpoint (public, signature-verified).
 *
 * Configure in Resend → Webhooks with these events:
 *   email.received, email.sent, email.delivered, email.opened, email.clicked,
 *   email.bounced, email.complained, email.failed, email.delivery_delayed
 *
 * Set RESEND_WEBHOOK_SECRET to the webhook's signing secret (whsec_...).
 *
 * Resend delivers at-least-once and may retry / reorder; we dedupe on svix-id
 * and never regress a message's status on out-of-order events.
 */

import { ingestInboundEmail } from "@/lib/email/ingest";
import {
  markWebhookSeen,
  recordDeliverabilityEvent,
} from "@/lib/email/repository";
import { verifyWebhook } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Inbound ingestion fetches full content + attachments; give it room.
export const maxDuration = 60;

export async function POST(req: Request) {
  // 1) Raw body is required for signature verification.
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing Svix signature headers" }, { status: 400 });
  }

  // 2) Verify authenticity.
  let event;
  try {
    event = verifyWebhook(rawBody, {
      id: svixId,
      timestamp: svixTimestamp,
      signature: svixSignature,
    });
  } catch (err) {
    console.error("[email.webhook] verification failed", String(err));
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3) Dedupe on the unique delivery id. Already processed → ack with 200.
  try {
    const fresh = await markWebhookSeen(svixId, event.type);
    if (!fresh) return Response.json({ ok: true, deduped: true });
  } catch (err) {
    // If the dedupe store is down, fall through and process (idempotent inserts
    // protect inbound; deliverability is append + monotonic).
    console.warn("[email.webhook] dedupe check failed", String(err));
  }

  // 4) Dispatch.
  try {
    if (event.type === "email.received") {
      const { messageId } = await ingestInboundEmail(event.data.email_id);
      return Response.json({ ok: true, messageId });
    }

    if (event.type.startsWith("email.") && "email_id" in event.data) {
      await recordDeliverabilityEvent({
        resendEmailId: event.data.email_id,
        eventType: event.type,
        occurredAt: event.created_at ?? new Date().toISOString(),
        payload: event.data as unknown as Record<string, unknown>,
      });
      return Response.json({ ok: true });
    }

    // Other event types (contact.*/domain.*) are not handled here.
    return Response.json({ ok: true, ignored: event.type });
  } catch (err) {
    // Non-200 → Resend retries with backoff.
    console.error("[email.webhook] handler error", String(err));
    return Response.json({ error: "Handler error" }, { status: 500 });
  }
}
