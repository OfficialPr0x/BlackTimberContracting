/**
 * Address + subject parsing helpers. Pure functions, safe on client or server.
 */

export interface ParsedAddress {
  name: string | null;
  address: string;
}

/**
 * Parse a single address that may be in "Name <email@x.com>" or "email@x.com"
 * form. Returns a lowercased address; name is preserved as-is (trimmed).
 */
export function parseAddress(input: string): ParsedAddress {
  const raw = (input ?? "").trim();
  const angle = raw.match(/^(.*)<\s*([^<>]+?)\s*>$/);
  if (angle) {
    const name = angle[1].trim().replace(/^"|"$/g, "").trim();
    return { name: name || null, address: angle[2].trim().toLowerCase() };
  }
  return { name: null, address: raw.toLowerCase() };
}

/** Parse a comma/semicolon-separated address list. */
export function parseAddressList(input: string | string[] | null | undefined): ParsedAddress[] {
  if (!input) return [];
  const parts = Array.isArray(input)
    ? input
    : input.split(/[,;]+/);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parseAddress)
    .filter((p) => isValidEmail(p.address));
}

/** Just the lowercased addresses from a list. */
export function extractAddresses(input: string | string[] | null | undefined): string[] {
  return parseAddressList(input).map((p) => p.address);
}

export function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/** Format an address for a From/To header, quoting the name if present. */
export function formatAddress(address: string, name?: string | null): string {
  if (!name) return address;
  const needsQuote = /[",<>@]/.test(name);
  const safeName = needsQuote ? `"${name.replace(/"/g, "'")}"` : name;
  return `${safeName} <${address}>`;
}

/**
 * Strip leading Re:/Fwd:/Fw: tokens (any number, any case) to a normalized
 * subject used to coalesce a reply with its parent thread.
 */
export function normalizeSubject(subject: string | null | undefined): string {
  let s = (subject ?? "").trim();
  // Repeatedly strip a leading reply/forward prefix.
  // Matches "Re:", "RE :", "Fwd:", "FW:", "Re[2]:", etc.
  const prefix = /^(re|fwd?|aw|wg)(\[\d+\])?\s*:\s*/i;
  while (prefix.test(s)) {
    s = s.replace(prefix, "").trim();
  }
  return s.toLowerCase();
}

/** Build a "Re: ..." subject without doubling the prefix. */
export function replySubject(subject: string | null | undefined): string {
  const base = (subject ?? "").trim();
  return /^re\s*:/i.test(base) ? base : `Re: ${base}`;
}

/** Build a "Fwd: ..." subject without doubling the prefix. */
export function forwardSubject(subject: string | null | undefined): string {
  const base = (subject ?? "").trim();
  return /^fwd?\s*:/i.test(base) ? base : `Fwd: ${base}`;
}

/** Short preview text from an HTML or plain body. */
export function makeSnippet(html: string | null, text: string | null, max = 200): string {
  const source = text?.trim() || stripHtml(html ?? "");
  const collapsed = source.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}\u2026` : collapsed;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
