"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader, Mail, RefreshCw, Copy, Check } from "lucide-react";
import type { SiteLeadRow } from "@/lib/leads/site-leads-types";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PopupSubsCRM() {
  const [subs, setSubs] = useState<SiteLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/leads/popup");
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Could not load popup subs");
    setSubs(body.subs as SiteLeadRow[]);
    setSupabaseOk(!!body.supabase);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  const updateNotes = async (id: string, notes: string) => {
    await fetch(`/api/admin/leads/site/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    await load();
  };

  const copyEmails = async () => {
    const list = subs.map((s) => s.email).join(", ");
    await navigator.clipboard.writeText(list);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-brand-gray py-8">
        <Loader className="w-4 h-4 animate-spin" />
        Loading popup subscribers…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-brand-gold/10 border border-brand-gold/25 text-brand-gold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-white font-medium">Before You Leave — Field Guide</p>
            <p className="text-xs text-brand-gray mt-0.5">
              Password-protected e-guide signups. Each subscriber gets a unique access code (stored hashed in Supabase).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {subs.length > 0 ? (
            <button
              type="button"
              onClick={() => void copyEmails()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border text-[10px] font-mono uppercase text-brand-gray hover:text-brand-gold"
            >
              {copied === "all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copy all emails
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border text-[10px] font-mono uppercase text-brand-gray hover:text-brand-gold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {supabaseOk === false ? (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Supabase is not configured — set <code className="text-brand-gold">SUPABASE_URL</code> and{" "}
          <code className="text-brand-gold">SUPABASE_SERVICE_ROLE_KEY</code>, then run{" "}
          <code className="text-brand-gold">supabase/site-inquiry-crm.sql</code>. Subs still append to{" "}
          <code className="text-brand-gold">.data/leads.jsonl</code> locally.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {subs.length === 0 ? (
        <p className="text-xs text-brand-gray py-8 text-center border border-dashed border-brand-border rounded-xl">
          No popup subscribers yet. Submit the exit-intent form on the homepage (mouse toward the browser tab bar)
          to test — or check <code className="text-brand-gold">.data/leads.jsonl</code> if Supabase isn&apos;t wired.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-brand-border bg-brand-panel/80 text-[9px] font-mono uppercase tracking-wider text-brand-gray">
                <th className="px-4 py-3 font-normal">Name</th>
                <th className="px-4 py-3 font-normal">Email</th>
                <th className="px-4 py-3 font-normal">Offer / Page</th>
                <th className="px-4 py-3 font-normal">Tags</th>
                <th className="px-4 py-3 font-normal">Signed up</th>
                <th className="px-4 py-3 font-normal">Notes</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => {
                const p = sub.payload;
                const offer = (p.offer as string) ?? "Kootenay Field Guide";
                const page = (p.page as string) ?? "/";
                return (
                  <tr key={sub.id} className="border-b border-brand-border/60 hover:bg-brand-charcoal/30">
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{sub.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${sub.email}`}
                        className="inline-flex items-center gap-1 text-brand-gold hover:underline font-mono"
                      >
                        <Mail className="w-3 h-3 shrink-0" />
                        {sub.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-brand-gray max-w-[200px]">
                      <span className="block text-white text-[11px]">{offer}</span>
                      <span className="font-mono text-[10px]">{page}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {sub.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-brand-black text-brand-gray border border-brand-border"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-gray whitespace-nowrap">
                      {fmtWhen(sub.createdAt)}
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <input
                        type="text"
                        defaultValue={sub.notes ?? ""}
                        placeholder="Notes…"
                        className="w-full bg-brand-black border border-brand-border rounded px-2 py-1 text-[10px] text-white"
                        onBlur={(e) => {
                          if (e.target.value !== (sub.notes ?? "")) {
                            void updateNotes(sub.id, e.target.value);
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[9px] font-mono text-brand-gray border-t border-brand-border">
            {subs.length} subscriber{subs.length === 1 ? "" : "s"} · source: exit_intent
          </p>
        </div>
      )}
    </div>
  );
}
