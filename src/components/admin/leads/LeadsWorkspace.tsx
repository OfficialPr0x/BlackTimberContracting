"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Loader,
  Target,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Building2,
  CheckCircle2,
  XCircle,
  Inbox,
  BookOpen,
} from "lucide-react";
import SiteLeadsCRM from "@/components/admin/leads/SiteLeadsCRM";
import PopupSubsCRM from "@/components/admin/leads/PopupSubsCRM";
import {
  LeadCheckbox,
  LeadSelectionBar,
  useLeadSelection,
} from "@/components/admin/leads/LeadSelectionBar";
import Markdown from "@/components/Markdown";
import type { ProspectSearchOutput } from "@/lib/leads/prospect-schemas";
import type { ProspectLeadRow } from "@/lib/leads/prospect-types";

type Tab = "popup" | "site" | "find" | "pipeline";

const STATUS_OPTIONS = [
  "new",
  "researching",
  "contacted",
  "qualified",
  "partner",
  "passed",
] as const;

const FOCUS_PRESETS = [
  {
    label: "GCs & developers",
    focus:
      "General contractors, residential developers, and custom home builders in the East Kootenay for exterior/finish subcontracting.",
  },
  {
    label: "Design-build",
    focus:
      "Design-build and architect-led construction firms in Cranbrook, Fernie, Kimberley, Invermere for trade partnership.",
  },
  {
    label: "Multi-family / infill",
    focus:
      "Infill builders and small multi-family developers in BC interior needing deck, siding, and exterior specialists.",
  },
];

interface IntegrationConfig {
  openRouter: boolean;
  serpApi: boolean;
  gemini: boolean;
  supabase: boolean;
  prospectModel: string;
}

function ProspectCard({
  p,
  showSaveHint,
}: {
  p: ProspectSearchOutput["prospects"][number];
  showSaveHint?: boolean;
}) {
  return (
    <li className="rounded-xl border border-brand-border bg-brand-charcoal/40 p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{p.companyName}</p>
          <p className="text-[10px] text-brand-gray">
            {p.location ?? "—"} · {p.prospectType.replace(/_/g, " ")}
          </p>
        </div>
        <span
          className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
            p.fitScore >= 75
              ? "bg-emerald-500/20 text-emerald-300"
              : p.fitScore >= 50
              ? "bg-amber-500/20 text-amber-200"
              : "bg-brand-panel text-brand-gray"
          }`}
        >
          {p.fitScore}
        </span>
      </div>
      <p className="text-xs text-brand-gray leading-relaxed">{p.fitReason}</p>
      <p className="text-xs text-brand-gold/90">{p.collaborationAngle}</p>
      {p.portfolioMatchNotes ? (
        <p className="text-[10px] text-brand-gray/80 italic">{p.portfolioMatchNotes}</p>
      ) : null}
      {p.suggestedContact ? (
        <p className="text-[10px] font-mono text-brand-gray">Contact: {p.suggestedContact}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {p.website ? (
          <a
            href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-brand-gold hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Website
          </a>
        ) : null}
        {p.sourceUrl ? (
          <a
            href={p.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-brand-gray hover:text-brand-gold"
          >
            <ExternalLink className="w-3 h-3" /> Source
          </a>
        ) : null}
      </div>
      {showSaveHint ? (
        <p className="text-[9px] font-mono text-brand-gray">Saved to Pipeline if Supabase is connected.</p>
      ) : null}
    </li>
  );
}

export default function LeadsWorkspace() {
  const [tab, setTab] = useState<Tab>("popup");
  const [focus, setFocus] = useState(FOCUS_PRESETS[0]!.focus);
  const [region, setRegion] = useState("East Kootenay, BC");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<ProspectSearchOutput | null>(null);
  const [meta, setMeta] = useState<Record<string, boolean | string> | null>(null);
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [prospects, setProspects] = useState<ProspectLeadRow[]>([]);
  const [loadingPipeline, setLoadingPipeline] = useState(true);
  const [deletingProspects, setDeletingProspects] = useState(false);

  const prospectIds = prospects.map((p) => p.id);
  const prospectSelection = useLeadSelection(prospectIds);

  const loadPipeline = useCallback(async () => {
    const res = await fetch("/api/admin/leads/prospects");
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Could not load pipeline");
    setProspects(body.prospects as ProspectLeadRow[]);
  }, []);

  useEffect(() => {
    fetch("/api/admin/leads/config")
      .then((r) => r.json())
      .then((c) => setConfig(c as IntegrationConfig))
      .catch(() => null);
    loadPipeline()
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoadingPipeline(false));
  }, [loadPipeline]);

  const runSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus, region, saveResults: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? `Search failed (${res.status})`);
      const { meta: m, searchRunId, ...output } = body as ProspectSearchOutput & {
        meta?: Record<string, boolean>;
        searchRunId?: string;
      };
      setResult(output);
      setMeta({ ...(m ?? {}), searchRunId: searchRunId ?? "" });
      await loadPipeline();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/leads/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadPipeline();
  };

  const updateNotes = async (id: string, notes: string) => {
    await fetch(`/api/admin/leads/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    await loadPipeline();
  };

  const deleteSelectedProspects = async () => {
    const ids = [...prospectSelection.selected];
    if (!ids.length) return;
    if (
      !confirm(
        `Delete ${ids.length} prospect${ids.length === 1 ? "" : "s"} permanently? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingProspects(true);
    setError(null);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/admin/leads/prospects/${id}`, { method: "DELETE" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message ?? "Delete failed");
      }
      prospectSelection.clear();
      await loadPipeline();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingProspects(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">Leads</p>
        <h1 className="text-xl sm:text-2xl font-medium text-white mt-0.5">
          {tab === "popup"
            ? "Popup subscribers"
            : tab === "site"
              ? "Quotes & bookings"
              : "B2B prospect finder"}
        </h1>
        <p className="text-xs text-brand-gray mt-1">
          {tab === "popup"
            ? "Exit-intent email signups from the Before You Leave deck guide popup"
            : tab === "site"
              ? "AI quote wizard estimates and consultation bookings from the public site"
              : "Portfolio vision · SerpAPI · Perplexity web search — matched to what Black Timber actually builds"}
        </p>
      </header>

      {config ? (
        <div className="flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-wider">
          <StatusPill ok={config.openRouter} label="OpenRouter" />
          <StatusPill ok={config.serpApi} label="SerpAPI" />
          <StatusPill ok={config.gemini} label="Gemini vision" />
          <StatusPill ok={config.supabase} label="Supabase save" />
          <span className="text-brand-gray px-2 py-1 rounded border border-brand-border">
            {config.prospectModel.split("/").pop()}
          </span>
        </div>
      ) : null}

      <div className="flex gap-1 p-1 rounded-xl bg-brand-panel border border-brand-border w-fit">
        {(
          [
            ["popup", BookOpen, "Popup Subs"],
            ["site", Inbox, "Quotes & Bookings"],
            ["find", Search, "Find"],
            ["pipeline", Building2, `Pipeline (${prospects.length})`],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider ${
              tab === id ? "bg-brand-gold/20 text-brand-gold" : "text-brand-gray"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {tab === "popup" ? <PopupSubsCRM /> : null}
      {tab === "site" ? <SiteLeadsCRM /> : null}

      {tab === "find" ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-brand-border bg-brand-charcoal/50 p-4 space-y-4">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> AI prospect search
            </h2>
            <div className="flex flex-wrap gap-2">
              {FOCUS_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setFocus(preset.focus)}
                  className="text-[9px] font-mono uppercase px-2 py-1 rounded border border-brand-border text-brand-gray hover:border-brand-gold/40 hover:text-brand-gold"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-[10px] font-mono uppercase text-brand-gray">Focus</span>
              <textarea
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                rows={3}
                className="mt-1 w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-sm text-white resize-y"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase text-brand-gray">Region</span>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              type="button"
              disabled={searching}
              onClick={() => void runSearch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-xs font-mono uppercase font-bold disabled:opacity-40"
            >
              {searching ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              {searching ? "Searching…" : "Find prospects"}
            </button>
          </section>

          {result ? (
            <section className="space-y-4">
              <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
                <Markdown>{result.summary}</Markdown>
                {result.nextSteps?.length ? (
                  <ul className="mt-3 text-xs text-brand-gray space-y-1 list-disc pl-4">
                    {result.nextSteps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : null}
                {meta ? (
                  <p className="text-[9px] font-mono text-brand-gray mt-3">
                    Serp {meta.serpEnabled ? "✓" : "—"} · Web {meta.webSearchEnabled ? "✓" : "—"} ·
                    Vision {meta.portfolioBriefUsed ? "✓" : "—"}
                    {meta.searchRunId ? ` · run ${String(meta.searchRunId).slice(0, 8)}` : ""}
                  </p>
                ) : null}
              </div>
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                {result.prospects.length} prospects
              </h3>
              <ul className="space-y-3">
                {result.prospects.map((p, i) => (
                  <ProspectCard key={`${p.companyName}-${i}`} p={p} showSaveHint />
                ))}
              </ul>
              {prospects.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setTab("pipeline")}
                  className="text-xs font-mono uppercase text-brand-gold hover:underline"
                >
                  Open pipeline →
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "pipeline" ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
              Saved prospects
            </h2>
            <button
              type="button"
              onClick={() => void loadPipeline().catch((e) => setError(e.message))}
              className="p-1.5 text-brand-gray hover:text-brand-gold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <LeadSelectionBar
            selectedCount={prospectSelection.selectedCount}
            totalCount={prospects.length}
            allSelected={prospectSelection.allSelected}
            onToggleAll={prospectSelection.toggleAll}
            onDelete={deleteSelectedProspects}
            deleting={deletingProspects}
          />
          {loadingPipeline ? (
            <p className="text-xs text-brand-gray font-mono">Loading…</p>
          ) : prospects.length === 0 ? (
            <p className="text-sm text-brand-gray">
              No saved prospects yet. Run a search on Find, or run{" "}
              <code className="text-brand-gold text-xs">supabase/prospect-leads-schema.sql</code>.
            </p>
          ) : (
            <ul className="space-y-3">
              {prospects.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-brand-border bg-brand-charcoal/40 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <LeadCheckbox
                        checked={prospectSelection.selected.has(p.id)}
                        onChange={() => prospectSelection.toggle(p.id)}
                        ariaLabel={`Select ${p.companyName}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{p.companyName}</p>
                        <p className="text-[10px] text-brand-gray">
                          {p.location ?? "—"} · {p.prospectType.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        p.fitScore >= 75
                          ? "bg-emerald-500/20 text-emerald-300"
                          : p.fitScore >= 50
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-brand-panel text-brand-gray"
                      }`}
                    >
                      {p.fitScore}
                    </span>
                  </div>
                  <p className="text-xs text-brand-gray leading-relaxed">{p.fitReason}</p>
                  <p className="text-xs text-brand-gold/90">{p.collaborationAngle}</p>
                  {p.website ? (
                    <a
                      href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-brand-gold hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Website
                    </a>
                  ) : null}
                  <select
                    value={p.status}
                    onChange={(e) => void updateStatus(p.id, e.target.value)}
                    className="text-[10px] font-mono uppercase bg-brand-black border border-brand-border rounded px-2 py-1 text-brand-gray w-full sm:w-auto"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <textarea
                    defaultValue={p.notes ?? ""}
                    placeholder="Notes…"
                    rows={2}
                    onBlur={(e) => {
                      if (e.target.value !== (p.notes ?? "")) {
                        void updateNotes(p.id, e.target.value);
                      }
                    }}
                    className="w-full text-xs bg-brand-black border border-brand-border rounded-lg px-2 py-1.5 text-white resize-y"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
        ok
          ? "border-emerald-500/30 text-emerald-300"
          : "border-brand-border text-brand-gray"
      }`}
    >
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3 opacity-50" />}
      {label}
    </span>
  );
}
