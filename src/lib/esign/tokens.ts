import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** URL-safe signing token (plain text — only shown once to admin). */
export function generateSignToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSignToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
