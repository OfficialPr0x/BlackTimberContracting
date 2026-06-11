"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader, RefreshCw, ChevronDown, ChevronUp, Mail, Phone } from "lucide-react";
import type { SiteLeadRow, SiteLeadStatus } from "@/lib/leads/site-leads-types";

const STATUS_OPTIONS: SiteLeadStatus[] = [
  "new",
  "estimate",
  "booked",
  "contacted",
  "won",
  "lost",
];

const SOURCE_LABEL: Record<string, string> = {
  quote_wizard: "Quote Wizard",
  exit_intent: "Exit Intent",
  site_intel_report: "Property Intel",
  explain_price: "Pricing Engine",
  concierge_chat: "Concierge",
  footer: "Footer",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function usd(n: unknown): string {
  if (typeof n !== "number") return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function LeadSummary({ lead }: { lead: SiteLeadRow }) {
  const p = lead.payload;
  const projectType = p.projectType as string | undefined;
  const preferredDate = p.preferredDate as string | undefined;
  const preferredTime = p.preferredTime as string | undefined;
  const est = p.estimateDocument as { rangeMinUSD?: number; rangeMaxUSD?: number } | undefined;
  const ai = p.aiQuote as { estimate?: { minUSD: number; maxUSD: number } } | undefined;

  const min = est?.rangeMinUSD ?? ai?.estimate?.minUSD;
  const max = est?.rangeMaxUSD ?? ai?.estimate?.maxUSD;

  return (
    <div className="text-[10px] text-brand-gray space-y-0.5">
      {projectType ? <p>Project: <span className="text-white capitalize">{projectType}</span></p> : null}
      {min != null && max != null ? (
        <p>Estimate: <span className="text-brand-gold font-mono">{usd(min)} – {usd(max)}</span></p>
      ) : null}
      {preferredDate ? (
        <p>Booking: <span className="text-white font-mono">{preferredDate} {preferredTime ?? ""}</span></p>
      ) : null}
    </div>
  );
}

export default function SiteLeadsCRM() {
  const [leads, setLeads] = useState<SiteLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | SiteLeadStatus>("all");
  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/leads/site");
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Could not load site leads");
    setLeads(body.leads as SiteLeadRow[]);
    setSupabaseOk(!!body.supabase);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  const updateLead = async (id: string, patch: { status?: SiteLeadStatus; notes?: string }) => {
    await fetch(`/api/admin/leads/site/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  };

  const visible = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-brand-gray py-8">
        <Loader className="w-4 h-4 animate-spin" />
        Loading site inquiries…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-gray">
          Quote wizard AI estimates and consultation bookings (popup emails are under Popup Subs).
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border text-[10px] font-mono uppercase text-brand-gray hover:text-brand-gold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUS_OPTIONS] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`text-[9px] font-mono uppercase px-2 py-1 rounded border ${
              filter === s
                ? "border-brand-gold/50 text-brand-gold bg-brand-gold/10"
                : "border-brand-border text-brand-gray"
            }`}
          >
            {s === "all" ? `All (${leads.length})` : s}
          </button>
        ))}
      </div>

      {supabaseOk === false ? (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Supabase not configured — run <code className="text-brand-gold">supabase/site-inquiry-crm.sql</code> and
          set env keys. Leads still log to <code className="text-brand-gold">.data/leads.jsonl</code> locally.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-xs text-brand-gray py-6 text-center border border-dashed border-brand-border rounded-xl">
          No quotes or bookings yet. Complete the quote wizard on the site to test.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((lead) => (
            <li
              key={lead.id}
              className="rounded-xl border border-brand-border bg-brand-charcoal/40 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{lead.name}</p>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-brand-panel text-brand-gold border border-brand-border">
                      {SOURCE_LABEL[lead.source] ?? lead.source}
                    </span>
                    {lead.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-brand-black text-brand-gray border border-brand-border"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-brand-gray">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {lead.email}
                    </span>
                    {lead.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {lead.phone}
                      </span>
                    ) : null}
                    <span className="font-mono">{fmtWhen(lead.createdAt)}</span>
                  </div>
                  <LeadSummary lead={lead} />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={lead.status}
                    onChange={(e) => void updateLead(lead.id, { status: e.target.value as SiteLeadStatus })}
                    className="bg-brand-black border border-brand-border rounded px-2 py-1 text-[10px] font-mono text-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                    className="p-1.5 rounded border border-brand-border text-brand-gray hover:text-brand-gold"
                  >
                    {expanded === lead.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {expanded === lead.id ? (
                <div className="space-y-2 pt-2 border-t border-brand-border/60">
                  <textarea
                    defaultValue={lead.notes ?? ""}
                    placeholder="Internal notes…"
                    rows={2}
                    className="w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-xs text-white resize-y"
                    onBlur={(e) => {
                      if (e.target.value !== (lead.notes ?? "")) {
                        void updateLead(lead.id, { notes: e.target.value });
                      }
                    }}
                  />
                  <pre className="text-[10px] font-mono text-brand-gray bg-brand-black/60 rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(lead.payload, null, 2)}
                  </pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
