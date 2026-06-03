"use client";

/**
 * /admin quote-builder — client component.
 *
 * Two-pane layout:
 *   - Left  (lg): editable quote form (customer, project, line items, tax/freight, totals)
 *   - Right (lg): recent quotes sidebar (read-only list, click to open)
 *
 * On mobile the recent-quotes panel collapses below the form.
 *
 * Data flow:
 *   - All form state lives in this component.
 *   - "Suggest line items" hits POST /api/admin/quotes/suggest with the
 *     project scope; results merge into the lines table.
 *   - "Save" hits POST /api/admin/quotes; server recomputes totals (the
 *     client totals are UX-only) and returns the saved quote.
 *   - "Print" calls window.print(); a dedicated print stylesheet on
 *     /admin/quotes/[id] renders the quote cleanly. For draft prints we
 *     just print the page as-is.
 *
 * Currency: CAD throughout. Tax mode follows BC contractor rules per
 * src/lib/openrouter/supplier-knowledge.ts.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Sparkles,
  Save,
  Printer,
  ExternalLink,
  Loader,
  AlertCircle,
} from "lucide-react";
import type {
  AdminQuoteCustomer,
  AdminQuoteProject,
  AdminQuoteTaxMode,
  QuoteLineSource,
  QuoteLineUom,
} from "@/lib/admin/schemas";

interface RecentQuoteSummary {
  id: string;
  customerName: string;
  grandTotalCAD: number;
  updatedAt: string;
  status: string;
}

interface QuoteBuilderProps {
  initialRecentQuotes: RecentQuoteSummary[];
}

interface LineDraft {
  id: string;
  description: string;
  quantity: number;
  uom: QuoteLineUom;
  unitPriceCAD: number;
  source: QuoteLineSource;
  leadTimeDays?: number;
  notes?: string;
}

const UOM_OPTIONS: QuoteLineUom[] = ["EA", "LF", "SQFT", "BX", "BG", "HR", "DAY", "LOT"];

const SOURCE_OPTIONS: { value: QuoteLineSource; label: string }[] = [
  { value: "fernie_hh_stocked", label: "Fernie HH (stocked)" },
  { value: "fernie_hh_special_order", label: "Fernie HH (special-order)" },
  { value: "other_supplier", label: "Other supplier" },
  { value: "labor", label: "Labor" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "other", label: "Other" },
];

const TAX_MODE_OPTIONS: {
  value: AdminQuoteTaxMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "real_property_install",
    label: "Real-property install",
    hint: "BTC installs into real property. GST 5% only; PST is paid at the supplier and not shown.",
  },
  {
    value: "supply_only",
    label: "Supply only",
    hint: "Customer self-installs. GST 5% + PST 7% on materials and freight.",
  },
  {
    value: "mixed_split",
    label: "Mixed (split required)",
    hint: "Some installed, some supply-only. Split into two quotes. While mixed, both taxes apply visibly.",
  },
  {
    value: "exempt",
    label: "PST exempt",
    hint: "Customer holds a valid PST exemption (resale cert, etc.). GST 5%, no PST.",
  },
];

let nextLineId = 0;
function makeLineId(): string {
  nextLineId += 1;
  return `row-${Date.now()}-${nextLineId}`;
}

function emptyLine(): LineDraft {
  return {
    id: makeLineId(),
    description: "",
    quantity: 1,
    uom: "EA",
    unitPriceCAD: 0,
    source: "other",
  };
}

const GST_RATE = 0.05;
const PST_RATE = 0.07;

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function QuoteBuilder({ initialRecentQuotes }: QuoteBuilderProps) {
  const router = useRouter();

  // ---- Form state ----------------------------------------------------------
  const [customer, setCustomer] = useState<AdminQuoteCustomer>({
    name: "",
    email: "",
    phone: "",
    billingAddress: "",
    jobSiteAddress: "",
  });

  const [project, setProject] = useState<AdminQuoteProject>({
    type: "deck",
    scopeSummary: "",
    lengthFt: undefined,
    widthFt: undefined,
    material: undefined,
    notes: undefined,
  });

  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [taxMode, setTaxMode] = useState<AdminQuoteTaxMode>("real_property_install");
  const [freightCAD, setFreightCAD] = useState<number>(0);
  const [validUntil, setValidUntil] = useState<string>(defaultValidUntil());
  const [internalNotes, setInternalNotes] = useState<string>("");

  // ---- UI state ------------------------------------------------------------
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuoteSummary[]>(initialRecentQuotes);

  // ---- Live totals (UX only — server is source of truth) -------------------
  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (acc, l) => acc + (Number.isFinite(l.quantity) ? l.quantity : 0) * (Number.isFinite(l.unitPriceCAD) ? l.unitPriceCAD : 0),
      0
    );
    const taxableBase = subtotal + (Number.isFinite(freightCAD) ? freightCAD : 0);
    const gst = taxableBase * GST_RATE;
    const pst =
      taxMode === "supply_only" || taxMode === "mixed_split" ? taxableBase * PST_RATE : 0;
    return {
      subtotal,
      taxableBase,
      gst,
      pst,
      grand: taxableBase + gst + pst,
    };
  }, [lines, freightCAD, taxMode]);

  const maxLeadTime = useMemo(
    () => lines.reduce((m, l) => (l.leadTimeDays && l.leadTimeDays > m ? l.leadTimeDays : m), 0),
    [lines]
  );

  // ---- Line ops ------------------------------------------------------------
  const updateLine = useCallback((id: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);
  const removeLine = useCallback((id: string) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== id)));
  }, []);
  const addLine = useCallback(() => setLines((prev) => [...prev, emptyLine()]), []);

  // ---- AI suggest ----------------------------------------------------------
  const handleSuggest = useCallback(async () => {
    if (suggesting) return;
    if (project.scopeSummary.trim().length < 8) {
      setError("Add a project scope summary (at least 8 characters) before asking the AI to suggest lines.");
      return;
    }
    setError(null);
    setAiNote(null);
    setSuggesting(true);
    try {
      const res = await fetch("/api/admin/quotes/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: project.scopeSummary,
          project,
          location: customer.jobSiteAddress || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Suggest failed (${res.status})`);
      }
      const suggested: LineDraft[] = (body.lines as LineDraft[]).map((l) => ({
        ...l,
        id: makeLineId(),
      }));
      // Replace placeholder empty rows; otherwise append.
      setLines((prev) => {
        const onlyEmpty = prev.length === 1 && prev[0].description.trim() === "" && prev[0].unitPriceCAD === 0;
        return onlyEmpty ? suggested : [...prev, ...suggested];
      });
      if (typeof body.suggestedFreightCAD === "number" && body.suggestedFreightCAD > 0) {
        setFreightCAD((prev) => (prev > 0 ? prev : body.suggestedFreightCAD));
      }
      if (body.notes) setAiNote(body.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suggest line items.");
    } finally {
      setSuggesting(false);
    }
  }, [customer.jobSiteAddress, project, suggesting]);

  // ---- Save ---------------------------------------------------------------
  const handleSave = useCallback(
    async (status: "draft" | "sent") => {
      if (saving) return;
      if (!customer.name.trim()) {
        setError("Customer name is required to save a quote.");
        return;
      }
      if (!project.scopeSummary.trim()) {
        setError("Project scope summary is required.");
        return;
      }
      if (lines.length === 0) {
        setError("Add at least one line item.");
        return;
      }
      setError(null);
      setSaving(true);
      try {
        const res = await fetch("/api/admin/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: savedQuoteId ?? undefined,
            customer: {
              ...customer,
              email: customer.email?.trim() || undefined,
              phone: customer.phone?.trim() || undefined,
              billingAddress: customer.billingAddress?.trim() || undefined,
              jobSiteAddress: customer.jobSiteAddress?.trim() || undefined,
            },
            project,
            lines,
            taxMode,
            freightCAD,
            validUntil,
            status,
            internalNotes: internalNotes.trim() || undefined,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error?.message ?? `Save failed (${res.status})`);
        }
        setSavedQuoteId(body.id);
        // Optimistically prepend / update in the recents list.
        setRecentQuotes((prev) => {
          const filtered = prev.filter((q) => q.id !== body.id);
          return [
            {
              id: body.id,
              customerName: body.customer.name,
              grandTotalCAD: body.totals.grandTotalCAD,
              updatedAt: body.updatedAt,
              status: body.status,
            },
            ...filtered,
          ].slice(0, 25);
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save quote.");
      } finally {
        setSaving(false);
      }
    },
    [
      customer,
      freightCAD,
      internalNotes,
      lines,
      project,
      router,
      saving,
      savedQuoteId,
      taxMode,
      validUntil,
    ]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* ====================================================== Form ===== */}
      <div className="space-y-6">
        {/* ---- Customer ---- */}
        <Section title="Customer">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" required>
              <input
                type="text"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className={inputCls}
                placeholder="Example Contracting Ltd."
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className={inputCls}
                placeholder="contact@example.com"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className={inputCls}
                placeholder="250-555-1234"
              />
            </Field>
            <Field label="Billing address">
              <input
                type="text"
                value={customer.billingAddress}
                onChange={(e) => setCustomer({ ...customer, billingAddress: e.target.value })}
                className={inputCls}
                placeholder="Street, city, postal"
              />
            </Field>
            <Field label="Job site address" colSpan={2}>
              <input
                type="text"
                value={customer.jobSiteAddress}
                onChange={(e) => setCustomer({ ...customer, jobSiteAddress: e.target.value })}
                className={inputCls}
                placeholder="If different from billing"
              />
            </Field>
          </div>
        </Section>

        {/* ---- Project ---- */}
        <Section title="Project">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Type">
              <select
                value={project.type}
                onChange={(e) =>
                  setProject({ ...project, type: e.target.value as AdminQuoteProject["type"] })
                }
                className={inputCls}
              >
                <option value="deck">Deck</option>
                <option value="pergola">Pergola</option>
                <option value="garage">Garage</option>
                <option value="addition">Addition</option>
                <option value="fence">Fence</option>
                <option value="renovation">Renovation</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Length (ft)">
              <input
                type="number"
                step="0.5"
                min={0}
                value={project.lengthFt ?? ""}
                onChange={(e) =>
                  setProject({
                    ...project,
                    lengthFt: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Width (ft)">
              <input
                type="number"
                step="0.5"
                min={0}
                value={project.widthFt ?? ""}
                onChange={(e) =>
                  setProject({
                    ...project,
                    widthFt: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Material">
              <select
                value={project.material ?? ""}
                onChange={(e) =>
                  setProject({
                    ...project,
                    material: (e.target.value || undefined) as AdminQuoteProject["material"],
                  })
                }
                className={inputCls}
              >
                <option value="">—</option>
                <option value="treated">Pressure-treated</option>
                <option value="cedar">Cedar</option>
                <option value="composite">Composite</option>
                <option value="mixed">Mixed</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Scope summary" required>
            <textarea
              value={project.scopeSummary}
              onChange={(e) => setProject({ ...project, scopeSummary: e.target.value })}
              className={`${inputCls} min-h-[88px] font-sans`}
              placeholder="e.g., 16x12 cedar deck attached to existing house, 36-inch railings, two helical piles, two steps to grade. Job site is in Fernie."
              required
            />
          </Field>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting || project.scopeSummary.trim().length < 8}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold/15 hover:bg-brand-gold/25 disabled:opacity-50 disabled:cursor-not-allowed border border-brand-gold/40 text-brand-gold text-xs font-mono uppercase tracking-widest transition-colors"
            >
              {suggesting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {suggesting ? "Drafting..." : "AI: suggest line items"}
            </button>
            <span className="text-[11px] text-brand-gray self-center">
              Grounded in Fernie HH PRO ballparks. Always edit before sending.
            </span>
          </div>
          {aiNote ? (
            <div className="mt-2 p-3 rounded-md border border-brand-gold/30 bg-brand-charcoal/60 text-[11px] text-brand-gray font-mono leading-relaxed">
              <strong className="text-brand-gold">AI notes:</strong> {aiNote}
            </div>
          ) : null}
        </Section>

        {/* ---- Line items ---- */}
        <Section
          title="Line items"
          right={
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border hover:border-brand-gold text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold transition-colors"
            >
              <Plus className="w-3 h-3" /> Add line
            </button>
          }
        >
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                  <th className="text-left font-normal py-2 pl-1 pr-2 w-8">#</th>
                  <th className="text-left font-normal py-2 px-2">Description</th>
                  <th className="text-right font-normal py-2 px-2 w-20">Qty</th>
                  <th className="text-left font-normal py-2 px-2 w-20">UOM</th>
                  <th className="text-right font-normal py-2 px-2 w-28">Unit CAD</th>
                  <th className="text-left font-normal py-2 px-2 w-44">Source</th>
                  <th className="text-right font-normal py-2 px-2 w-24">Line total</th>
                  <th className="py-2 pl-2 pr-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const lineTotal =
                    (Number.isFinite(line.quantity) ? line.quantity : 0) *
                    (Number.isFinite(line.unitPriceCAD) ? line.unitPriceCAD : 0);
                  return (
                    <tr key={line.id} className="border-t border-brand-border/40 align-top">
                      <td className="py-2 pl-1 pr-2 text-brand-gray font-mono text-xs pt-3">{idx + 1}</td>
                      <td className="py-2 px-1">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, { description: e.target.value })}
                          placeholder="e.g., 2x6x10 SPF kiln-dried"
                          className={`${inputCls} text-sm`}
                        />
                        <input
                          type="text"
                          value={line.notes ?? ""}
                          onChange={(e) => updateLine(line.id, { notes: e.target.value || undefined })}
                          placeholder="optional note"
                          className={`${inputCls} text-[11px] mt-1 text-brand-gray`}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.id, { quantity: Number(e.target.value) })
                          }
                          className={`${inputCls} text-right text-sm font-mono`}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <select
                          value={line.uom}
                          onChange={(e) =>
                            updateLine(line.id, { uom: e.target.value as QuoteLineUom })
                          }
                          className={`${inputCls} text-sm`}
                        >
                          {UOM_OPTIONS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPriceCAD}
                          onChange={(e) =>
                            updateLine(line.id, { unitPriceCAD: Number(e.target.value) })
                          }
                          className={`${inputCls} text-right text-sm font-mono`}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <select
                          value={line.source}
                          onChange={(e) =>
                            updateLine(line.id, { source: e.target.value as QuoteLineSource })
                          }
                          className={`${inputCls} text-sm`}
                        >
                          {SOURCE_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {line.source === "fernie_hh_special_order" ? (
                          <input
                            type="number"
                            min={0}
                            value={line.leadTimeDays ?? ""}
                            onChange={(e) =>
                              updateLine(line.id, {
                                leadTimeDays: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            }
                            placeholder="lead days"
                            className={`${inputCls} text-[11px] mt-1`}
                          />
                        ) : null}
                      </td>
                      <td className="py-2 px-1 text-right font-mono text-sm pt-3 text-white">
                        {fmtCAD(lineTotal)}
                      </td>
                      <td className="py-2 pl-1 pr-1 pt-3">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                          className="p-1.5 rounded-md text-brand-gray hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Remove line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---- Tax + freight + valid until ---- */}
        <Section title="Commercial">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tax mode" colSpan={3}>
              <select
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value as AdminQuoteTaxMode)}
                className={inputCls}
              >
                {TAX_MODE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-brand-gray mt-1.5">
                {TAX_MODE_OPTIONS.find((m) => m.value === taxMode)?.hint}
              </p>
            </Field>
            <Field label="Freight (CAD)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={freightCAD}
                onChange={(e) => setFreightCAD(Number(e.target.value))}
                className={`${inputCls} font-mono`}
              />
            </Field>
            <Field label="Valid until">
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </Field>
            <Field label="Internal notes">
              <input
                type="text"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Not shown on the quote"
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* ---- Totals ---- */}
        <Section title="Totals (live preview)">
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm font-mono max-w-md ml-auto">
            <dt className="text-brand-gray">Subtotal</dt>
            <dd className="text-right text-white">{fmtCAD(totals.subtotal)}</dd>
            <dt className="text-brand-gray">Freight</dt>
            <dd className="text-right text-white">{fmtCAD(freightCAD)}</dd>
            <dt className="text-brand-gray">GST 5%</dt>
            <dd className="text-right text-white">{fmtCAD(totals.gst)}</dd>
            <dt className="text-brand-gray">
              PST 7%
              {!(taxMode === "supply_only" || taxMode === "mixed_split") ? (
                <span className="text-[10px] ml-1 text-brand-gray/70">(not applied)</span>
              ) : null}
            </dt>
            <dd className="text-right text-white">{fmtCAD(totals.pst)}</dd>
            <dt className="text-brand-gold uppercase tracking-widest text-xs pt-1">Grand total</dt>
            <dd className="text-right text-brand-gold text-base font-bold pt-1">
              {fmtCAD(totals.grand)}
            </dd>
            {maxLeadTime > 0 ? (
              <>
                <dt className="text-brand-gray pt-1.5 text-xs uppercase tracking-widest">Lead time</dt>
                <dd className="text-right text-white pt-1.5 text-xs">
                  up to {maxLeadTime} business days
                </dd>
              </>
            ) : null}
          </dl>
          <p className="text-[10px] text-brand-gray mt-3 text-right font-mono">
            Server recomputes totals on save. Customer-facing quote appears at /admin/quotes/{savedQuoteId ?? "[id]"}.
          </p>
        </Section>

        {/* ---- Errors ---- */}
        {error ? (
          <div className="flex items-start gap-2 p-3 rounded-md border border-red-500/40 bg-red-500/10 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* ---- Action bar ---- */}
        <div className="flex flex-wrap gap-2 sticky bottom-0 -mx-5 px-5 py-3 bg-brand-black/85 backdrop-blur border-t border-brand-border">
          <button
            type="button"
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-charcoal hover:bg-brand-panel border border-brand-border text-sm font-mono uppercase tracking-widest text-white transition-colors disabled:opacity-50"
          >
            {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {savedQuoteId ? "Update draft" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => handleSave("sent")}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-sm font-mono uppercase tracking-widest font-bold transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Save & mark sent
          </button>
          {savedQuoteId ? (
            <>
              <a
                href={`/admin/quotes/${savedQuoteId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-border hover:border-brand-gold text-sm font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open print view
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-border hover:border-brand-gold text-sm font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Print this draft
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ====================================================== Sidebar === */}
      <aside className="space-y-3">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-brand-gray mb-2">
            Recent quotes
          </h2>
          <div className="border border-brand-border rounded-lg divide-y divide-brand-border/60 max-h-[70vh] overflow-y-auto">
            {recentQuotes.length === 0 ? (
              <p className="p-4 text-xs text-brand-gray">
                No quotes yet. Build one and hit save.
              </p>
            ) : (
              recentQuotes.map((q) => (
                <a
                  key={q.id}
                  href={`/admin/quotes/${q.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block px-3 py-2.5 hover:bg-brand-charcoal/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-brand-gold">{q.id}</span>
                    <StatusPill status={q.status} />
                  </div>
                  <div className="text-sm text-white truncate mt-0.5">{q.customerName}</div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-brand-gray mt-0.5">
                    <span>{new Date(q.updatedAt).toLocaleDateString("en-CA")}</span>
                    <span className="text-white">{fmtCAD(q.grandTotalCAD)}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// =============================================================================
// Small UI primitives
// =============================================================================

const inputCls =
  "w-full rounded-md bg-brand-charcoal border border-brand-border focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/40 outline-none px-2.5 py-1.5 text-sm text-white";

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-brand-border rounded-xl bg-brand-charcoal/40 p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-brand-gold">{title}</h2>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  colSpan,
  children,
}: {
  label: string;
  required?: boolean;
  colSpan?: number;
  children: React.ReactNode;
}) {
  return (
    <label
      className="block"
      style={colSpan ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : undefined}
    >
      <span className="block text-[10px] uppercase tracking-widest text-brand-gray mb-1.5">
        {label}
        {required ? <span className="text-brand-gold ml-1">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-brand-charcoal text-brand-gray border-brand-border",
    sent: "bg-brand-gold/15 text-brand-gold border-brand-gold/40",
    accepted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    declined: "bg-red-500/15 text-red-400 border-red-500/40",
  };
  const cls = map[status] ?? map.draft;
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest border ${cls}`}
    >
      {status}
    </span>
  );
}
