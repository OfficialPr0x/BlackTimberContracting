import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

export interface QrCodeRow {
  id: string;
  slug: string;
  label: string;
  destination: string;
  archived: boolean;
  scanCount: number;
  uniqueScans: number;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Crockford-style base32 — unambiguous in URLs and when read aloud.
const B32 = "0123456789abcdefghjkmnpqrstvwxyz";

function base32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** Short, unguessable tracking slug, e.g. `q7h2k9pq` (~40 bits). */
export function generateQrSlug(): string {
  return base32(randomBytes(5));
}

/** One-way hash of the visitor IP (+ UA) for privacy-preserving unique counts. */
export function hashVisitor(ip: string, userAgent: string | null): string {
  const salt = process.env.QR_HASH_SALT ?? "bt-qr-static-salt";
  return createHash("sha256")
    .update(`${salt}:${ip}:${userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

export function isQrTrackingAvailable(): boolean {
  return isSupabaseConfigured();
}

interface StatsRow {
  id: string;
  slug: string;
  label: string;
  destination: string;
  archived: boolean;
  scan_count: number | null;
  last_scan_at: string | null;
  created_at: string;
  updated_at: string;
  total_scans: number | null;
  unique_scans: number | null;
}

function mapRow(r: StatsRow): QrCodeRow {
  return {
    id: r.id,
    slug: r.slug,
    label: r.label,
    destination: r.destination,
    archived: r.archived,
    scanCount: Number(r.total_scans ?? r.scan_count ?? 0),
    uniqueScans: Number(r.unique_scans ?? 0),
    lastScanAt: r.last_scan_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listQrCodes(includeArchived = false): Promise<QrCodeRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return [];

  let q = sb
    .from("qr_code_stats")
    .select(
      "id, slug, label, destination, archived, scan_count, last_scan_at, created_at, updated_at, total_scans, unique_scans"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (!includeArchived) q = q.eq("archived", false);

  const { data, error } = await q;
  if (error) {
    console.error("[listQrCodes]", error.message, "— run supabase/qr-codes.sql");
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as StatsRow));
}

export async function createQrCode(input: {
  label: string;
  destination: string;
}): Promise<QrCodeRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return null;

  // Retry a couple of times in the (extremely unlikely) event of a slug clash.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateQrSlug();
    const { data, error } = await sb
      .from("qr_codes")
      .insert({ slug, label: input.label, destination: input.destination })
      .select(
        "id, slug, label, destination, archived, scan_count, last_scan_at, created_at, updated_at"
      )
      .single();

    if (!error && data) {
      return mapRow({ ...(data as StatsRow), total_scans: 0, unique_scans: 0 });
    }
    // 23505 = unique_violation → try a fresh slug.
    if (error && error.code !== "23505") {
      console.error("[createQrCode]", error.message);
      return null;
    }
  }
  return null;
}

export async function setQrArchived(
  id: string,
  archived: boolean
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return false;
  const { error } = await sb
    .from("qr_codes")
    .update({ archived })
    .eq("id", id);
  if (error) {
    console.error("[setQrArchived]", error.message);
    return false;
  }
  return true;
}

export async function deleteQrCode(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return false;
  const { error } = await sb.from("qr_codes").delete().eq("id", id);
  if (error) {
    console.error("[deleteQrCode]", error.message);
    return false;
  }
  return true;
}

/**
 * Records a scan and returns the destination URL to redirect to, or null when
 * the slug is unknown / archived. Runs as a single atomic RPC.
 */
export async function recordScanAndGetDestination(input: {
  slug: string;
  userAgent: string | null;
  referer: string | null;
  ipHash: string | null;
}): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !isSupabaseConfigured()) return null;

  const { data, error } = await sb.rpc("record_qr_scan", {
    p_slug: input.slug,
    p_user_agent: input.userAgent,
    p_referer: input.referer,
    p_ip_hash: input.ipHash,
  });

  if (error) {
    console.error("[record_qr_scan]", error.message, "— run supabase/qr-codes.sql");
    return null;
  }
  return (data as string | null) ?? null;
}
