/**
 * GET /r/[slug] — public QR tracking redirect.
 *
 * Branded QR codes encode this short link. Each hit records a scan row in
 * Supabase (total + unique-by-ip-hash), then 302-redirects the visitor to the
 * destination the admin chose. Unknown / archived slugs fall back to the home
 * page so a printed code is never a dead end.
 */

import {
  recordScanAndGetDestination,
  hashVisitor,
} from "@/lib/admin/qr-codes";
import { clientIP } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveTarget(destination: string, base: string): string {
  try {
    // Absolute URLs pass through; relative paths resolve against this site.
    return new URL(destination, base).toString();
  } catch {
    return base;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const base = new URL(req.url).origin;

  let destination: string | null = null;
  try {
    destination = await recordScanAndGetDestination({
      slug,
      userAgent: req.headers.get("user-agent"),
      referer: req.headers.get("referer"),
      ipHash: hashVisitor(clientIP(req), req.headers.get("user-agent")),
    });
  } catch (err) {
    console.error("[qr redirect]", err);
  }

  const target = destination ? resolveTarget(destination, base) : base;

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
