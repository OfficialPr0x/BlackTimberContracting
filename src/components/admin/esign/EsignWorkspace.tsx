"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Send,
  Ban,
  Loader,
  PenLine,
  Mail,
  Eye,
  CheckCircle2,
  Clock,
  Copy,
  RefreshCw,
} from "lucide-react";
import type { EsignEnvelopeDetail, EsignEnvelopeRow, EsignStatus } from "@/lib/esign/types";

const STATUS_STYLE: Record<EsignStatus, string> = {
  draft: "text-brand-gray border-brand-border",
  sent: "text-sky-300 border-sky-500/40",
  viewed: "text-amber-300 border-amber-500/40",
  signed: "text-emerald-300 border-emerald-500/40",
  void: "text-red-300 border-red-500/40",
  expired: "text-brand-gray border-brand-border",
};

function StatusIcon({ status }: { status: EsignStatus }) {
  if (status === "signed") return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === "viewed") return <Eye className="w-3.5 h-3.5" />;
  if (status === "sent") return <Mail className="w-3.5 h-3.5" />;
  return <Clock className="w-3.5 h-3.5" />;
}

export default function EsignWorkspace() {
  const [envelopes, setEnvelopes] = useState<EsignEnvelopeRow[]>([]);
  const [quotes, setQuotes] = useState<Array<{ id: string; customerName: string; status: string }>>(
    []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EsignEnvelopeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSignUrl, setLastSignUrl] = useState<string | null>(null);

  const [docId, setDocId] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerName, setSignerName] = useState("");
  const [message, setMessage] = useState("");
  const [requireAddress, setRequireAddress] = useState(false);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/admin/esign");
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Could not load envelopes");
    setEnvelopes(body.envelopes as EsignEnvelopeRow[]);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/esign/${id}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Could not load detail");
    setDetail(body.envelope as EsignEnvelopeDetail);
    setSelectedId(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [esignRes, quotesRes] = await Promise.all([
          fetch("/api/admin/esign"),
          fetch("/api/admin/quotes"),
        ]);
        const esignBody = await esignRes.json();
        const quotesBody = await quotesRes.json();
        if (esignRes.ok) setEnvelopes(esignBody.envelopes as EsignEnvelopeRow[]);
        if (quotesRes.ok) {
          const list = (quotesBody.quotes ?? quotesBody) as Array<{
            id: string;
            customer?: { name: string };
            status: string;
          }>;
          setQuotes(
            (Array.isArray(list) ? list : []).map((q) => ({
              id: q.id,
              customerName: q.customer?.name ?? "—",
              status: q.status,
            }))
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const createAndSend = async () => {
    if (!docId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/esign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "quote",
          documentId: docId,
          signerName: signerName || undefined,
          signerEmail: signerEmail || undefined,
          signerMessage: message || undefined,
          requireAddress,
          sendNow: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Create failed");
      if (body.signUrl) setLastSignUrl(body.signUrl as string);
      if (body.emailErrors?.length) {
        setError(`Sent with email warnings: ${(body.emailErrors as string[]).join("; ")}`);
      }
      await refreshList();
      await loadDetail(body.envelope.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(false);
    }
  };

  const resend = async (id: string) => {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/esign/${id}/send`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Send failed");
      if (body.signUrl) setLastSignUrl(body.signUrl as string);
      await refreshList();
      await loadDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setPending(false);
    }
  };

  const voidEnvelope = async (id: string) => {
    if (!confirm("Void this envelope? The signing link will stop working.")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/admin/esign/${id}/void`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? "Void failed");
      }
      await refreshList();
      await loadDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">E-Sign</p>
        <h1 className="text-xl sm:text-2xl font-medium text-white mt-0.5">
          Client signing portal
        </h1>
        <p className="text-xs text-brand-gray mt-1">
          Send quotes & agreements · Resend email notifications · Track sent, viewed, and signed
        </p>
      </header>

      {error ? (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {lastSignUrl ? (
        <div className="flex flex-wrap items-center gap-2 text-xs bg-brand-panel border border-brand-border rounded-lg px-3 py-2">
          <span className="text-brand-gray font-mono">Sign link (copy once):</span>
          <code className="text-brand-gold truncate max-w-[min(100%,320px)]">{lastSignUrl}</code>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(lastSignUrl)}
            className="p-1 text-brand-gold hover:bg-brand-gold/10 rounded"
            title="Copy link"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      <section className="rounded-xl border border-brand-border bg-brand-charcoal/50 p-4 space-y-3">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-gold flex items-center gap-2">
          <PenLine className="w-3.5 h-3.5" /> New envelope from quote
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-mono uppercase text-brand-gray">Document</span>
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className="mt-1 w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Select Q-/E-/I-…</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id} — {q.customerName} ({q.status})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase text-brand-gray">Signer name</span>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="From quote if empty"
              className="mt-1 w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase text-brand-gray">Signer email</span>
            <input
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="Required if not on quote"
              className="mt-1 w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-white text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-mono uppercase text-brand-gray">Message (optional)</span>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2 text-xs text-brand-gray cursor-pointer">
            <input
              type="checkbox"
              checked={requireAddress}
              onChange={(e) => setRequireAddress(e.target.checked)}
              className="accent-brand-gold"
            />
            <span>Require signer to enter a mailing address</span>
          </label>
        </div>
        <button
          type="button"
          disabled={pending || !docId}
          onClick={() => void createAndSend()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-xs font-mono uppercase font-bold disabled:opacity-40"
        >
          {pending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send for signature
        </button>
      </section>

      <div className="grid lg:grid-cols-5 gap-4 min-h-[320px]">
        <div className="lg:col-span-2 rounded-xl border border-brand-border bg-brand-charcoal/50 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-brand-border flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
              Envelopes
            </span>
            <button
              type="button"
              onClick={() => void refreshList().catch((e) => setError(e.message))}
              className="p-1 text-brand-gray hover:text-brand-gold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-brand-border/60">
            {loading ? (
              <p className="p-4 text-xs text-brand-gray font-mono">Loading…</p>
            ) : envelopes.length === 0 ? (
              <p className="p-4 text-xs text-brand-gray">No envelopes yet.</p>
            ) : (
              envelopes.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => void loadDetail(env.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-brand-panel transition-colors ${
                    selectedId === env.id ? "bg-brand-gold/10" : ""
                  }`}
                >
                  <p className="text-xs text-white truncate">{env.title}</p>
                  <p className="text-[10px] text-brand-gray mt-0.5 truncate">{env.signerEmail}</p>
                  <span
                    className={`inline-flex items-center gap-1 mt-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${STATUS_STYLE[env.status]}`}
                  >
                    <StatusIcon status={env.status} />
                    {env.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-brand-border bg-brand-charcoal/40 p-4">
          {!detail ? (
            <p className="text-sm text-brand-gray">Select an envelope to see the audit trail.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm text-white font-medium">{detail.title}</h3>
                <p className="text-xs text-brand-gray mt-1">
                  {detail.signerName} · {detail.signerEmail}
                </p>
                <p className="text-[10px] font-mono text-brand-gold mt-1 flex flex-wrap gap-x-3">
                  {detail.documentNumber ? <span>{detail.documentNumber}</span> : null}
                  {detail.sourceRef ? <span className="text-brand-gray">{detail.sourceRef}</span> : null}
                </p>
              </div>

              {detail.signUrl ? (
                <div className="flex flex-wrap items-center gap-2 text-[10px] bg-brand-panel border border-brand-border rounded-lg px-3 py-2">
                  <span className="text-brand-gray font-mono uppercase">Sign link</span>
                  <code className="text-brand-gold truncate max-w-[min(100%,280px)]">
                    {detail.signUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => detail.signUrl && void navigator.clipboard.writeText(detail.signUrl)}
                    className="p-1 text-brand-gold hover:bg-brand-gold/10 rounded"
                    title="Copy link"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <a
                    href={detail.signUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-brand-gold hover:bg-brand-gold/10 rounded"
                    title="Open signing page"
                  >
                    <Eye className="w-3 h-3" />
                  </a>
                </div>
              ) : null}

              {detail.signatureFields ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-300">
                    Signed by
                  </p>
                  <p className="text-xs text-white">
                    {detail.signatureFields.legalName}
                    {detail.signatureFields.title ? `, ${detail.signatureFields.title}` : ""}
                    {detail.signatureFields.company ? ` · ${detail.signatureFields.company}` : ""}
                  </p>
                  {detail.signatureFields.address ? (
                    <p className="text-[10px] text-brand-gray">{detail.signatureFields.address}</p>
                  ) : null}
                  <p className="text-[10px] text-brand-gray font-mono">
                    Dated {detail.signatureFields.dateSigned}
                  </p>
                </div>
              ) : null}
              <dl className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div>
                  <dt className="text-brand-gray uppercase">Sent</dt>
                  <dd className="text-white">{detail.sentAt ? fmt(detail.sentAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-brand-gray uppercase">Viewed</dt>
                  <dd className="text-white">{detail.viewedAt ? fmt(detail.viewedAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-brand-gray uppercase">Signed</dt>
                  <dd className="text-white">{detail.signedAt ? fmt(detail.signedAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-brand-gray uppercase">Expires</dt>
                  <dd className="text-white">{detail.expiresAt ? fmt(detail.expiresAt) : "—"}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {detail.status !== "signed" && detail.status !== "void" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void resend(detail.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-gold/40 text-brand-gold text-[10px] font-mono uppercase"
                  >
                    <Send className="w-3 h-3" /> Resend email
                  </button>
                ) : null}
                {detail.status !== "signed" && detail.status !== "void" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void voidEnvelope(detail.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 text-[10px] font-mono uppercase"
                  >
                    <Ban className="w-3 h-3" /> Void
                  </button>
                ) : null}
              </div>
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-brand-gray mb-2">
                  Activity
                </h4>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {detail.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="text-[10px] font-mono text-brand-gray flex gap-2"
                    >
                      <span className="text-brand-gold shrink-0">{ev.eventType}</span>
                      <span className="text-white/80">{fmt(ev.createdAt)}</span>
                      <span className="truncate">{ev.actor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Vancouver",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
