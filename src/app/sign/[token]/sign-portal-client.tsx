"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader } from "lucide-react";
import type { BusinessProfile } from "@/lib/business-config";
import type { EsignDocumentSnapshot, EsignStatus } from "@/lib/esign/types";
import SignDocumentBody from "@/components/esign/SignDocumentBody";
import SignaturePad from "@/components/esign/SignaturePad";

interface PortalPayload {
  id: string;
  title: string;
  status: EsignStatus;
  signerName: string;
  signerMessage: string | null;
  documentSnapshot: EsignDocumentSnapshot;
  signedAt: string | null;
}

export default function SignPortalClient({
  token,
  business,
}: {
  token: string;
  business: BusinessProfile;
}) {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sign/${encodeURIComponent(token)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load document");
        if (!cancelled) setData(body as PortalPayload);
        if (res.ok && body.status !== "signed") {
          await fetch(`/api/sign/${encodeURIComponent(token)}/view`, { method: "POST" });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (!signature || !consent) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${encodeURIComponent(token)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: signature, consentAccepted: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not complete signing");
      setData((prev) =>
        prev ? { ...prev, status: "signed", signedAt: body.signedAt as string } : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signing failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center text-brand-gray font-mono text-xs uppercase tracking-widest">
        <Loader className="w-5 h-5 animate-spin mr-2" /> Loading document…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center">
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.status === "signed") {
    return (
      <div className="max-w-lg mx-auto py-16 px-6 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <h1 className="text-xl text-white font-medium">Already signed</h1>
        <p className="text-sm text-brand-gray">
          <strong className="text-brand-gold">{data.title}</strong> was signed
          {data.signedAt
            ? ` on ${new Date(data.signedAt).toLocaleString("en-CA", { timeZone: "America/Vancouver" })}`
            : ""}
          . A confirmation was emailed to you.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[920px] mx-auto px-4 py-8 space-y-8">
      <header className="text-center sm:text-left">
        <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-brand-gold">
          {business.name}
        </p>
        <h1 className="text-xl sm:text-2xl text-white font-medium mt-1">{data.title}</h1>
        <p className="text-sm text-brand-gray mt-2">
          Prepared for <strong className="text-white">{data.signerName}</strong>
        </p>
        {data.signerMessage ? (
          <p className="text-sm text-brand-gray/90 mt-2 italic border-l-2 border-brand-gold/40 pl-3">
            {data.signerMessage}
          </p>
        ) : null}
      </header>

      <SignDocumentBody snapshot={data.documentSnapshot} business={business} />

      <section className="rounded-xl border border-brand-border bg-brand-charcoal/60 p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-widest text-brand-gold">
          Your signature
        </h2>
        <SignaturePad onChange={setSignature} disabled={submitting} />
        <label className="flex items-start gap-3 text-xs text-brand-gray cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 accent-brand-gold"
          />
          <span>
            I agree to sign this document electronically. My signature is binding, and I confirm I
            have reviewed the document above.
          </span>
        </label>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <button
          type="button"
          disabled={!signature || !consent || submitting}
          onClick={() => void submit()}
          className="w-full sm:w-auto px-8 py-3 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-xs font-mono uppercase tracking-widest font-bold disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Complete signing"}
        </button>
      </section>
    </div>
  );
}
