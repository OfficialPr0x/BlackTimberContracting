/**
 * Send a test email through Resend (same as the Resend quickstart).
 *
 * Usage:
 *   1. In .env.local set:
 *        RESEND_API_KEY=re_your_real_key_here
 *        LEAD_NOTIFICATION_EMAIL=blacktimbercontracting@gmail.com
 *        LEAD_FROM_EMAIL=onboarding@resend.dev
 *   2. Run: npm run test:email
 */

import { Resend } from "resend";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const apiKey = process.env.RESEND_API_KEY?.trim();
if (!apiKey || apiKey.includes("xxxx")) {
  console.error(
    "Missing RESEND_API_KEY. Open .env.local and set RESEND_API_KEY=re_your_real_key (from resend.com/api-keys)."
  );
  process.exit(1);
}

const to = process.env.LEAD_NOTIFICATION_EMAIL?.trim() || "blacktimbercontracting@gmail.com";
const from = process.env.LEAD_FROM_EMAIL?.trim() || "onboarding@resend.dev";

const resend = new Resend(apiKey);

const { data, error } = await resend.emails.send({
  from,
  to: [to],
  subject: "Hello World — Black Timber test",
  html: "<p>Congrats on sending your <strong>first email</strong> from Black Timber Contracting!</p>",
});

if (error) {
  console.error("Resend error:", error);
  process.exit(1);
}

console.log("Email sent. Message id:", data?.id);
console.log("  from:", from);
console.log("  to:", to);
