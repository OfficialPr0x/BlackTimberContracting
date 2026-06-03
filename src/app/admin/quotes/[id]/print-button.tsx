"use client";

/**
 * Print button — calls window.print() from the saved-quote view header.
 * Tiny client component so the surrounding view page can stay a server
 * component and read the saved quote without shipping it to the client.
 */

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border hover:border-brand-gold text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold transition-colors"
    >
      <Printer className="w-3 h-3" />
      Print / save PDF
    </button>
  );
}
