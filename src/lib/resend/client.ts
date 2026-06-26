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

/**
 * Default "from" address. Sends as Jaryd at the verified blacktimber.ca domain.
 * Override with LEAD_FROM_EMAIL if needed. NOTE: the domain must be verified in
 * Resend (Dashboard → Domains) before real sends to customers will succeed.
 */
export function defaultFromEmail(): string {
  return process.env.LEAD_FROM_EMAIL?.trim() || "Jaryd · Black Timber <jaryd@blacktimber.ca>";
}
