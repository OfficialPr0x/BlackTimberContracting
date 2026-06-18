/**
 * Supabase Storage helpers for the private `email-attachments` bucket.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "email-attachments";

function sb() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase not configured for attachment storage.");
  return client;
}

/** Upload bytes; returns the storage object path. */
export async function uploadAttachment(
  path: string,
  bytes: ArrayBuffer | Uint8Array | Buffer,
  contentType: string
): Promise<string> {
  const body = bytes instanceof Buffer ? bytes : Buffer.from(bytes as ArrayBuffer);
  const { error } = await sb()
    .storage.from(BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  return path;
}

/** Create a short-lived signed URL for a stored object. */
export async function signedAttachmentUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, expiresInSec);
  if (error) throw new Error(`Storage sign: ${error.message}`);
  return data.signedUrl;
}

/** Download stored bytes (used by the download proxy). */
export async function downloadAttachment(path: string): Promise<ArrayBuffer> {
  const { data, error } = await sb().storage.from(BUCKET).download(path);
  if (error) throw new Error(`Storage download: ${error.message}`);
  return await data.arrayBuffer();
}

/** Sanitize a filename for use as a storage path segment. */
export function safeName(name: string | null | undefined, fallback = "file"): string {
  const base = (name ?? "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return base || fallback;
}
