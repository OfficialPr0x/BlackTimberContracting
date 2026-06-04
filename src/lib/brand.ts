/**
 * Black Timber Contracting — brand tokens for admin documents (print/PDF).
 * Keep in sync with @theme in globals.css.
 */
export const BRAND = {
  gold: "#c5a880",
  goldHover: "#b39359",
  goldDark: "#8c714c",
  black: "#0b0a09",
  charcoal: "#141311",
  panel: "#1b1a17",
  border: "#2c2a25",
  gray: "#a8a29e",
  wood: "#4a3e35",
  /** Warm paper tint for subtle section backgrounds on print */
  paper: "#faf8f5",
  paperAccent: "#f3efe6",
} as const;

export type BrandDocumentKind = "quote" | "estimate" | "invoice";

export function documentKindLabel(kind: BrandDocumentKind): string {
  switch (kind) {
    case "invoice":
      return "Invoice";
    case "estimate":
      return "Estimate";
    default:
      return "Quote";
  }
}
