import { clearGuideSession } from "@/lib/guide/session";

export const runtime = "nodejs";

export async function POST() {
  await clearGuideSession();
  return Response.json({ ok: true });
}
