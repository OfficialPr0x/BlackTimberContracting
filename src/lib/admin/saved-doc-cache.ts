/**
 * Browser cache for a document just saved — bridges save → PDF open on Vercel
 * when the next request hits a different serverless instance before Supabase
 * is wired, or as a fast path while the DB round-trip completes.
 */

import type { AdminQuoteSaved } from "./schemas";

export const SAVED_DOC_STORAGE_PREFIX = "btc_admin_saved_doc_";

export function savedDocStorageKey(id: string): string {
  return `${SAVED_DOC_STORAGE_PREFIX}${id}`;
}

export function cacheSavedDocument(doc: AdminQuoteSaved): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(savedDocStorageKey(doc.id), JSON.stringify(doc));
  } catch {
    // Quota or private mode — PDF page will fall back to API/DB load.
  }
}

export function readCachedSavedDocument(id: string): AdminQuoteSaved | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(savedDocStorageKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as AdminQuoteSaved;
  } catch {
    return null;
  }
}
