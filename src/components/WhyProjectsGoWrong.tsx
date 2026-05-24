"use client";

import React, { useState } from "react";
import { AlertTriangle, Phone, Ghost, DollarSign, Scissors, ShieldCheck, ArrowRight } from "lucide-react";

interface Failure {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  pain: string;
  painSub: string;
  prevention: string;
  proofChip: string;
}

const FAILURES: Failure[] = [
  {
    id: "comm",
    icon: Phone,
    pain: "Poor communication",
    painSub: "Two weeks of silence. No idea what's happening on your own property.",
    prevention:
      "Every active job gets a private command center. Daily photo logs, push notifications when stages complete, and direct text-line to the lead builder.",
    proofChip: "Avg. response < 2 hrs",
  },
  {
    id: "ghost",
    icon: Ghost,
    pain: "Disappearing contractors",
    painSub: "Deposit cashed. Then radio silence. You're chasing them for months.",
    prevention:
      "Staged milestone billing — you never pay more than the work that's actually been done. Local shop, BC license, WCB coverage. Skipping town isn't on the menu.",
    proofChip: "100% milestone-based",
  },
  {
    id: "surprise",
    icon: DollarSign,
    pain: "Surprise costs",
    painSub: "“Oh, that didn't include permits.” “Oh, the slope adds 8k.”",
    prevention:
      "Live cost engine before you ever talk to us. Every quote shows materials, labor, permits separately. Change orders require a signed digital approval — period.",
    proofChip: "Final within ±5% of quote",
  },
  {
    id: "cuts",
    icon: Scissors,
    pain: "Shortcuts under the boards",
    painSub: "Nails instead of structural screws. Concrete pads above frost line. Hidden rot in 5 years.",
    prevention:
      "Simpson Strong-Tie hardware only. Helical screw piles torque-tested to 6,000+ lbs. Double-flashing every ledger. We publish the structural details so your inspector can verify.",
    proofChip: "5-yr structural warranty",
  },
];

export default function WhyProjectsGoWrong() {
  const [active, setActive] = useState<string>(FAILURES[0].id);
  const current = FAILURES.find((f) => f.id === active) ?? FAILURES[0];

  return (
    <section className="relative" id="why-projects-go-wrong">
      {/* Subtle red→gold backdrop gradient sets the tone */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[480px] h-[480px] bg-red-500/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[640px] h-[640px] bg-brand-gold/[0.04] rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="max-w-3xl space-y-3">
          <span className="text-xs font-bold text-red-400/90 uppercase tracking-widest flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Hard Truth Section
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[1.02]">
            Why Most Contractor <br />
            Projects <span className="text-red-400">Go Wrong</span>
          </h2>
          <p className="text-sm text-brand-gray leading-relaxed max-w-xl">
            You&apos;ve heard the horror stories. Here are the four failures that wreck
            90% of residential builds — and the exact systems Black Timber uses to
            prevent every single one.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Failure tabs (left, 5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            {FAILURES.map((f) => {
              const isActive = active === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setActive(f.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                    isActive
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-brand-border bg-brand-panel/40 hover:border-brand-gold/30"
                  }`}
                >
                  <div
                    className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center border ${
                      isActive
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-brand-black border-brand-border text-brand-gray"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 font-bold text-xs">✕</span>
                      <span
                        className={`font-bold uppercase tracking-wider text-sm ${
                          isActive ? "text-white" : "text-brand-gray"
                        }`}
                      >
                        {f.pain}
                      </span>
                    </div>
                    <p className="text-xs text-brand-gray mt-1 leading-relaxed">
                      {f.painSub}
                    </p>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 shrink-0 mt-2 transition-all ${
                      isActive ? "text-brand-gold translate-x-1" : "text-brand-border"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Prevention detail (right, 7 cols) */}
          <div className="lg:col-span-7 sticky top-24">
            <div className="relative p-7 sm:p-9 rounded-3xl border border-brand-gold/20 bg-brand-charcoal overflow-hidden">
              {/* Glow */}
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative space-y-6">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                  <ShieldCheck className="w-4 h-4" />
                  Black Timber Prevention System
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-red-400/70 text-xs uppercase tracking-widest font-bold">
                    <span className="font-mono">Problem:</span>
                    <span className="line-through">{current.pain}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white leading-tight">
                    How we kill this failure mode
                  </h3>
                  <p className="text-sm text-brand-gray leading-relaxed">{current.prevention}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                    {current.proofChip}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-black/60 border border-brand-border text-[10px] font-bold uppercase tracking-widest text-brand-gray">
                    Documented in client portal
                  </span>
                </div>

                {/* Bottom row tiny metrics */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-brand-border/60">
                  <div>
                    <span className="block text-[9px] text-brand-gray uppercase tracking-widest font-bold">Avg. Job Update</span>
                    <span className="block text-base font-bold text-white font-mono">Daily</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-brand-gray uppercase tracking-widest font-bold">Quote Accuracy</span>
                    <span className="block text-base font-bold text-white font-mono">±5%</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-brand-gray uppercase tracking-widest font-bold">Warranty</span>
                    <span className="block text-base font-bold text-white font-mono">5 yrs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
