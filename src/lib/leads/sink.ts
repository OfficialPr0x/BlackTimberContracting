/**
 * Lead delivery — multi-sink, fan-out with per-sink isolation.
 *
 * Design goals:
 *   - File sink ALWAYS runs (so a lead is never lost, even with zero env config).
 *   - Email + Slack only fire when their env vars are present.
 *   - One sink failing must NOT block the others. We accumulate errors and
 *     return a structured result.
 *   - Resend is dynamically imported so we don't add it to the bundle unless
 *     RESEND_API_KEY is set.
 *
 * To enable a sink, set the corresponding env vars in .env.local — see
 * `.env.local.example` for the exact names.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { logLead } from "../logger";
import type { LeadInput } from "../openrouter/schemas";
import { insertSiteLead } from "./site-leads-repository";

const FILE_PATH = process.env.LEAD_LOG_FILE ?? "./.data/leads.jsonl";

export interface DeliveryResult {
  delivered: { file: boolean; email: boolean; slack: boolean; database: boolean };
  errors: string[];
  leadId?: string | null;
}

export async function deliverLead(lead: LeadInput): Promise<DeliveryResult> {
  const errors: string[] = [];
  const delivered = { file: false, email: false, slack: false, database: false };

  // --- 1. File sink (always on — never lose a lead) -------------------------
  try {
    await appendToFile(lead);
    delivered.file = true;
  } catch (err) {
    errors.push(`file: ${(err as Error).message}`);
  }

  // --- 2. Email sink (Resend, optional) -------------------------------------
  if (process.env.RESEND_API_KEY && process.env.LEAD_NOTIFICATION_EMAIL) {
    try {
      await sendLeadNotificationEmail(lead);
      delivered.email = true;
    } catch (err) {
      errors.push(`email: ${(err as Error).message}`);
    }
  }

  // --- 3. Slack sink (webhook, optional) ------------------------------------
  if (process.env.SLACK_LEADS_WEBHOOK) {
    try {
      await postToSlack(lead);
      delivered.slack = true;
    } catch (err) {
      errors.push(`slack: ${(err as Error).message}`);
    }
  }

  let leadId: string | null = null;
  try {
    leadId = await insertSiteLead(lead, {
      file: delivered.file,
      email: delivered.email,
      slack: delivered.slack,
      errors,
    });
    if (leadId) delivered.database = true;
  } catch (err) {
    errors.push(`database: ${(err as Error).message}`);
  }

  logLead({ source: lead.source, email: lead.contact.email, delivered, errors, leadId });
  return { delivered, errors, leadId };
}

// -----------------------------------------------------------------------------
// File sink: append JSONL — easy to grep, import, or pipe later
// -----------------------------------------------------------------------------
async function appendToFile(lead: LeadInput): Promise<void> {
  // turbopackIgnore tells Next's NFT tracer not to follow this dynamic path —
  // otherwise it conservatively traces the whole project (including
  // next.config.ts) into the route's serverless bundle.
  const abs = path.resolve(/* turbopackIgnore: true */ process.cwd(), FILE_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), ...lead }) + "\n";
  await fs.appendFile(abs, line, "utf8");
}

// -----------------------------------------------------------------------------
// Email sink: Resend (see src/lib/resend/)
// -----------------------------------------------------------------------------
import { sendEmail as sendResendEmail } from "@/lib/resend/send-email";

async function sendLeadNotificationEmail(lead: LeadInput): Promise<void> {
  await sendResendEmail({
    to: process.env.LEAD_NOTIFICATION_EMAIL!,
    replyTo: lead.contact.email,
    subject: `New ${humanLabel(lead.source)} lead — ${lead.contact.name}`,
    html: renderEmailHtml(lead),
  });
}

// -----------------------------------------------------------------------------
// Slack sink: incoming webhook — POST text + attachment with payload
// -----------------------------------------------------------------------------
async function postToSlack(lead: LeadInput): Promise<void> {
  const url = process.env.SLACK_LEADS_WEBHOOK!;
  const summary = `*New ${humanLabel(lead.source)} lead* — ${lead.contact.name} <${lead.contact.email}>${
    lead.contact.phone ? ` · ${lead.contact.phone}` : ""
  }`;
  const payloadJson = lead.payload ? "```\n" + JSON.stringify(lead.payload, null, 2).slice(0, 2800) + "\n```" : "";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: summary,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: summary } },
        ...(lead.contact.address
          ? [{ type: "section", text: { type: "mrkdwn", text: `:round_pushpin: ${lead.contact.address}` } }]
          : []),
        ...(payloadJson
          ? [{ type: "section", text: { type: "mrkdwn", text: payloadJson } }]
          : []),
      ],
    }),
  });
  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function humanLabel(source: LeadInput["source"]): string {
  return {
    quote_wizard:       "Quote Wizard",
    site_intel_report:  "Property Intelligence",
    explain_price:      "Pricing Engine",
    concierge_chat:     "Concierge Chat",
    exit_intent:        "Exit Intent",
    footer:             "Footer",
  }[source];
}

function renderEmailHtml(lead: LeadInput): string {
  const rows: [string, string][] = [
    ["Source", humanLabel(lead.source)],
    ["Name", lead.contact.name],
    ["Email", lead.contact.email],
    ...(lead.contact.phone ? [["Phone", lead.contact.phone] as [string, string]] : []),
    ...(lead.contact.address ? [["Address", lead.contact.address] as [string, string]] : []),
    ["Received", new Date().toISOString()],
  ];

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px;color:#888;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(k)}</td><td style="padding:6px 14px;color:#fff;font-weight:600;">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  const payloadHtml = lead.payload
    ? `<pre style="background:#111;color:#c5a880;padding:16px;border-radius:8px;font-size:11px;overflow:auto;max-width:600px;">${escapeHtml(
        JSON.stringify(lead.payload, null, 2)
      )}</pre>`
    : "";

  return `<!doctype html><html><body style="background:#000;color:#fff;font-family:system-ui,sans-serif;padding:24px;">
    <h2 style="color:#c5a880;text-transform:uppercase;letter-spacing:2px;font-size:14px;">Black Timber — New Lead</h2>
    <table style="border-collapse:collapse;background:#0d0d0d;border:1px solid #2a2a2a;border-radius:8px;">${rowHtml}</table>
    ${payloadHtml}
    <p style="font-size:11px;color:#888;margin-top:24px;">Replying to this email goes straight to the customer.</p>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
