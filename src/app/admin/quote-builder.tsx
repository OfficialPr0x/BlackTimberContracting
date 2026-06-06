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

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Sparkles,
  Save,
  Printer,
  Loader,
  AlertCircle,
  FileText,
  Calculator,
  Receipt,
  FileDown,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import {
  buildPreviewDocument,
  buildSavePayload,
  deriveScopeSummary,
  draftFromSavedQuote,
  PREVIEW_STORAGE_KEY,
  validateDraftForSave,
  type LineDraft,
} from "@/lib/admin/draft-helpers";
import { cacheSavedDocument } from "@/lib/admin/saved-doc-cache";
import type {
  AdminDocumentType,
  AdminQuoteCustomer,
  AdminQuoteParseOutput,
  AdminQuoteProject,
  AdminQuoteProjectType,
  AdminQuoteSaved,
  AdminQuoteTaxMode,
  QuoteLineSource,
  QuoteLineUom,
} from "@/lib/admin/schemas";
import CmdK from "./cmd-k";

interface RecentQuoteSummary {
  id: string;
  customerName: string;
  grandTotalCAD: number;
  updatedAt: string;
  status: string;
}

interface QuoteBuilderProps {
  initialRecentQuotes: RecentQuoteSummary[];
  /** Open builder with an existing document loaded for edit */
  editId?: string;
}

const DOC_STATUS_OPTIONS: AdminQuoteSaved["status"][] = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "paid",
];

const UOM_OPTIONS: QuoteLineUom[] = ["EA", "LF", "SQFT", "BX", "BG", "HR", "DAY", "LOT"];

const SOURCE_OPTIONS: { value: QuoteLineSource; label: string }[] = [
  { value: "fernie_hh_stocked", label: "Fernie HH (stocked)" },
  { value: "fernie_hh_special_order", label: "Fernie HH (special-order)" },
  { value: "other_supplier", label: "Other supplier" },
  { value: "labor", label: "Labor" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "other", label: "Other" },
];

// Project category options. Keep in sync with AdminQuoteProjectType in schemas.ts.
const PROJECT_TYPE_OPTIONS: { value: AdminQuoteProjectType; label: string }[] = [
  { value: "deck", label: "Deck" },
  { value: "pergola", label: "Pergola" },
  { value: "garage", label: "Garage" },
  { value: "addition", label: "Addition" },
  { value: "fence", label: "Fence" },
  { value: "renovation", label: "Renovation" },
  { value: "flooring", label: "Flooring" },
  { value: "roofing", label: "Roofing" },
  { value: "siding", label: "Siding" },
  { value: "interior_finish", label: "Interior finish" },
  { value: "structural_repair", label: "Structural repair" },
  { value: "other", label: "Other" },
];

// Document type metadata — drives the top-of-form tab bar, button labels,
// and copy in the totals panel.
const DOCUMENT_TYPE_OPTIONS: {
  value: AdminDocumentType;
  label: string;
  description: string;
  Icon: typeof FileText;
}[] = [
  {
    value: "quote",
    label: "Quote",
    description: "Formal price commitment, valid until a date.",
    Icon: FileText,
  },
  {
    value: "estimate",
    label: "Estimate",
    description: "Ballpark for the customer; may move with site conditions.",
    Icon: Calculator,
  },
  {
    value: "invoice",
    label: "Invoice",
    description: "Bill for completed or in-progress work, with payment terms.",
    Icon: Receipt,
  },
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

function defaultValidUntil(documentType: AdminDocumentType = "quote"): string {
  const d = new Date();
  // Invoices: payment-due date defaults to +14 days (Net 14). Quotes: 7-day hold.
  d.setDate(d.getDate() + (documentType === "invoice" ? 14 : 7));
  return d.toISOString().slice(0, 10);
}

export default function QuoteBuilder({ initialRecentQuotes, editId }: QuoteBuilderProps) {
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
  const [documentType, setDocumentType] = useState<AdminDocumentType>("quote");
  const [validUntil, setValidUntil] = useState<string>(defaultValidUntil("quote"));
  const [internalNotes, setInternalNotes] = useState<string>("");
  // Invoice-only fields. Stored even when not in invoice mode so users can
  // pre-fill them and switch to invoice without losing data.
  const [paymentTerms, setPaymentTerms] = useState<string>("Net 14");
  const [paymentInstructions, setPaymentInstructions] = useState<string>("");
  const [documentStatus, setDocumentStatus] = useState<AdminQuoteSaved["status"]>("draft");

  // ---- UI state ------------------------------------------------------------
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuoteSummary[]>(initialRecentQuotes);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  const applyQuoteToForm = useCallback((quote: AdminQuoteSaved) => {
    const d = draftFromSavedQuote(quote);
    setCustomer(d.customer);
    setProject(d.project);
    setLines(d.lines);
    setTaxMode(d.taxMode);
    setFreightCAD(d.freightCAD);
    setDocumentType(d.documentType);
    setValidUntil(d.validUntil);
    setInternalNotes(d.internalNotes);
    setPaymentTerms(d.paymentTerms);
    setPaymentInstructions(d.paymentInstructions);
    setDocumentStatus(d.status);
    setSavedQuoteId(quote.id);
    setError(null);
  }, []);

  const startNewDocument = useCallback(() => {
    setCustomer({ name: "", email: "", phone: "", billingAddress: "", jobSiteAddress: "" });
    setProject({ type: "deck", scopeSummary: "", lengthFt: undefined, widthFt: undefined });
    setLines([emptyLine()]);
    setTaxMode("real_property_install");
    setFreightCAD(0);
    setDocumentType("quote");
    setValidUntil(defaultValidUntil("quote"));
    setInternalNotes("");
    setPaymentTerms("Net 14");
    setPaymentInstructions("");
    setDocumentStatus("draft");
    setSavedQuoteId(null);
    setError(null);
    router.replace("/admin/quotes");
  }, [router]);

  const loadQuoteForEdit = useCallback(
    async (id: string) => {
      if (savedQuoteId === id && !loadingEdit) {
        router.replace(`/admin/quotes?edit=${encodeURIComponent(id)}`, { scroll: false });
        return;
      }
      setLoadingEdit(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/quotes/${encodeURIComponent(id)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load document");
        applyQuoteToForm(body as AdminQuoteSaved);
        router.replace(`/admin/quotes?edit=${encodeURIComponent(id)}`, { scroll: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoadingEdit(false);
      }
    },
    [applyQuoteToForm, loadingEdit, router, savedQuoteId]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      if (
        !confirm(
          `Delete ${id} permanently? This removes the document and any synced vault archives.`
        )
      ) {
        return;
      }
      setError(null);
      try {
        const res = await fetch(`/api/admin/quotes/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message ?? "Delete failed");
        setRecentQuotes((prev) => prev.filter((q) => q.id !== id));
        if (savedQuoteId === id) startNewDocument();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [router, savedQuoteId, startNewDocument]
  );

  useEffect(() => {
    if (editId) void loadQuoteForEdit(editId);
  }, [editId, loadQuoteForEdit]);

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

  const fillScopeFromLines = useCallback(() => {
    const derived = deriveScopeSummary(project, lines, documentType);
    setProject((p) => ({ ...p, scopeSummary: derived }));
  }, [documentType, lines, project]);

  const baseDraft = useMemo(
    () => ({
      documentType,
      customer,
      project,
      lines,
      taxMode,
      freightCAD,
      validUntil,
      internalNotes: internalNotes.trim() || undefined,
      paymentTerms,
      paymentInstructions,
      savedQuoteId,
      status: documentStatus,
    }),
    [
      customer,
      documentStatus,
      documentType,
      freightCAD,
      internalNotes,
      lines,
      paymentInstructions,
      paymentTerms,
      project,
      savedQuoteId,
      taxMode,
      validUntil,
    ]
  );

  // ---- Save (scope auto-filled from line items if blank) --------------------
  const handleSave = useCallback(
    async (statusOverride?: AdminQuoteSaved["status"]): Promise<string | null> => {
      const status = statusOverride ?? documentStatus;
      if (saving) return null;
      const check = validateDraftForSave(customer, lines);
      if (!check.ok) {
        setError(check.message);
        return null;
      }
      setError(null);
      setSaving(true);
      try {
        const scopeSummary = deriveScopeSummary(project, lines, documentType);
        setProject((p) => ({ ...p, scopeSummary }));

        const res = await fetch("/api/admin/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildSavePayload({
              ...baseDraft,
              project: { ...project, scopeSummary },
              status,
            })
          ),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error?.message ?? `Save failed (${res.status})`);
        }
        cacheSavedDocument(body as AdminQuoteSaved);
        setSavedQuoteId(body.id);
        setDocumentStatus(body.status as AdminQuoteSaved["status"]);
        router.replace(`/admin/quotes?edit=${encodeURIComponent(body.id)}`, { scroll: false });
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
        return body.id as string;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [baseDraft, customer, documentStatus, documentType, lines, project, router, saving]
  );

  const handlePreviewPdf = useCallback(() => {
    const check = validateDraftForSave(customer, lines);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    const doc = buildPreviewDocument({
      ...baseDraft,
      status: "draft",
    });
    try {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(doc));
      window.open("/admin/preview", "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open preview. Try saving first, then Open PDF.");
    }
  }, [baseDraft, customer, lines]);

  const handleSaveAndOpenPdf = useCallback(async () => {
    const id = await handleSave();
    if (id) window.open(`/admin/quotes/${id}`, "_blank", "noopener,noreferrer");
  }, [handleSave]);

  // Ctrl+S / Cmd+S quick save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  // ---- Cmd+K apply --------------------------------------------------------
  // Merges the AI's partial parse into our state. Rules:
  //   - Strings: only overwrite if currently empty (so we don't clobber the
  //     user's typing). Exception: docType, taxMode, freight always update if
  //     the AI explicitly returned them — those are the user's most likely
  //     "switch the form" intent.
  //   - Lines: append to the existing list (de-empties the placeholder row).
  const handleParseApply = useCallback((parsed: AdminQuoteParseOutput) => {
    if (parsed.documentType) {
      setDocumentType(parsed.documentType);
      setValidUntil((cur) =>
        // Reset the date if the doc type just changed and the user hadn't
        // touched it (heuristic: the date still equals one of the defaults).
        cur === defaultValidUntil("quote") || cur === defaultValidUntil("invoice")
          ? defaultValidUntil(parsed.documentType)
          : cur
      );
    }
    if (parsed.customer) {
      setCustomer((c) => ({
        name: c.name?.trim() ? c.name : parsed.customer?.name ?? c.name,
        email: c.email?.trim() ? c.email : parsed.customer?.email ?? c.email,
        phone: c.phone?.trim() ? c.phone : parsed.customer?.phone ?? c.phone,
        billingAddress: c.billingAddress?.trim()
          ? c.billingAddress
          : parsed.customer?.billingAddress ?? c.billingAddress,
        jobSiteAddress: c.jobSiteAddress?.trim()
          ? c.jobSiteAddress
          : parsed.customer?.jobSiteAddress ?? c.jobSiteAddress,
      }));
    }
    if (parsed.project) {
      setProject((p) => ({
        type: parsed.project?.type ?? p.type,
        scopeSummary: p.scopeSummary?.trim()
          ? p.scopeSummary
          : parsed.project?.scopeSummary ?? p.scopeSummary,
        lengthFt: p.lengthFt ?? parsed.project?.lengthFt,
        widthFt: p.widthFt ?? parsed.project?.widthFt,
        material: p.material?.trim() ? p.material : parsed.project?.material ?? p.material,
        notes: p.notes?.trim() ? p.notes : parsed.project?.notes ?? p.notes,
      }));
    }
    if (parsed.taxMode) setTaxMode(parsed.taxMode);
    if (typeof parsed.freightCAD === "number") setFreightCAD(parsed.freightCAD);
    if (parsed.lines && parsed.lines.length > 0) {
      const newLines: LineDraft[] = parsed.lines.map((l) => ({
        id: makeLineId(),
        description: l.description,
        quantity: l.quantity,
        uom: l.uom,
        unitPriceCAD: l.unitPriceCAD,
        source: l.source,
        leadTimeDays: l.leadTimeDays,
        notes: l.notes,
      }));
      setLines((prev) => {
        const onlyEmpty =
          prev.length === 1 &&
          prev[0].description.trim() === "" &&
          prev[0].unitPriceCAD === 0;
        return onlyEmpty ? newLines : [...prev, ...newLines];
      });
    }
  }, []);

  // Snapshot for the parser so it knows what fields are already filled.
  const parseFormSnapshot = useMemo(
    () => ({
      customer: {
        name: customer.name || undefined,
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        billingAddress: customer.billingAddress || undefined,
        jobSiteAddress: customer.jobSiteAddress || undefined,
      },
      project: {
        type: project.type,
        scopeSummary: project.scopeSummary || undefined,
        material: project.material || undefined,
      },
      taxMode,
      documentType,
      lineCount: lines.filter((l) => l.description.trim().length > 0).length,
    }),
    [customer, project, taxMode, documentType, lines]
  );

  // The active document type's metadata, used in JSX below to label things
  // like the action button and the "valid until" / "due date" field.
  const docTypeMeta = DOCUMENT_TYPE_OPTIONS.find((d) => d.value === documentType)!;
  const dateLabel =
    documentType === "invoice"
      ? "Payment due"
      : documentType === "estimate"
      ? "Estimate good until"
      : "Valid until";
  const sentLabel =
    documentType === "invoice"
      ? "Save & mark issued"
      : documentType === "estimate"
      ? "Save & mark sent"
      : "Save & mark sent";

  const editingLocked = !!savedQuoteId;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* ====================================================== Form ===== */}
      <div className="space-y-6">
        {loadingEdit ? (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-brand-border bg-brand-charcoal/40 text-sm text-brand-gray">
            <Loader className="w-4 h-4 animate-spin text-brand-gold" />
            Loading document…
          </div>
        ) : null}

        {savedQuoteId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-brand-gold/40 bg-brand-gold/10">
            <div className="flex items-center gap-2 min-w-0">
              <Pencil className="w-4 h-4 text-brand-gold shrink-0" />
              <span className="text-sm text-white truncate">
                Editing <span className="font-mono text-brand-gold">{savedQuoteId}</span>
              </span>
              <StatusPill status={documentStatus} />
            </div>
            <button
              type="button"
              onClick={startNewDocument}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-brand-border hover:border-brand-gold text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
            >
              <X className="w-3 h-3" />
              New document
            </button>
          </div>
        ) : null}

        {/* ---- Document type tab bar ---- */}
        <div className="flex flex-wrap items-stretch gap-2 p-1.5 rounded-xl border border-brand-border bg-brand-charcoal/40">
          {DOCUMENT_TYPE_OPTIONS.map((opt) => {
            const active = documentType === opt.value;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={editingLocked && !active}
                onClick={() => {
                  if (editingLocked) return;
                  setDocumentType(opt.value);
                  setValidUntil((cur) =>
                    cur === defaultValidUntil("quote") || cur === defaultValidUntil("invoice")
                      ? defaultValidUntil(opt.value)
                      : cur
                  );
                }}
                aria-pressed={active}
                title={editingLocked && !active ? "Document type is fixed after save" : undefined}
                className={`flex-1 min-w-[140px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-left transition-colors border ${
                  active
                    ? "bg-brand-gold/15 border-brand-gold text-brand-gold"
                    : editingLocked
                    ? "bg-transparent border-transparent text-brand-gray/40 cursor-not-allowed"
                    : "bg-transparent border-transparent text-brand-gray hover:text-white hover:bg-brand-black/30"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex flex-col">
                  <span className="text-xs font-mono uppercase tracking-widest font-bold">
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-brand-gray leading-tight mt-0.5">
                    {opt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

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
                {PROJECT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
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
              {/* Free text — flooring, roofing, siding all want their own */}
              {/* vocab. The supplier primer already grounds the AI. */}
              <input
                type="text"
                value={project.material ?? ""}
                onChange={(e) =>
                  setProject({
                    ...project,
                    material: e.target.value || undefined,
                  })
                }
                placeholder={
                  project.type === "flooring"
                    ? "LVP, hardwood, tile…"
                    : project.type === "roofing"
                    ? "asphalt, metal, synthetic…"
                    : project.type === "siding"
                    ? "Hardie, vinyl, cedar…"
                    : project.type === "interior_finish"
                    ? "drywall, paint, trim…"
                    : "PT, cedar, composite, mixed…"
                }
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Scope summary">
            <textarea
              value={project.scopeSummary}
              onChange={(e) => setProject({ ...project, scopeSummary: e.target.value })}
              className={`${inputCls} min-h-[88px] font-sans`}
              placeholder="Optional — leave blank and we auto-build from your line items when you save or preview PDF."
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={fillScopeFromLines}
                className="text-[10px] font-mono uppercase tracking-widest text-brand-gold hover:text-brand-gold-hover border border-brand-gold/40 rounded px-2.5 py-1"
              >
                Fill from line items
              </button>
              {!project.scopeSummary.trim() && lines.some((l) => l.description.trim()) ? (
                <span className="text-[10px] text-brand-gray self-center">
                  Will auto-fill on save
                </span>
              ) : null}
            </div>
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
            <Field label={dateLabel}>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </Field>
            <Field label="Status">
              <select
                value={documentStatus}
                onChange={(e) => setDocumentStatus(e.target.value as AdminQuoteSaved["status"])}
                className={inputCls}
              >
                {DOC_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Internal notes">
              <input
                type="text"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder={`Not shown on the ${docTypeMeta.label.toLowerCase()}`}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* ---- Invoice fields (invoice mode only) ---- */}
        {documentType === "invoice" ? (
          <Section title="Invoice details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Payment terms">
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Net 14"
                  className={inputCls}
                />
              </Field>
              <Field label="Payment instructions" colSpan={2}>
                <textarea
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="e.g., E-transfer to billing@blacktimbercontracting.ca&#10;Cheques payable to Black Timber Contracting Ltd."
                  className={`${inputCls} min-h-[72px] font-sans`}
                />
              </Field>
            </div>
            <p className="text-[10px] text-brand-gray font-mono mt-2">
              These appear on the printed invoice. GST# pulls from your BUSINESS_GST_NUMBER env var.
            </p>
          </Section>
        ) : null}

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
            Server recomputes totals on save. Customer-facing {docTypeMeta.label.toLowerCase()} appears at /admin/quotes/{savedQuoteId ?? "[id]"}.
          </p>
        </Section>

        {/* ---- Errors ---- */}
        {error ? (
          <div className="flex items-start gap-2 p-3 rounded-md border border-red-500/40 bg-red-500/10 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* ---- Action bar — save & branded PDF ---- */}
        <div className="sticky bottom-0 -mx-5 px-5 py-4 bg-brand-black/90 backdrop-blur border-t border-brand-border space-y-3">
          <p className="text-[10px] font-mono text-brand-gray uppercase tracking-widest">
            Branded PDF uses your logo + gold theme · Ctrl+S quick save
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-charcoal hover:bg-brand-panel border border-brand-border text-sm font-mono uppercase tracking-widest text-white transition-colors disabled:opacity-50"
            >
              {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {savedQuoteId ? "Update" : "Quick save"}
            </button>
            <button
              type="button"
              onClick={handlePreviewPdf}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/50 text-brand-gold text-sm font-mono uppercase tracking-widest font-bold transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview PDF
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndOpenPdf()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-sm font-mono uppercase tracking-widest font-bold transition-colors disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              Save &amp; open PDF
            </button>
            <button
              type="button"
              onClick={() => void handleSave("sent")}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-border hover:border-brand-gold text-sm font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {sentLabel}
            </button>
            {savedQuoteId ? (
              <>
                <a
                  href={`/admin/quotes/${savedQuoteId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-gold/40 hover:border-brand-gold text-sm font-mono uppercase tracking-widest text-brand-gold transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Open saved PDF
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ====================================================== Sidebar === */}
      <aside className="space-y-3">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-brand-gray mb-2">
            Saved documents
          </h2>
          <div className="border border-brand-border rounded-lg divide-y divide-brand-border/60 max-h-[70vh] overflow-y-auto">
            {recentQuotes.length === 0 ? (
              <p className="p-4 text-xs text-brand-gray">
                No documents yet. Build one and hit save.
              </p>
            ) : (
              recentQuotes.map((q) => {
                const isActive = savedQuoteId === q.id;
                return (
                  <div
                    key={q.id}
                    className={`px-3 py-2.5 transition-colors ${
                      isActive ? "bg-brand-gold/10" : "hover:bg-brand-charcoal/60"
                    }`}
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
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => void loadQuoteForEdit(q.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-brand-border hover:border-brand-gold text-[9px] font-mono uppercase tracking-wider text-brand-gray hover:text-brand-gold"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <a
                        href={`/admin/quotes/${q.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-brand-border hover:border-brand-gold text-[9px] font-mono uppercase tracking-wider text-brand-gray hover:text-brand-gold"
                      >
                        <FileDown className="w-3 h-3" />
                        PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => void deleteDocument(q.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 text-[9px] font-mono uppercase tracking-wider text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Floating Cmd+K command palette. Renders nothing until invoked, */}
      {/* and is hidden on print. */}
      <CmdK currentForm={parseFormSnapshot} onApply={handleParseApply} />
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
