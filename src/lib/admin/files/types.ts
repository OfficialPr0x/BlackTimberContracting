export type FileNodeKind = "folder" | "file";

export interface FileNodeRow {
  id: string;
  parentId: string | null;
  kind: FileNodeKind;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  hasText: boolean;
  updatedAt: string;
}

export interface FileNodeDetail extends FileNodeRow {
  textContent: string | null;
  storagePath: string | null;
  downloadUrl: string | null;
}

export interface FileTreeNode extends FileNodeRow {
  children: FileTreeNode[];
}

export function buildFileTree(flat: FileNodeRow[]): FileTreeNode[] {
  const byId = new Map<string, FileTreeNode>();
  const roots: FileTreeNode[] = [];

  for (const row of flat) {
    byId.set(row.id, { ...row, children: [] });
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export function guessViewer(
  mime: string | null,
  name: string
): "markdown" | "pdf" | "spreadsheet" | "image" | "text" | "binary" {
  const lower = name.toLowerCase();
  if (mime?.startsWith("image/")) return "image";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mime?.includes("spreadsheet") ||
    mime === "text/csv" ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv")
  ) {
    return "spreadsheet";
  }
  if (mime === "text/markdown" || lower.endsWith(".md")) return "markdown";
  if (mime?.startsWith("text/")) return "text";
  return "binary";
}
