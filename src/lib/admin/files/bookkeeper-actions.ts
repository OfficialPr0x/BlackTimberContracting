import "server-only";

import { z } from "zod";
import {
  createFolder,
  createMarkdownFile,
  listFileNodes,
} from "./repository";
import type { FileNodeRow } from "./types";
import { loadQuote } from "../quotes";
import {
  documentToVaultMarkdown,
  vaultArchiveFileName,
} from "../bookkeeper-documents";

export const BookkeeperVaultAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_folder"),
    name: z.string().min(1).max(255),
    /** Top-level or nested folder name, e.g. "Receipts" */
    parentFolderName: z.string().max(255).optional(),
  }),
  z.object({
    type: z.literal("create_markdown"),
    name: z.string().min(1).max(255),
    content: z.string().max(120_000),
    parentFolderName: z.string().max(255).optional(),
  }),
  z.object({
    type: z.literal("archive_document"),
    /** Q-/E-/I- ID from admin quotes — server writes accurate snapshot to vault */
    documentId: z.string().regex(/^[QEI]-\d{8}-[A-Z0-9]{4}$/),
    parentFolderName: z.string().max(255).optional(),
  }),
]);

export type BookkeeperVaultAction = z.infer<typeof BookkeeperVaultAction>;

export const BookkeeperResponseSchema = z.object({
  reply: z.string().min(1).max(16_000),
  actions: z.array(BookkeeperVaultAction).max(8).default([]),
});

export type BookkeeperResponse = z.infer<typeof BookkeeperResponseSchema>;

export interface ExecutedVaultAction {
  type: "create_folder" | "create_markdown" | "archive_document";
  id: string;
  name: string;
  parentFolderName?: string;
  documentId?: string;
}

function resolveParentId(
  flat: FileNodeRow[],
  parentFolderName: string | undefined,
  defaultParentId: string | null
): string | null {
  if (parentFolderName?.trim()) {
    const needle = parentFolderName.trim().toLowerCase();
    const hit = flat.find(
      (n) => n.kind === "folder" && n.name.toLowerCase() === needle
    );
    if (hit) return hit.id;
  }
  return defaultParentId;
}

export async function executeVaultActions(
  actions: BookkeeperVaultAction[],
  defaultParentId: string | null
): Promise<{ executed: ExecutedVaultAction[]; errors: string[] }> {
  const executed: ExecutedVaultAction[] = [];
  const errors: string[] = [];
  let flat = await listFileNodes();

  for (const action of actions) {
    try {
      const parentId = resolveParentId(flat, action.parentFolderName, defaultParentId);

      if (action.type === "create_folder") {
        const node = await createFolder(action.name, parentId);
        executed.push({
          type: "create_folder",
          id: node.id,
          name: node.name,
          parentFolderName: action.parentFolderName,
        });
      } else if (action.type === "archive_document") {
        const doc = await loadQuote(action.documentId);
        if (!doc) {
          errors.push(`Document ${action.documentId} not found`);
          continue;
        }
        const archiveParentId = resolveParentId(
          flat,
          action.parentFolderName ?? "Quotes & Invoices",
          defaultParentId
        );
        const name = vaultArchiveFileName(doc);
        const node = await createMarkdownFile(
          name,
          archiveParentId,
          documentToVaultMarkdown(doc)
        );
        executed.push({
          type: "archive_document",
          id: node.id,
          name: node.name,
          parentFolderName: action.parentFolderName ?? "Quotes & Invoices",
          documentId: doc.id,
        });
      } else {
        const node = await createMarkdownFile(action.name, parentId, action.content);
        executed.push({
          type: "create_markdown",
          id: node.id,
          name: node.name,
          parentFolderName: action.parentFolderName,
        });
      }
      flat = await listFileNodes();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Action failed");
    }
  }

  return { executed, errors };
}

export function formatVaultTreeForPrompt(flat: FileNodeRow[]): string {
  const folders = flat.filter((n) => n.kind === "folder");
  if (folders.length === 0) return "(empty — use parentFolderName omitted for top level)";
  return folders
    .map((f) => {
      const parent =
        f.parentId == null
          ? "root"
          : folders.find((p) => p.id === f.parentId)?.name ?? "unknown";
      return `- ${f.name} (parent: ${parent})`;
    })
    .join("\n");
}
