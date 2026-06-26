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

  // --- 2b. Customer confirmation email (Resend, optional) -------------------
  // Only when we have a REAL customer inbox (not our synthetic placeholder) and
  // the lead is a booking — so customers get exactly one clean confirmation.
  if (process.env.RESEND_API_KEY && shouldConfirmCustomer(lead)) {
    try {
      await sendCustomerConfirmationEmail(lead);
    } catch (err) {
      errors.push(`customer-email: ${(err as Error).message}`);
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

// -----------------------------------------------------------------------------
// Payload shape (quote-wizard v2) + humanizers — so emails read like English,
// not raw JSON.
// -----------------------------------------------------------------------------

interface LeadPayload {
  stage?: string;
  projectType?: string;
  description?: string;
  location?: string;
  timeline?: string;
  fundingChoice?: string;
  budgetRange?: string;
  preferredDate?: string;
  preferredTime?: string;
  photoCount?: number;
  photoNotes?: string[];
  aiQuote?: {
    estimate?: { minUSD?: number; maxUSD?: number };
    timelineWeeks?: { min?: number; max?: number };
  } | null;
}

const PROJECT_LABELS: Record<string, string> = {
  deck: "Deck / Patio",
  fence: "Fence",
  pergola: "Pergola",
  garage: "Garage / Shed",
  addition: "Reno / Addition",
  bathroom: "Bathroom",
  tiling: "Tiling",
  interlock: "Interlock",
  flooring: "Flooring",
  other: "Custom project",
};

const TIMELINE_LABELS: Record<string, string> = {
  asap: "As soon as possible",
  summer: "This summer",
  "6months": "3–6 months",
  planning: "Just exploring",
};

const FUNDING_LABELS: Record<string, string> = {
  ready: "Funds ready to go",
  open: "Open to fair pricing",
  financing: "Interested in financing",
  exploring: "Getting a ballpark",
};

const usd = (n?: number) =>
  typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "";

/** Only confirm to customers who gave a real inbox and actually booked a visit. */
function shouldConfirmCustomer(lead: LeadInput): boolean {
  const email = lead.contact.email?.trim().toLowerCase();
  if (!email || email.endsWith("@inquiry.blacktimber.ca")) return false;
  const p = (lead.payload ?? {}) as LeadPayload;
  return p.stage === "booked";
}

// -----------------------------------------------------------------------------
// Internal notification email — clean, scannable, no raw JSON.
// -----------------------------------------------------------------------------
function renderEmailHtml(lead: LeadInput): string {
  const p = (lead.payload ?? {}) as LeadPayload;
  const isBooking = p.stage === "booked";

  const contactRows: [string, string][] = [
    ["Name", lead.contact.name],
    ...(lead.contact.phone ? [["Phone", lead.contact.phone] as [string, string]] : []),
    ...(lead.contact.email && !lead.contact.email.endsWith("@inquiry.blacktimber.ca")
      ? [["Email", lead.contact.email] as [string, string]]
      : []),
    ...(lead.contact.address ? [["Address", lead.contact.address] as [string, string]] : []),
  ];

  const projectRows: [string, string][] = [
    ...(p.projectType ? [["Project", PROJECT_LABELS[p.projectType] ?? p.projectType] as [string, string]] : []),
    ...(p.location ? [["Location", p.location] as [string, string]] : []),
    ...(p.timeline ? [["Timeline", TIMELINE_LABELS[p.timeline] ?? p.timeline] as [string, string]] : []),
    ...(p.fundingChoice ? [["Funding", FUNDING_LABELS[p.fundingChoice] ?? p.fundingChoice] as [string, string]] : []),
    ...(p.budgetRange ? [["Budget", p.budgetRange] as [string, string]] : []),
    ...(typeof p.photoCount === "number" ? [["Photos", `${p.photoCount} attached`] as [string, string]] : []),
  ];

  if (isBooking && p.preferredDate) {
    projectRows.unshift([
      "Requested visit",
      `${p.preferredDate}${p.preferredTime ? ` @ ${p.preferredTime}` : ""}`,
    ]);
  }

  if (p.aiQuote?.estimate?.minUSD != null && p.aiQuote?.estimate?.maxUSD != null) {
    projectRows.push(["AI estimate", `${usd(p.aiQuote.estimate.minUSD)} – ${usd(p.aiQuote.estimate.maxUSD)}`]);
  }

  const descBlock = p.description
    ? section("What they need", `<p style="margin:0;color:#eee;font-size:14px;line-height:1.6;">${escapeHtml(p.description)}</p>`)
    : "";

  const notesBlock =
    p.photoNotes && p.photoNotes.length
      ? section(
          "Photo notes",
          `<ul style="margin:0;padding-left:18px;color:#ddd;font-size:13px;line-height:1.6;">${p.photoNotes
            .map((n) => `<li>${escapeHtml(n)}</li>`)
            .join("")}</ul>`
        )
      : "";

  const heading = isBooking ? "New Site-Visit Booking" : "New Quote Request";
  const accent = isBooking ? "#22c55e" : "#c5a880";

  return `<!doctype html><html><body style="background:#0b0a09;margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="display:inline-block;background:${accent};color:#0b0a09;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:6px 12px;border-radius:6px;">${heading}</div>
      <p style="color:#888;font-size:12px;margin:10px 0 20px;">Received ${new Date().toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium", timeStyle: "short" })} (MT)</p>

      ${block("Customer", tableHtml(contactRows))}
      ${descBlock}
      ${block("Project Details", tableHtml(projectRows))}
      ${notesBlock}

      <p style="font-size:11px;color:#777;margin-top:24px;border-top:1px solid #2a2a2a;padding-top:14px;">
        Reply to this email to reach ${escapeHtml(lead.contact.name)} directly${
          lead.contact.phone ? ` · or call ${escapeHtml(lead.contact.phone)}` : ""
        }.
      </p>
    </div>
  </body></html>`;
}

// -----------------------------------------------------------------------------
// Customer confirmation email — branded, warm, reassuring.
// -----------------------------------------------------------------------------
async function sendCustomerConfirmationEmail(lead: LeadInput): Promise<void> {
  await sendResendEmail({
    to: lead.contact.email,
    subject: "We got your request — Black Timber Contracting",
    html: renderCustomerConfirmationHtml(lead),
  });
}

function renderCustomerConfirmationHtml(lead: LeadInput): string {
  const p = (lead.payload ?? {}) as LeadPayload;
  const firstName = lead.contact.name.trim().split(/\s+/)[0] || "there";
  const project = p.projectType ? (PROJECT_LABELS[p.projectType] ?? "your project").toLowerCase() : "your project";
  const visitLine =
    p.preferredDate
      ? `<p style="color:#eee;font-size:15px;line-height:1.6;margin:0 0 16px;">We've got you down for a free site visit on <strong style="color:#c5a880;">${escapeHtml(
          p.preferredDate
        )}${p.preferredTime ? ` at ${escapeHtml(p.preferredTime)}` : ""}</strong>. Jaryd will confirm by phone or text shortly.</p>`
      : "";
  const financingLine =
    p.fundingChoice === "financing"
      ? `<p style="color:#eee;font-size:15px;line-height:1.6;margin:0 0 16px;"><strong style="color:#c5a880;">Financing:</strong> You mentioned you're interested in payment options — good news, we offer financing and Jaryd will walk you through it. No pressure.</p>`
      : "";

  return `<!doctype html><html><body style="background:#0b0a09;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png" alt="Black Timber Contracting" style="height:64px;width:auto;" />
      </div>

      <div style="background:#141312;border:1px solid #2a2a2a;border-radius:16px;padding:28px;">
        <h1 style="color:#fff;font-size:20px;margin:0 0 16px;">Thanks, ${escapeHtml(firstName)} — we've got it.</h1>
        <p style="color:#eee;font-size:15px;line-height:1.6;margin:0 0 16px;">
          Your request for <strong style="color:#c5a880;">${escapeHtml(project)}</strong>${
            p.location ? ` in ${escapeHtml(p.location)}` : ""
          } has landed with our team.
        </p>
        ${visitLine}
        ${financingLine}
        <p style="color:#eee;font-size:15px;line-height:1.6;margin:0 0 8px;"><strong style="color:#fff;">What happens next:</strong></p>
        <ol style="color:#ddd;font-size:14px;line-height:1.7;margin:0 0 20px;padding-left:20px;">
          <li>Jaryd reviews your photos and details.</li>
          <li>We reach out to confirm timing for a free site visit.</li>
          <li>You get an exact, no-surprises quote — built to last.</li>
        </ol>

        <div style="text-align:center;margin:24px 0 8px;">
          <a href="tel:2509109071" style="display:inline-block;background:#c5a880;color:#0b0a09;font-weight:800;text-transform:uppercase;letter-spacing:1px;font-size:13px;text-decoration:none;padding:14px 28px;border-radius:10px;">Call or text: 250-910-9071</a>
        </div>
      </div>

      <p style="text-align:center;color:#666;font-size:11px;margin-top:20px;line-height:1.6;">
        Black Timber Contracting · Built Right. Built to Last.<br/>
        Cranbrook · Fernie · Sparwood · Elkford · Nelson
      </p>
    </div>
  </body></html>`;
}

// -----------------------------------------------------------------------------
// Small HTML helpers
// -----------------------------------------------------------------------------
function tableHtml(rows: [string, string][]): string {
  if (!rows.length) return "";
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:120px;vertical-align:top;">${escapeHtml(
          k
        )}</td><td style="padding:7px 0;color:#fff;font-weight:600;font-size:14px;">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;">${body}</table>`;
}

function block(title: string, inner: string): string {
  return `<div style="background:#141312;border:1px solid #2a2a2a;border-radius:12px;padding:18px 20px;margin-bottom:14px;">
    <div style="color:#c5a880;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">${escapeHtml(title)}</div>
    ${inner}
  </div>`;
}

function section(title: string, inner: string): string {
  return block(title, inner);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
