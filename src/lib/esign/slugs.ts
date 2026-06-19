import "server-only";

import { randomBytes } from "node:crypto";

// Crockford-style base32 (lowercase, no i/l/o/u) — unambiguous in URLs + when
// read aloud over the phone. Used for both the signing slug and the reference.
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

/**
 * Branded, unguessable signing link id: `bt-` + 24 base32 chars (~120 bits).
 * High entropy means it can safely BE the bearer credential in /sign/<slug>.
 */
export function generateSignSlug(): string {
  return `bt-${base32(randomBytes(15))}`;
}

/**
 * Human-friendly document reference for emails / certificate, e.g.
 * `BT-2026-AB3CD`. Consistent, year-stamped format; random suffix avoids
 * needing a global sequence/counter while staying collision-resistant.
 */
export function generateDocumentNumber(now: Date = new Date()): string {
  const code = base32(randomBytes(4)).toUpperCase().slice(0, 5);
  return `BT-${now.getFullYear()}-${code}`;
}
