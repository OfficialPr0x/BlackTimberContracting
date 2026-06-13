import { idToDocType } from "@/components/admin/BrandedDocument";
import type { AdminDocumentType } from "@/lib/admin/schemas";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function documentPdfFilename(input: {
  id: string;
  documentType?: AdminDocumentType;
  customerName?: string;
}): string {
  const kind = input.documentType ?? idToDocType(input.id);
  const customer = slugify(input.customerName ?? "client");
  const id = input.id.replace(/[^a-zA-Z0-9-]/g, "");
  return `black-timber-${kind}-${id}-${customer}.pdf`;
}

export function estimatePdfFilename(referenceId: string, projectType?: string): string {
  const project = slugify(projectType ?? "estimate");
  return `black-timber-estimate-${referenceId}-${project}.pdf`;
}
