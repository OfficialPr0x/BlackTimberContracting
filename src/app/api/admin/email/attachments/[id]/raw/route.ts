import { requireAdminRoute } from "@/lib/admin/session";
import { emailErrorResponse } from "@/lib/email/http";
import { getAttachment } from "@/lib/email/repository";
import { getReceivingAttachment } from "@/lib/email/resend";
import { downloadAttachment } from "@/lib/email/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream an attachment's bytes. Prefers the persisted Storage copy; falls back
 * to a fresh Resend signed URL (their URLs expire after ~1h).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const att = await getAttachment(id);
    if (!att) {
      return Response.json(
        { error: { code: "not_found", message: "Attachment not found" } },
        { status: 404 }
      );
    }

    const forceDownload = new URL(req.url).searchParams.get("download") === "1";
    const disposition =
      forceDownload || att.contentDisposition !== "inline" ? "attachment" : "inline";
    const filename = (att.filename ?? "attachment").replace(/"/g, "");

    let bytes: ArrayBuffer;
    if (att.storagePath) {
      bytes = await downloadAttachment(att.storagePath);
    } else if (att.resendEmailId && att.resendAttachmentId) {
      const signed = await getReceivingAttachment(att.resendEmailId, att.resendAttachmentId);
      const res = await fetch(signed.downloadUrl);
      if (!res.ok) throw new Error(`Resend attachment fetch ${res.status}`);
      bytes = await res.arrayBuffer();
    } else {
      return Response.json(
        { error: { code: "not_found", message: "Attachment content unavailable" } },
        { status: 404 }
      );
    }

    return new Response(bytes, {
      headers: {
        "Content-Type": att.contentType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return emailErrorResponse(err);
  }
}
