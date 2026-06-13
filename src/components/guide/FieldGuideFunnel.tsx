"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Lock,
  MapPin,
  Mountain,
  Phone,
  ShieldCheck,
} from "lucide-react";
import FieldGuideSubscribeForm from "@/components/guide/FieldGuideSubscribeForm";
import {
  AUTHORITY_STRIP,
  FUNNEL_FAQ,
  GUIDE_CHAPTERS,
  GUIDE_HERO_IMAGE,
  HERO_BULLETS,
  TRUST_CHECKLIST,
  VISUAL_PROOF,
  WHY_PILLARS,
} from "@/lib/guide/funnel-content";

const LOGO_SRC =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

const PHONE_DISPLAY = "250-910-9071";
const PHONE_TEL = "+12509109071";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">{children}</p>
  );
}

/** Premium "locked field manual" signup card used in hero + final CTA. */
function ManualCard({ pagePath }: { pagePath: string }) {
  return (
    <div className="guide-manual-card animate-fade-in">
      <div className="guide-manual-card__spine" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-11 h-11 rounded-lg border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-brand-gold">
                Locked field manual
              </p>
              <p className="text-sm font-bold text-white uppercase tracking-tight">
                Unlock instant access
              </p>
            </div>
          </div>
          <Mountain className="w-5 h-5 text-brand-gray/50" />
        </div>

        <FieldGuideSubscribeForm
          variant="compact"
          pagePath={pagePath}
          submitLabel="Unlock The Free Guide"
        />

        <p className="text-[10px] text-brand-gray text-center font-mono mt-4 tracking-wide">
          No spam. No pressure. Just the guide.
        </p>
      </div>
    </div>
  );
}

export default function FieldGuideFunnel() {
  return (
    <div className="min-h-screen bg-brand-black text-foreground">
      {/* Header */}
      <header className="relative z-30 border-b border-brand-border/60 bg-brand-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="Black Timber Contracting" className="h-10 w-auto" />
            <span className="hidden sm:block text-[10px] font-mono uppercase tracking-widest text-brand-gray group-hover:text-brand-gold transition-colors">
              Black Timber Contracting
            </span>
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to site
          </a>
        </div>
      </header>

      {/* ───────────────────────── 1 · HERO ───────────────────────── */}
      <section className="relative z-10 overflow-hidden">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={GUIDE_HERO_IMAGE.url}
            alt={GUIDE_HERO_IMAGE.alt}
            className="w-full h-full object-cover object-center animate-ken-burns-slow"
            fetchPriority="high"
          />
          {/* Left-weighted readability gradient + base darken */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/85 to-brand-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-brand-black/40" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center">
            {/* Left — copy */}
            <div className="space-y-7 animate-fade-in-up">
              <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.35em] text-brand-gold border border-brand-gold/30 rounded-full px-3.5 py-1.5 bg-brand-gold/5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Free Kootenay Homeowner Manual
              </span>

              <h1 className="text-[2rem] sm:text-5xl lg:text-[3.4rem] font-extrabold uppercase tracking-tight leading-[1.04] text-white">
                The manual we wish{" "}
                <span className="text-gold-shimmer">every client</span> read before calling a
                contractor
              </h1>

              <p className="text-sm sm:text-base text-white/75 leading-relaxed max-w-xl">
                A local homeowner field guide for project planning, permits, snow load, wildfire
                prep, flood risk, contractor red flags, rebates, budgeting, and emergency
                readiness — built for real Kootenay homes.
              </p>

              <ul className="space-y-2.5 max-w-lg">
                {HERO_BULLETS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — locked manual card */}
            <div id="get-guide" className="lg:pl-4">
              <ManualCard pagePath="/field-guide" />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── 2 · AUTHORITY STRIP ───────────────────────── */}
      <section className="relative z-10 border-y border-brand-border bg-brand-charcoal/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 divide-x divide-brand-border/70">
          {AUTHORITY_STRIP.map((item, i) => (
            <div
              key={item.label}
              className={`py-7 px-5 ${i % 2 === 0 ? "border-r border-brand-border/70 lg:border-r-0" : ""} ${
                i < 2 ? "border-b border-brand-border/70 lg:border-b-0" : ""
              }`}
            >
              <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono leading-none">
                {item.stat}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mt-2">
                {item.label}
              </p>
              <p className="text-[11px] text-brand-gray mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────── 3 · WHY THIS GUIDE EXISTS ───────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal-on-scroll max-w-3xl">
          <Eyebrow>Why this guide exists</Eyebrow>
          <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white mt-3 leading-[1.1]">
            Serious contractors educate first.{" "}
            <span className="text-brand-gray">Sales pitches second.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {WHY_PILLARS.map((pillar, i) => (
            <article
              key={pillar.title}
              className="reveal-on-scroll glass-panel glass-panel-hover rounded-2xl p-7 border border-brand-border"
            >
              <span className="block text-[11px] font-mono text-brand-gold/70 mb-4">
                0{i + 1}
              </span>
              <h3 className="text-base font-bold text-white uppercase tracking-tight mb-3 leading-snug">
                {pillar.title}
              </h3>
              <p className="text-sm text-brand-gray leading-relaxed">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ───────────────────────── 4 · GUIDE PREVIEW (18 chapters) ───────────────────────── */}
      <section className="relative z-10 bg-brand-charcoal/40 border-y border-brand-border py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 reveal-on-scroll">
            <div>
              <Eyebrow>What&apos;s inside the field guide</Eyebrow>
              <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white mt-3">
                18 chapters. Zero filler.
              </h2>
            </div>
            <p className="text-sm text-brand-gray max-w-md">
              Not a 3-page lead magnet — a full resilience manual you&apos;ll reference before
              every renovation, deck, addition, or major repair.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {GUIDE_CHAPTERS.map((ch) => (
              <div key={ch.n} className="guide-chapter-tile group">
                <span className="guide-chapter-tile__num">{String(ch.n).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white uppercase tracking-tight leading-snug group-hover:text-brand-gold transition-colors">
                    {ch.title}
                  </p>
                  <p className="text-[11px] text-brand-gray mt-1 leading-relaxed">{ch.teaser}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── 5 · VISUAL PROOF (inside the manual) ───────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal-on-scroll mb-12">
          <Eyebrow>Inside the manual</Eyebrow>
          <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white mt-3">
            Field photography — not clip art
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VISUAL_PROOF.map((card) => (
            <figure key={card.label} className="guide-proof-card group reveal-on-scroll">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.image.url}
                alt={card.image.alt}
                loading="lazy"
                className="guide-proof-card__img"
              />
              <div className="guide-proof-card__overlay" />
              <figcaption className="guide-proof-card__body">
                <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-brand-gold">
                  {card.label}
                </span>
                <p className="text-sm font-semibold text-white mt-1 leading-snug">{card.caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ───────────────────────── 6 · TRUST SPLIT ───────────────────────── */}
      <section className="relative z-10 border-y border-brand-border bg-brand-charcoal/40 py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="reveal-on-scroll">
            <Eyebrow>Built for real conditions</Eyebrow>
            <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white mt-3 leading-[1.1]">
              Built for homes that face real Kootenay conditions
            </h2>
            <p className="text-sm text-brand-gray leading-relaxed mt-5">
              Heavy snow loads and freeze-thaw heave. Wildfire seasons and FireSmart setbacks.
              Spring freshet flooding, steep-slope drainage, and basement radon. Permit rules that
              change between the RDEK and RDCK.
            </p>
            <p className="text-sm text-brand-gray leading-relaxed mt-4">
              Generic homeowner advice ignores all of it. This manual was written from the
              jobsite — for the specific ways mountain homes succeed or fail in this valley.
            </p>
          </div>

          <div className="reveal-on-scroll glass-panel-strong rounded-2xl p-7 sm:p-8">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-brand-gold mb-5">
              What you&apos;ll be ready for
            </p>
            <ul className="space-y-3.5">
              {TRUST_CHECKLIST.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="grid place-items-center w-5 h-5 rounded-full border border-brand-gold/40 text-brand-gold shrink-0">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────────── 7 · FAQ ───────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-10 reveal-on-scroll">
          <Eyebrow>Straight answers</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white mt-3">
            Questions, answered honestly
          </h2>
        </div>
        <div className="space-y-3">
          {FUNNEL_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-brand-border bg-brand-charcoal/50 open:border-brand-gold/30 transition-colors"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white">
                {item.q}
                <ChevronDown className="w-4 h-4 text-brand-gold shrink-0 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="px-5 pb-5 text-sm text-brand-gray leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───────────────────────── 8 · FINAL CTA ───────────────────────── */}
      <section className="relative z-10 border-t border-brand-border bg-gradient-to-b from-brand-charcoal to-brand-black py-20 sm:py-24">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="reveal-on-scroll">
            <Eyebrow>Your next step</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white mt-3 leading-[1.02]">
              Ready before you renovate.
            </h2>
            <p className="text-base text-brand-gray leading-relaxed mt-5 max-w-md">
              Walk into your next project knowing what to ask, what to avoid, and what your home
              actually needs.
            </p>

            <div className="mt-8 pt-7 border-t border-brand-border">
              <p className="text-sm text-white/80 font-semibold">Prefer to talk it through?</p>
              <p className="text-xs text-brand-gray mt-1 mb-4">
                Book a free Black Timber Project Walkthrough — no obligation.
              </p>
              <a
                href={`tel:${PHONE_TEL}`}
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl border border-brand-gold/40 text-brand-gold hover:bg-brand-gold hover:text-brand-black font-bold uppercase tracking-widest text-xs transition-colors"
              >
                <Phone className="w-4 h-4" />
                {PHONE_DISPLAY}
              </a>
              <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-brand-gray mt-5">
                <MapPin className="w-3 h-3 text-brand-gold" />
                Fernie · Sparwood · Elkford · Cranbrook · Nelson
              </p>
            </div>
          </div>

          <div className="reveal-on-scroll">
            <ManualCard pagePath="/field-guide" />
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-brand-border py-10 text-center">
        <p className="relative text-[10px] font-mono text-brand-gray uppercase tracking-widest">
          © {new Date().getFullYear()} Black Timber Contracting · BC Licensed · Cranbrook &amp; East
          Kootenay
        </p>
      </footer>
    </div>
  );
}
