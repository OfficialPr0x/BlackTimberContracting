import "server-only";

import { loadQuote } from "@/lib/admin/quotes";
import { getFileNode } from "@/lib/admin/files/repository";
import type { EsignDocumentSnapshot } from "./types";

export async function snapshotFromQuoteId(
  documentId: string
): Promise<EsignDocumentSnapshot | null> {
  const quote = await loadQuote(documentId);
  if (!quote) return null;
  return { kind: "quote", quote };
}

export async function snapshotFromVaultFileId(
  fileId: string
): Promise<EsignDocumentSnapshot | null> {
  const node = await getFileNode(fileId);
  if (!node?.textContent) return null;
  return {
    kind: "markdown",
    title: node.name,
    content: node.textContent,
  };
}

export function defaultTitleFromSnapshot(snap: EsignDocumentSnapshot): string {
  if (snap.kind === "quote") {
    const t =
      snap.quote.documentType === "invoice"
        ? "Invoice"
        : snap.quote.documentType === "estimate"
        ? "Estimate"
        : "Quote";
    return `${t} ${snap.quote.id} — ${snap.quote.customer.name}`;
  }
  if (snap.kind === "markdown") return snap.title.replace(/\.md$/i, "");
  return "Agreement";
}
