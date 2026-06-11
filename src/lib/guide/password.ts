import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

/** Human-friendly access code, e.g. KTN-A3F2-9B1C */
export function generateGuidePassword(): string {
  const chunk = () => randomBytes(2).toString("hex").toUpperCase();
  return `KTN-${chunk()}-${chunk()}`;
}

export function hashGuidePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyGuidePassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!salt || !hash) return false;
  try {
    const attempt = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(attempt, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
