"use client";

import { useState } from "react";
import { Download, Loader } from "lucide-react";
import { downloadDocumentFromPage } from "@/lib/pdf/download-document-pdf";

type Variant = "admin" | "gold" | "wizard";

const VARIANT_CLASS: Record<Variant, string> = {
  admin:
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-gold/50 bg-brand-gold/15 hover:bg-brand-gold/25 text-[10px] font-mono uppercase tracking-widest text-brand-gold transition-colors disabled:opacity-50",
  gold:
    "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-sm font-mono uppercase tracking-widest font-bold transition-colors disabled:opacity-50",
  wizard:
    "flex-1 py-3 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-60 text-brand-black rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
};

export default function DownloadPdfButton({
  filename,
  label = "Download PDF",
  variant = "admin",
  className,
  onError,
}: {
  filename: string;
  label?: string;
  variant?: Variant;
  className?: string;
  onError?: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      await downloadDocumentFromPage(filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF download failed.";
      onError?.(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      className={className ?? VARIANT_CLASS[variant]}
    >
      {pending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {pending ? "Generating…" : label}
    </button>
  );
}
