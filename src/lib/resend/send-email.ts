/**
 * Send a transactional email via Resend.
 */

import "server-only";
import { defaultFromEmail, getResendClient } from "./client";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  /** Defaults to LEAD_FROM_EMAIL or onboarding@resend.dev */
  from?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const client = getResendClient();
  if (!client) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to .env.local (replace re_xxxxxxxxx with your real key)."
    );
  }

  const to = Array.isArray(opts.to) ? opts.to : [opts.to];

  const { data, error } = await client.emails.send({
    from: opts.from ?? defaultFromEmail(),
    to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });

  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend: send succeeded but no message id returned.");
  }

  return { id: data.id };
}
