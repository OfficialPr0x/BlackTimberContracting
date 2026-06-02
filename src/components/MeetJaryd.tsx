"use client";

import React from "react";
import { Play, Hammer, MapPin, Wrench, ShieldCheck } from "lucide-react";

interface MeetJarydProps {
  onTriggerQuote?: () => void;
}

/**
 * The "people hire people" section. Cinematic video-frame placeholder + raw,
 * unscripted-feeling copy from Jaryd. No corporate fluff.
 */
export default function MeetJaryd({ onTriggerQuote }: MeetJarydProps) {
  return (
    <section className="relative" id="meet-jaryd">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Cinematic video frame (left, 7 cols) */}
          <div className="lg:col-span-7 relative">
            <div className="relative aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden border border-brand-border shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)] group">
              {/* Background "footage" still */}
              <div
                className="absolute inset-0 bg-cover bg-center animate-ken-burns-slow"
                style={{ backgroundImage: "url('/hero_bg.png')" }}
              />
              <div className="absolute inset-0 cinema-vignette" />

              {/* Scan-line overlay */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-brand-gold/10 to-transparent"
                  style={{ animation: "scan-line 4.5s linear infinite" }}
                />
              </div>

              {/* REC badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 bg-black/70 rounded-full border border-brand-border backdrop-blur">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest text-white uppercase font-mono">REC</span>
                <span className="text-[9px] text-brand-gray font-mono">00:42 / 03:18</span>
              </div>

              {/* Top-right meta */}
              <div className="absolute top-4 right-4 text-right">
                <span className="block text-[9px] font-mono text-brand-gray uppercase">Raw Cam · No Script</span>
                <span className="block text-[10px] font-bold text-brand-gold uppercase tracking-widest">Episode 01</span>
              </div>

              {/* Play CTA */}
              <button
                className="absolute inset-0 grid place-items-center group/play"
                aria-label="Play intro video"
              >
                <div className="relative">
                  <span className="absolute inset-0 rounded-full bg-brand-gold/30 animate-ping" />
                  <span className="relative w-20 h-20 rounded-full bg-brand-gold text-brand-black grid place-items-center shadow-2xl group-hover/play:scale-110 transition-transform">
                    <Play className="w-8 h-8 fill-brand-black pl-1" />
                  </span>
                </div>
              </button>

              {/* Subtitle overlay */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 pointer-events-none">
                <div className="inline-block px-3 py-2 bg-black/75 rounded text-xs sm:text-sm text-white font-medium tracking-tight backdrop-blur max-w-xl leading-snug">
                  &ldquo;I&apos;m not a sales guy. I build stuff for a living. Here&apos;s how Black Timber actually works…&rdquo;
                </div>
              </div>

              {/* Caption strip */}
              <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-60" />
            </div>

            {/* Floating credentials card (bottom-left overlap) */}
            <div className="hidden sm:flex absolute -bottom-6 -left-4 lg:-left-8 items-center gap-3 px-4 py-3 glass-panel-strong rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-brand-gold/10 text-brand-gold border border-brand-gold/30 grid place-items-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-[10px]">
                <span className="block font-bold text-white uppercase tracking-widest">BC Licensed Builder</span>
                <span className="block text-brand-gray font-mono">Insured · WCB Covered · TQ Carpenter</span>
              </div>
            </div>
          </div>

          {/* Story copy (right, 5 cols) */}
          <div className="lg:col-span-5 space-y-7">
            <div className="space-y-3">
              <span className="text-xs font-bold text-brand-gold uppercase tracking-widest">
                Meet The Builder
              </span>
              <h2 className="text-4xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[1.02]">
                Meet <span className="text-gold-shimmer">Jaryd</span>
              </h2>
              <p className="text-sm text-brand-gray leading-relaxed">
                I&apos;m the guy on your jobsite. The one swinging the hammer, the one texting
                you photos at 6pm, and the one your inspector shakes hands with.
              </p>
              <p className="text-sm text-brand-gray leading-relaxed">
                Black Timber isn&apos;t a sales funnel with subcontractors. It&apos;s me, my crew,
                a real shop in Cranbrook, and a no-corner-cutting policy that gets us
                referrals every single week.
              </p>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { icon: Hammer,      label: "Builds",        value: "140+" },
                { icon: MapPin,      label: "Service Zone",  value: "BC" },
                { icon: Wrench,      label: "Years Hands-On",value: "12+" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl border border-brand-border bg-brand-panel/60 backdrop-blur">
                  <s.icon className="w-4 h-4 text-brand-gold mb-2" />
                  <span className="text-lg font-extrabold text-white font-mono block leading-tight">
                    {s.value}
                  </span>
                  <span className="text-[9px] text-brand-gray uppercase tracking-widest font-bold block">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onTriggerQuote}
                className="px-6 py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
              >
                Talk to Jaryd Directly
              </button>
              <a
                href="tel:250-910-9071"
                className="px-6 py-3.5 border border-brand-border hover:border-brand-gold/40 text-white font-bold uppercase tracking-widest text-xs rounded-xl transition-all text-center"
              >
                Text 250-910-9071
              </a>
            </div>

            {/* Signature feel */}
            <div className="pt-4 border-t border-brand-border/60">
              <div className="text-xs italic text-brand-gray leading-relaxed">
                &ldquo;If you can&apos;t reach the actual builder, you&apos;re not building with Black Timber.&rdquo;
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-brand-gold">
                — Jaryd, Founder & Lead Builder
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
