/**
 * Resend client — server-only.
 *
 * Set RESEND_API_KEY in .env.local (replace re_xxxxxxxxx with your real key
 * from https://resend.com/api-keys).
 *
 * Never hard-code the API key in source files.
 */

import "server-only";
import { Resend } from "resend";

let cached: Resend | null | undefined;

export function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  return !!key && !key.includes("xxxx");
}

export function getResendClient(): Resend | null {
  if (cached !== undefined) return cached;

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || key.includes("xxxx")) {
    cached = null;
    return null;
  }

  cached = new Resend(key);
  return cached;
}

/** Default "from" — use onboarding@resend.dev until your domain is verified. */
export function defaultFromEmail(): string {
  return process.env.LEAD_FROM_EMAIL?.trim() || "onboarding@resend.dev";
}
