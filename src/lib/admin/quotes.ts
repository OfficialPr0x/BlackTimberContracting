/**
 * Admin quote storage — append-only JSONL.
 *
 * Why JSONL, not a real DB:
 *   - Black Timber doesn't have a database yet; adding one for this feature
 *     would be premature. JSONL on disk + grep is good enough for a one-
 *     person quote log, and it's trivial to migrate later (just iterate the
 *     file and INSERT).
 *   - Same pattern the leads sink already uses (.data/leads.jsonl). Keeps
 *     the operational surface area predictable.
 *   - Edits are stored as a NEW append with the same id and an updated
 *     `updatedAt` timestamp; `loadQuote(id)` returns the most recent entry
 *     so history is preserved without complicating the read path.
 *
 * Server-side totals are the source of truth — the client computes them for
 * UX, but `computeQuoteTotals` is recalculated on every save so a tampered
 * client can't write a wrong grand total.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { AiError } from "@/lib/openrouter/errors";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  loadQuoteSupabase,
  listQuotesSupabase,
  saveQuoteSupabase,
} from "./quotes-supabase";
import type {
  AdminDocumentType,
  AdminQuoteInput,
  AdminQuoteSaved,
  AdminQuoteTaxMode,
  AdminQuoteTotals,
  AdminQuoteLine,
} from "./schemas";

// Vercel serverless FS is read-only except /tmp — default JSONL path must not
// be ./.data on production or save returns 500.
const QUOTES_FILE =
  process.env.QUOTES_LOG_FILE ??
  (process.env.VERCEL ? "/tmp/quotes.jsonl" : "./.data/quotes.jsonl");
const GST_RATE = 0.05;
const PST_RATE = 0.07;

// -----------------------------------------------------------------------------
// Totals — server-side source of truth
// -----------------------------------------------------------------------------

/**
 * Compute every total field from raw line items + tax mode + freight.
 *
 * BC tax model (per src/lib/openrouter/supplier-knowledge.ts):
 *   real_property_install →  GST 5% on (subtotal + freight). NO PST shown
 *                            (Black Timber paid PST at the supplier).
 *   supply_only           →  GST 5% AND PST 7%, both on (subtotal + freight).
 *   mixed_split           →  Same as supply_only here — the UI flags that a
 *                            mixed contract should be split into TWO quotes.
 *                            We refuse to silently average; the conservative
 *                            default is "tax everything visible" until the
 *                            split is done by hand.
 *   exempt                →  GST 5%, no PST.
 *
 * Per CRA guidance, GST does NOT stack on top of PST in BC, so both taxes
 * are calculated on the same pre-tax base.
 */
export function computeQuoteTotals(
  lines: AdminQuoteLine[],
  taxMode: AdminQuoteTaxMode,
  freightCAD: number
): AdminQuoteTotals {
  const subtotalCAD = round2(
    lines.reduce((acc, l) => acc + l.quantity * l.unitPriceCAD, 0)
  );
  const taxableBase = round2(subtotalCAD + freightCAD);

  const gstCAD = round2(taxableBase * GST_RATE);
  const pstCAD =
    taxMode === "supply_only" || taxMode === "mixed_split"
      ? round2(taxableBase * PST_RATE)
      : 0;

  const grandTotalCAD = round2(taxableBase + gstCAD + pstCAD);

  // Lead time = max across any line that flagged one. 0 means everything is
  // stocked or doesn't carry an explicit lead time.
  let maxLeadTimeDays = 0;
  for (const l of lines) {
    if (typeof l.leadTimeDays === "number" && l.leadTimeDays > maxLeadTimeDays) {
      maxLeadTimeDays = l.leadTimeDays;
    }
  }

  return {
    subtotalCAD,
    freightCAD: round2(freightCAD),
    gstCAD,
    pstCAD,
    grandTotalCAD,
    maxLeadTimeDays,
  };
}

function round2(n: number): number {
  // Banker's rounding would be nice for currency, but Math.round is what
  // every other JS quoting tool does — keep behavior boringly consistent.
  return Math.round(n * 100) / 100;
}

// -----------------------------------------------------------------------------
// IDs and dates
// -----------------------------------------------------------------------------

/**
 * Generate a document id like `Q-20260602-AB3C` (quote), `E-...` (estimate),
 * or `I-...` (invoice). Date prefix sorts naturally; the 4-char suffix is
 * ~1.6M unique values per day — way more than a one-person business will
 * ever use. Different prefixes per document type let humans tell at a
 * glance whether a doc is a price commitment or a bill.
 */
export function generateQuoteId(
  docType: AdminDocumentType = "quote",
  now = new Date()
): string {
  const prefix = docType === "invoice" ? "I" : docType === "estimate" ? "E" : "Q";
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  // 3 random bytes → 24 bits → max 6 base36 chars; we slice to 4.
  const suffix = randomBytes(3)
    .toString("hex")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
  return `${prefix}-${yyyy}${mm}${dd}-${suffix}`;
}

function defaultValidUntil(now = new Date(), days = 7): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  // YYYY-MM-DD in UTC.
  return d.toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// Persistence (append-only JSONL, latest entry per id wins on read)
// -----------------------------------------------------------------------------

async function quotesFilePath(): Promise<string> {
  // turbopackIgnore mirrors the leads sink — keeps the NFT tracer from pulling
  // the entire repo into a serverless bundle just because we resolved a path.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), QUOTES_FILE);
}

async function appendLine(record: AdminQuoteSaved): Promise<void> {
  const abs = await quotesFilePath();
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.appendFile(abs, JSON.stringify(record) + "\n", "utf8");
}

/**
 * Persist a quote (new or update). Recomputes totals server-side; client
 * totals are ignored.
 */
export async function saveQuote(
  input: AdminQuoteInput,
  createdBy: string
): Promise<AdminQuoteSaved> {
  const now = new Date();
  const id = input.id ?? generateQuoteId(input.documentType, now);
  // Invoices: validUntil is interpreted as the payment-due date. Default 14d.
  // Quotes / estimates: 7-day price hold by default.
  const validUntil =
    input.validUntil ?? defaultValidUntil(now, input.documentType === "invoice" ? 14 : 7);

  // Normalize line ids — the client may have used "row-1" etc; we keep them
  // for round-trip stability but guarantee uniqueness per document.
  const seen = new Set<string>();
  const lines = input.lines.map((l, i) => {
    let lineId = l.id;
    if (!lineId || seen.has(lineId)) lineId = `${id}-L${i + 1}`;
    seen.add(lineId);
    return { ...l, id: lineId };
  });

  const totals = computeQuoteTotals(lines, input.taxMode, input.freightCAD);

  // Try to preserve original createdAt if this is an update.
  const existing = await loadQuote(id);
  const createdAt = existing?.createdAt ?? now.toISOString();

  const record: AdminQuoteSaved = {
    id,
    documentType: input.documentType,
    customer: input.customer,
    project: input.project,
    lines,
    taxMode: input.taxMode,
    freightCAD: round2(input.freightCAD),
    validUntil,
    status: input.status,
    internalNotes: input.internalNotes,
    paymentTerms: input.paymentTerms,
    paymentInstructions: input.paymentInstructions,
    totals,
    createdAt,
    updatedAt: now.toISOString(),
    createdBy,
  };

  if (isSupabaseConfigured()) {
    return saveQuoteSupabase(record);
  }

  try {
    await appendLine(record);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage:
        process.env.VERCEL && !isSupabaseConfigured()
          ? "Cannot save on Vercel without Supabase. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in project settings."
          : "Could not write quote file. Check server logs.",
      message: `Quote file write failed (${code ?? "unknown"}): ${(err as Error).message}`,
      cause: err,
    });
  }
  return record;
}

/**
 * Read every line and return the most recent entry for `id` (or null).
 * For a one-person business with hundreds of quotes per year this is cheap;
 * if it ever crosses tens of thousands, swap for an indexed store.
 */
export async function loadQuote(id: string): Promise<AdminQuoteSaved | null> {
  if (isSupabaseConfigured()) {
    return loadQuoteSupabase(id);
  }
  const all = await readAll();
  let latest: AdminQuoteSaved | null = null;
  for (const r of all) {
    if (r.id === id) latest = r;
  }
  return latest;
}

/**
 * Return the most recent version of every quote, sorted by updatedAt desc.
 * Optional `limit` for the recent-quotes sidebar.
 */
export async function listQuotes(limit?: number): Promise<AdminQuoteSaved[]> {
  if (isSupabaseConfigured()) {
    return listQuotesSupabase(limit ?? 50);
  }
  const all = await readAll();
  // Collapse to latest-per-id.
  const byId = new Map<string, AdminQuoteSaved>();
  for (const r of all) byId.set(r.id, r);
  const sorted = Array.from(byId.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

async function readAll(): Promise<AdminQuoteSaved[]> {
  const abs = await quotesFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: AdminQuoteSaved[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as AdminQuoteSaved);
    } catch {
      // Skip corrupt lines — never abort the whole list because of one bad row.
    }
  }
  return out;
}
