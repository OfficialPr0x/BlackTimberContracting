"use client";

import { HardHat } from "lucide-react";

const TAPE_STYLE: React.CSSProperties = {
  backgroundImage: `repeating-linear-gradient(
    -45deg,
    #eab308 0px,
    #eab308 16px,
    #141311 16px,
    #141311 32px
  )`,
};

interface ComingSoonSectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  hint?: string;
}

export default function ComingSoonSection({
  children,
  title = "Coming Soon",
  subtitle = "We're putting the finishing touches on this tool before it goes live in the Kootenays.",
  hint = "Need a quote now? Call 250-910-9071 — real builder, same-day callback.",
}: ComingSoonSectionProps) {
  return (
    <div className="relative rounded-3xl overflow-hidden border border-amber-500/25 shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]">
      {/* Greyed-out preview of the real UI */}
      <div
        className="pointer-events-none select-none opacity-[0.32] grayscale-[0.9] blur-[0.5px] saturate-50"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Caution tape + coming soon panel */}
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 py-10 bg-brand-black/70 backdrop-blur-[3px]"
        role="status"
        aria-live="polite"
      >
        <div
          className="absolute top-6 left-[-10%] right-[-10%] h-11 -rotate-2 shadow-lg opacity-95"
          style={TAPE_STYLE}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-6 left-[-10%] right-[-10%] h-11 rotate-2 shadow-lg opacity-95"
          style={TAPE_STYLE}
          aria-hidden="true"
        />

        <div className="relative max-w-lg text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-400 mx-auto">
            <HardHat className="w-7 h-7" />
          </div>

          <div className="inline-block px-5 py-2 rounded-full border-2 border-amber-400 bg-amber-400 text-brand-black font-extrabold text-[11px] uppercase tracking-[0.4em] shadow-lg">
            Coming Soon
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white leading-tight">
            {title}
          </h3>

          <p className="text-sm text-brand-gray leading-relaxed">{subtitle}</p>

          <p className="text-[11px] font-mono text-amber-200/90 uppercase tracking-wider pt-1">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}
