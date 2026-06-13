"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import FieldGuideSubscribeForm from "@/components/guide/FieldGuideSubscribeForm";
import {
  FUNNEL_FAQ,
  FUNNEL_PREVIEW_IMAGES,
  GUIDE_CHAPTERS,
  GUIDE_FUNNEL_TITLE,
  GUIDE_HERO_IMAGE,
  TRUST_STRIP,
  WHY_PILLARS,
} from "@/lib/guide/funnel-content";

const LOGO_SRC =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

export default function FieldGuideFunnel() {
  return (
    <div className="min-h-screen bg-brand-black text-foreground">
      <div className="fixed inset-0 bg-[radial-gradient(rgba(197,168,128,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 border-b border-brand-border/60 bg-brand-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3 group">
            <img src={LOGO_SRC} alt="Black Timber" className="h-10 w-auto" />
            <span className="hidden sm:block text-[10px] font-mono uppercase tracking-widest text-brand-gray group-hover:text-brand-gold">
              Black Timber Contracting
            </span>
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to site
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 overflow-hidden">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={GUIDE_HERO_IMAGE.url}
            alt={GUIDE_HERO_IMAGE.alt}
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-black/70 via-brand-black/85 to-brand-black" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 lg:py-24">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-start">
            <div className="space-y-6 animate-fade-in-up">
              <p className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.35em] text-brand-gold border border-brand-gold/30 rounded-full px-3 py-1.5 bg-brand-gold/5">
                <Sparkles className="w-3.5 h-3.5" />
                Free Kootenay homeowner manual
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold uppercase tracking-tight leading-[1.08] text-white">
                The manual we wish{" "}
                <span className="text-gold-shimmer">every client</span> read before calling a
                contractor
              </h1>

              <p className="text-sm sm:text-base text-brand-gray leading-relaxed max-w-xl">
                {GUIDE_FUNNEL_TITLE} — 18 chapters on permits, snow loads, wildfire prep, contractor
                red flags, rebates, budgeting, and emergency readiness. Built for Fernie, Cranbrook,
                Nelson, Sparwood, and the whole East Kootenay.
              </p>

              <ul className="space-y-2.5">
                {[
                  "Instant password-protected access — read online or print",
                  "Checklists you can use with any contractor",
                  "Sourced from RDEK/RDCK rules, BC Building Code, and real job-site lessons",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/90">
                    <Check className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 pt-1">
                {["Fernie", "Cranbrook", "Nelson", "Sparwood", "Elkford"].map((city) => (
                  <span
                    key={city}
                    className="text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border border-brand-border text-brand-gray"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>

            <div id="get-guide" className="lg:sticky lg:top-8 animate-fade-in">
              <FieldGuideSubscribeForm variant="hero" pagePath="/field-guide" />
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="relative z-10 border-y border-brand-border bg-brand-charcoal/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_STRIP.map((item) => (
            <div key={item.label} className="text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-white">{item.label}</p>
              <p className="text-[11px] text-brand-gray mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why we built this */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-brand-gold" />
          <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-brand-gold">
            Why Black Timber published this
          </p>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white mb-10 max-w-2xl">
          Serious contractors educate first. Sales pitches second.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {WHY_PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              className="glass-panel rounded-2xl p-6 border border-brand-border hover:border-brand-gold/30 transition-colors"
            >
              <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">
                {pillar.title}
              </h3>
              <p className="text-sm text-brand-gray leading-relaxed">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* What's inside */}
      <section className="relative z-10 bg-brand-charcoal/40 border-y border-brand-border py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-brand-gold mb-2">
                What you&apos;re getting
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                18 chapters. Zero filler.
              </h2>
            </div>
            <p className="text-sm text-brand-gray max-w-md">
              Not a 3-page lead magnet — a full resilience manual you&apos;ll reference before every
              renovation, deck, addition, or major repair.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GUIDE_CHAPTERS.map((ch) => (
              <div
                key={ch.n}
                className="flex gap-3 rounded-xl border border-brand-border bg-brand-black/50 p-4 hover:border-brand-gold/25 transition-colors"
              >
                <span className="text-[10px] font-mono text-brand-gold shrink-0 pt-0.5">
                  {String(ch.n).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wide">{ch.title}</p>
                  <p className="text-[11px] text-brand-gray mt-1 leading-relaxed">{ch.teaser}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visual preview */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-brand-gold mb-2">
          Inside the guide
        </p>
        <h2 className="text-2xl font-extrabold uppercase tracking-tight text-white mb-8">
          Professional field-guide photography — not clip art
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FUNNEL_PREVIEW_IMAGES.slice(0, 6).map((img) => (
            <figure key={img.id} className="group overflow-hidden rounded-xl border border-brand-border">
              <div className="aspect-video overflow-hidden bg-brand-charcoal">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <figcaption className="p-3 text-[10px] font-mono uppercase tracking-wider text-brand-gray leading-relaxed">
                {img.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Credibility */}
      <section className="relative z-10 border-y border-brand-border bg-brand-charcoal/30 py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-8 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start gap-2">
            <ShieldCheck className="w-8 h-8 text-brand-gold" />
            <p className="text-3xl font-extrabold text-white font-mono">140+</p>
            <p className="text-xs text-brand-gray uppercase tracking-widest">Kootenay projects delivered</p>
          </div>
          <div className="flex flex-col items-center md:items-start gap-2">
            <BookOpen className="w-8 h-8 text-brand-gold" />
            <p className="text-3xl font-extrabold text-white font-mono">18</p>
            <p className="text-xs text-brand-gray uppercase tracking-widest">Research-backed chapters</p>
          </div>
          <div className="flex flex-col items-center md:items-start gap-2">
            <MapPin className="w-8 h-8 text-brand-gold" />
            <p className="text-sm font-bold text-white uppercase tracking-wide">Local-first</p>
            <p className="text-xs text-brand-gray leading-relaxed">
              RDEK · RDCK · FireSmart · CleanBC rebates · real snow-load values
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-xl font-extrabold uppercase tracking-tight text-white text-center mb-8">
          Straight answers
        </h2>
        <div className="space-y-3">
          {FUNNEL_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-brand-border bg-brand-charcoal/40 open:border-brand-gold/30"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white">
                {item.q}
                <ChevronDown className="w-4 h-4 text-brand-gold shrink-0 group-open:rotate-180 transition-transform" />
              </summary>
              <p className="px-5 pb-4 text-sm text-brand-gray leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 border-t border-brand-border bg-gradient-to-b from-brand-charcoal to-brand-black py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white mb-4">
              Ready when you are.
            </h2>
            <p className="text-sm text-brand-gray leading-relaxed mb-6">
              Grab the manual, work through the checklists, and walk into your next project conversation
              knowing what questions to ask. That&apos;s how you protect your home — and your wallet.
            </p>
            <a
              href="#get-guide"
              className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-brand-gold hover:text-white"
            >
              Jump to signup form
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <FieldGuideSubscribeForm
            variant="card"
            pagePath="/field-guide"
            submitLabel="Unlock The Free Guide"
          />
        </div>
      </section>

      <footer className="relative z-10 border-t border-brand-border py-8 text-center">
        <p className="text-[10px] font-mono text-brand-gray uppercase tracking-widest">
          © {new Date().getFullYear()} Black Timber Contracting · BC Licensed · Cranbrook &amp; East
          Kootenay
        </p>
      </footer>
    </div>
  );
}
