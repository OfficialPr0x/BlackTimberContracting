/**
 * Mirror admin quotes/estimates/invoices into the vault folder "Quotes & Invoices".
 * The file tree only shows file_nodes — documents table is separate until synced.
 */

import "server-only";

import {
  createMarkdownFile,
  listFileNodes,
  updateMarkdownContent,
} from "./repository";
import type { FileNodeRow } from "./types";
import {
  documentToVaultMarkdown,
  fetchDocumentsForBookkeeper,
  vaultArchiveFileName,
} from "../bookkeeper-documents";
import { loadQuote } from "../quotes";

const QUOTES_FOLDER_NAME = "quotes & invoices";

export interface SyncDocumentsVaultResult {
  created: number;
  updated: number;
  skipped: number;
  totalDocuments: number;
  quotesFolderId: string | null;
  errors: string[];
}

function findQuotesFolderId(flat: FileNodeRow[]): string | null {
  const hit = flat.find(
    (n) => n.kind === "folder" && n.name.toLowerCase() === QUOTES_FOLDER_NAME
  );
  return hit?.id ?? null;
}

function findExistingArchive(
  flat: FileNodeRow[],
  parentId: string | null,
  docId: string
): FileNodeRow | undefined {
  return flat.find(
    (n) =>
      n.kind === "file" &&
      n.parentId === parentId &&
      (n.name.startsWith(`${docId}-`) || n.name.startsWith(`${docId}.`))
  );
}

export async function syncDocumentsToVault(): Promise<SyncDocumentsVaultResult> {
  const result: SyncDocumentsVaultResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    totalDocuments: 0,
    quotesFolderId: null,
    errors: [],
  };

  let flat = await listFileNodes();
  const parentId = findQuotesFolderId(flat);
  result.quotesFolderId = parentId;

  if (!parentId) {
    result.errors.push(
      'Vault folder "Quotes & Invoices" not found — run supabase/bookkeeping-vault.sql in Supabase.'
    );
    return result;
  }

  const summaries = await fetchDocumentsForBookkeeper(120);
  result.totalDocuments = summaries.length;

  for (const summary of summaries) {
    try {
      const doc = await loadQuote(summary.id);
      if (!doc) {
        result.errors.push(`${summary.id}: could not load`);
        continue;
      }

      const name = vaultArchiveFileName(doc);
      const content = documentToVaultMarkdown(doc);
      const existing = findExistingArchive(flat, parentId, doc.id);

      if (existing) {
        if (doc.updatedAt > existing.updatedAt) {
          await updateMarkdownContent(existing.id, content);
          result.updated += 1;
        } else {
          result.skipped += 1;
        }
      } else {
        await createMarkdownFile(name, parentId, content);
        result.created += 1;
        flat = await listFileNodes();
      }
    } catch (err) {
      result.errors.push(
        `${summary.id}: ${err instanceof Error ? err.message : "sync failed"}`
      );
    }
  }

  return result;
}
