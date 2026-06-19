"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader, ShieldCheck } from "lucide-react";
import type { BusinessProfile } from "@/lib/business-config";
import type {
  EsignDocumentSnapshot,
  EsignSignatureFields,
  EsignStatus,
} from "@/lib/esign/types";
import SignDocumentBody from "@/components/esign/SignDocumentBody";
import TypedSignatureForm, {
  type TypedSignatureValue,
} from "@/components/esign/TypedSignatureForm";

interface PortalPayload {
  id: string;
  title: string;
  status: EsignStatus;
  documentNumber: string | null;
  requireAddress: boolean;
  signerName: string;
  signerEmail: string;
  signerMessage: string | null;
  documentSnapshot: EsignDocumentSnapshot;
  signatureFields: EsignSignatureFields | null;
  signedAt: string | null;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-CA", { timeZone: "America/Vancouver" });
  } catch {
    return iso;
  }
}

export default function SignPortalClient({
  slug,
  business,
}: {
  slug: string;
  business: BusinessProfile;
}) {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sig, setSig] = useState<TypedSignatureValue | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedFields, setSignedFields] = useState<EsignSignatureFields | null>(null);

  const consentText = useMemo(
    () =>
      `I agree to use electronic records and signatures. I understand my typed name and the information I provide constitute my legal electronic signature on "${data?.title ?? "this document"}" with ${business.legalName}, binding to the same extent as a handwritten signature under British Columbia's Electronic Transactions Act and applicable Canadian e-signature law. I confirm I have reviewed the document above.`,
    [data?.title, business.legalName]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sign/${encodeURIComponent(slug)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load document");
        if (!cancelled) {
          setData(body as PortalPayload);
          setSignedFields((body as PortalPayload).signatureFields);
        }
        if (res.ok && body.status !== "signed") {
          await fetch(`/api/sign/${encodeURIComponent(slug)}/view`, { method: "POST" });
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
  }, [slug]);

  const canSubmit = !!sig?.valid && !!sig?.signatureDataUrl && consent && !submitting;

  const submit = async () => {
    if (!sig?.valid || !sig.signatureDataUrl || !consent) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${encodeURIComponent(slug)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureDataUrl: sig.signatureDataUrl,
          consentAccepted: true,
          signatureFields: {
            legalName: sig.legalName,
            signatureText: sig.signatureText,
            signatureFont: sig.signatureFont,
            title: sig.title,
            company: sig.company,
            address: sig.address,
            dateSigned: sig.dateSigned,
            consentText,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not complete signing");
      setSignedFields({
        legalName: sig.legalName,
        signatureText: sig.signatureText,
        signatureFont: sig.signatureFont,
        title: sig.title,
        company: sig.company,
        address: sig.address,
        dateSigned: sig.dateSigned,
        consentText,
      });
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
      <div className="max-w-lg mx-auto py-16 px-6 text-center space-y-5">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <h1 className="text-xl text-white font-medium">Signed &amp; complete</h1>
        <p className="text-sm text-brand-gray">
          <strong className="text-brand-gold">{data.title}</strong> was signed
          {data.signedAt ? ` on ${fmt(data.signedAt)}` : ""}. A confirmation was emailed to you.
        </p>
        <div className="text-left rounded-xl border border-brand-border bg-brand-charcoal/60 p-5 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Certificate of completion
          </p>
          <CertRow label="Reference" value={data.documentNumber ?? undefined} />
          <CertRow label="Legal name" value={signedFields?.legalName} />
          <CertRow label="Title" value={signedFields?.title} />
          <CertRow label="Company" value={signedFields?.company} />
          <CertRow label="Email" value={data.signerEmail} />
          <CertRow label="Address" value={signedFields?.address} />
          <CertRow label="Date attested" value={signedFields?.dateSigned} />
          <CertRow label="Signed" value={fmt(data.signedAt)} />
        </div>
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
          {data.documentNumber ? (
            <span className="text-brand-gray/70"> · Ref {data.documentNumber}</span>
          ) : null}
        </p>
        {data.signerMessage ? (
          <p className="text-sm text-brand-gray/90 mt-2 italic border-l-2 border-brand-gold/40 pl-3">
            {data.signerMessage}
          </p>
        ) : null}
      </header>

      <SignDocumentBody snapshot={data.documentSnapshot} business={business} />

      <section className="rounded-xl border border-brand-border bg-brand-charcoal/60 p-5 sm:p-6 space-y-5">
        <h2 className="text-sm font-mono uppercase tracking-widest text-brand-gold">
          Sign this document
        </h2>

        <TypedSignatureForm
          signerName={data.signerName}
          requireAddress={data.requireAddress}
          disabled={submitting}
          onChange={setSig}
        />

        <label className="flex items-start gap-3 text-xs text-brand-gray cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 accent-brand-gold"
          />
          <span>{consentText}</span>
        </label>

        {error ? <p className="text-xs text-red-300">{error}</p> : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="w-full sm:w-auto px-8 py-3 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-xs font-mono uppercase tracking-widest font-bold disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Adopt signature & sign"}
        </button>
        <p className="text-[10px] text-brand-gray/60 font-mono">
          Your IP address, browser, and timestamp are recorded for the audit trail.
        </p>
      </section>
    </div>
  );
}

function CertRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-xs">
      <span className="text-brand-gray font-mono uppercase text-[10px] w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-white/90">{value}</span>
    </div>
  );
}
