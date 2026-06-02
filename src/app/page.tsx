"use client";

import React, { useEffect, useState } from "react";
import {
  Phone,
  Mail,
  Calendar,
  ArrowRight,
  Menu,
  X,
  Star,
  MapPin,
  ShieldCheck,
  Clock,
  ChevronDown,
} from "lucide-react";

const LOGO_SRC =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

const HERO_SLIDES: { src: string; position: string }[] = [
  {
    src: "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779593286/ChatGPT_Image_May_23_2026_09_26_35_PM_oymoeh.png",
    position: "60% center",
  },
  {
    src: "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779594704/ChatGPT_Image_May_23_2026_09_51_26_PM_la8r55.png",
    position: "center center",
  },
];
import QuoteWizard from "@/components/QuoteWizard";
import Visualizer from "@/components/Visualizer";
import DrawItOut from "@/components/DrawItOut";
import ProjectCheck from "@/components/ProjectCheck";
import CostCalculator from "@/components/CostCalculator";
import LiveMap from "@/components/LiveMap";
import ContractorTV from "@/components/ContractorTV";
import ProjectPortal from "@/components/ProjectPortal";
import ExitIntentPopup from "@/components/ExitIntentPopup";
import MouseSpotlight from "@/components/MouseSpotlight";
import ReviewsTicker from "@/components/ReviewsTicker";
import BeforeAfterWall from "@/components/BeforeAfterWall";
import MeetJaryd from "@/components/MeetJaryd";
import WhyProjectsGoWrong from "@/components/WhyProjectsGoWrong";
import AnimatedCounter from "@/components/AnimatedCounter";
import JobGallery from "@/components/JobGallery";

export default function Home() {
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [, setQuoteInitialStep] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);

  // Slow cinematic crossfade between hero shots (every 8s)
  useEffect(() => {
    const id = setInterval(() => {
      setHeroSlide((s) => (s + 1) % HERO_SLIDES.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const triggerQuote = (startStep = 1) => {
    setQuoteInitialStep(startStep);
    setIsQuoteOpen(true);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-brand-black text-foreground relative font-sans overflow-x-clip">
      {/* Global ambient mouse spotlight */}
      <MouseSpotlight />

      {/* Subtle grain dot background */}
      <div className="fixed inset-0 bg-[radial-gradient(rgba(197,168,128,0.025)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />

      {/* ─────────────── HEADER ─────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-brand-border/60 bg-brand-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 cursor-pointer group focus:outline-none"
            aria-label="Black Timber Contracting · back to top"
          >
            <img
              src={LOGO_SRC}
              alt="Black Timber Contracting"
              className="h-14 sm:h-16 w-auto drop-shadow-[0_0_18px_rgba(197,168,128,0.18)] group-hover:drop-shadow-[0_0_24px_rgba(197,168,128,0.35)] transition-all"
              draggable={false}
            />
            <span className="sr-only">Black Timber Contracting</span>
          </button>

          <nav className="hidden lg:flex items-center space-x-7 text-[11px] font-bold uppercase tracking-widest text-brand-gray">
            <button onClick={() => scrollToSection("transformations-section")} className="hover:text-brand-gold transition-colors">Transformations</button>
            <button onClick={() => scrollToSection("interactive-suite")} className="hover:text-brand-gold transition-colors">Design Suite</button>
            <button onClick={() => scrollToSection("calculator-section")} className="hover:text-brand-gold transition-colors">Pricing</button>
            <button onClick={() => scrollToSection("tv-section")} className="hover:text-brand-gold transition-colors">Black Timber TV</button>
            <button onClick={() => scrollToSection("portal-section")} className="hover:text-brand-gold transition-colors">Client Portal</button>
            <button onClick={() => scrollToSection("meet-jaryd")} className="hover:text-brand-gold transition-colors">Meet Jaryd</button>
          </nav>

          <div className="hidden lg:flex items-center space-x-4">
            <a href="tel:250-910-9071" className="text-xs font-mono font-bold text-brand-gray hover:text-white flex items-center gap-1.5 transition-colors">
              <Phone className="w-3.5 h-3.5 text-brand-gold" />
              250-910-9071
            </a>
            <button
              onClick={() => triggerQuote(1)}
              className="px-5 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-[10px] rounded-lg shadow-md transition-all"
            >
              Get Quote
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg border border-brand-border text-brand-gray hover:text-white transition-all"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-brand-border bg-brand-charcoal px-4 py-6 space-y-4 animate-fade-in">
            <div className="flex flex-col space-y-3 text-left text-xs font-bold uppercase tracking-wider text-brand-gray">
              <button onClick={() => scrollToSection("transformations-section")} className="py-2 hover:text-brand-gold text-left">Transformations</button>
              <button onClick={() => scrollToSection("interactive-suite")} className="py-2 hover:text-brand-gold text-left">Design Suite</button>
              <button onClick={() => scrollToSection("calculator-section")} className="py-2 hover:text-brand-gold text-left">Pricing</button>
              <button onClick={() => scrollToSection("tv-section")} className="py-2 hover:text-brand-gold text-left">Black Timber TV</button>
              <button onClick={() => scrollToSection("portal-section")} className="py-2 hover:text-brand-gold text-left">Client Portal</button>
              <button onClick={() => scrollToSection("meet-jaryd")} className="py-2 hover:text-brand-gold text-left">Meet Jaryd</button>
            </div>
            <div className="h-[1px] bg-brand-border" />
            <div className="flex flex-col gap-3">
              <a href="tel:250-910-9071" className="text-xs font-mono font-bold text-white flex items-center justify-center gap-1.5 py-2 border border-brand-border rounded">
                <Phone className="w-4 h-4 text-brand-gold" />
                250-910-9071
              </a>
              <button
                onClick={() => { triggerQuote(1); setMobileMenuOpen(false); }}
                className="w-full py-3 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-lg"
              >
                Get Quote
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────── HERO (FULL-BLEED CINEMATIC) ─────────────── */}
      <section className="relative overflow-hidden min-h-[100vh] flex items-end pb-16 sm:pb-24 film-grain">
        {/* Crossfading footage layers (Ken Burns on each) */}
        <div className="absolute inset-0">
          {HERO_SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className="absolute inset-0 bg-cover animate-ken-burns transition-opacity duration-[2000ms] ease-in-out"
              style={{
                backgroundImage: `url('${slide.src}')`,
                backgroundPosition: slide.position,
                opacity: heroSlide === i ? 1 : 0,
              }}
            />
          ))}
          {/* Left-to-right darkness so the headline pops over the dramatic sky */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-black/85 via-brand-black/40 to-transparent" />
          {/* Top-to-bottom fade into the page */}
          <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-transparent to-brand-black" />
          {/* Subtle cinematic vignette */}
          <div className="absolute inset-0 cinema-vignette opacity-70" />
          {/* Bottom glow seam into next section */}
          <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_100%,rgba(11,10,9,0.95)_0%,transparent_60%)]" />
        </div>

        {/* Subtle slide indicator (bottom-right) */}
        <div className="absolute bottom-6 right-6 z-10 hidden sm:flex items-center gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroSlide(i)}
              aria-label={`Show hero image ${i + 1}`}
              className={`h-[3px] rounded-full transition-all ${
                heroSlide === i ? "w-10 bg-brand-gold" : "w-5 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>

        {/* Centered content stack */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-7">
            {/* Killer headline */}
            <h1 className="text-5xl sm:text-7xl lg:text-[7.5rem] font-black uppercase tracking-tight text-white leading-[0.92]">
              Real Work. <br />
              <span className="text-brand-gold">Real Standards.</span> <br />
              Real Results.
            </h1>

            {/* Subline — contractor voice, not SaaS */}
            <p className="text-base sm:text-lg text-white/80 max-w-xl leading-relaxed font-medium">
              Kootenay-built custom decks, timber structures, and renovations.
              <span className="block text-brand-gold/90 mt-1 text-sm sm:text-base font-semibold">
                Engineered for snow loads. Built to last decades.
              </span>
            </p>

            {/* Trust chips — quiet, no animated counters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 border border-white/10 backdrop-blur-md text-xs font-bold text-white">
                <span className="flex text-brand-gold">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-brand-gold" />
                  ))}
                </span>
                <span>87+ Five-Star Reviews</span>
              </span>

              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 border border-white/10 backdrop-blur-md text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-brand-gold" />
                BC Licensed & Insured
              </span>

              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 border border-white/10 backdrop-blur-md text-xs font-bold text-white">
                <Clock className="w-4 h-4 text-brand-gold" />
                Free Quote in 60 Seconds
              </span>
            </div>

            {/* Two CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => triggerQuote(1)}
                className="px-9 py-4 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-sm rounded-xl shadow-2xl transition-all flex items-center justify-center gap-2 group"
              >
                <span>Get a Free Quote</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="tel:250-910-9071"
                className="px-9 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-brand-gold/40 rounded-xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 backdrop-blur-md"
              >
                <Phone className="w-4 h-4 text-brand-gold" />
                Call 250-910-9071
              </a>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/40 animate-float-y" style={{ animation: "float-y 2.5s ease-in-out infinite" }}>
          <span>Scroll</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </section>

      {/* ─────────────── REVIEWS TICKER (immediately under hero) ─────────────── */}
      <section className="py-6 bg-brand-black border-y border-brand-border/40 relative z-10">
        <ReviewsTicker />
      </section>

      {/* ─────────────── BEFORE / AFTER WALL ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-charcoal border-b border-brand-border relative">
        <BeforeAfterWall />
      </section>

      {/* ─────────────── INTERACTIVE DESIGN SUITE ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-black border-b border-brand-border" id="interactive-suite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-bold text-brand-gold uppercase tracking-widest">
              See It. Plan It. Build It.
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-[1.05]">
              The <span className="text-gold-shimmer">Black Timber OS.</span> <br />
              Design your future build in the browser.
            </h2>
            <p className="text-sm text-brand-gray leading-relaxed">
              Drag, tap, sketch, scan. Every tool talks to the AI quote engine — by the time you call,
              we already know what you want and what it costs.
            </p>
          </div>

          {/* Mini chip row showing reviews from cities — social proof everywhere */}
          <div className="flex flex-wrap gap-2">
            {["Fernie", "Sparwood", "Cranbrook", "Nelson", "Elkford", "Kimberley", "Invermere"].map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-charcoal border border-brand-border text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                <span className="flex text-brand-gold">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-2.5 h-2.5 fill-brand-gold" />
                  ))}
                </span>
                <span>{c}</span>
              </span>
            ))}
          </div>

          <div className="space-y-14">
            <div className="bg-brand-charcoal p-6 sm:p-8 rounded-3xl border border-brand-border">
              <Visualizer />
            </div>
            <div className="bg-brand-charcoal p-6 sm:p-8 rounded-3xl border border-brand-border">
              <DrawItOut />
            </div>
            <div className="bg-brand-charcoal p-6 sm:p-8 rounded-3xl border border-brand-border">
              <ProjectCheck />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── NO BS PRICING ENGINE ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-charcoal border-y border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CostCalculator onTriggerQuote={() => triggerQuote(1)} />
        </div>
      </section>

      {/* ─────────────── REVIEWS TICKER (reverse direction, mid-page) ─────────────── */}
      <section className="py-6 bg-brand-black border-y border-brand-border/40">
        <ReviewsTicker reverse />
      </section>

      {/* ─────────────── MEET JARYD ─────────────── */}
      <section className="py-20 sm:py-32 bg-brand-black relative">
        <MeetJaryd onTriggerQuote={() => triggerQuote(1)} />
      </section>

      {/* ─────────────── REAL JOB PHOTOS GALLERY ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-charcoal border-y border-brand-border">
        <JobGallery onTriggerQuote={() => triggerQuote(1)} />
      </section>

      {/* ─────────────── WHY PROJECTS GO WRONG (trust destroyer) ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-black border-y border-brand-border">
        <WhyProjectsGoWrong />
      </section>

      {/* ─────────────── CONTRACTOR NETFLIX ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-black border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContractorTV />
        </div>
      </section>

      {/* ─────────────── LIVE PROJECT MAP ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-charcoal border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LiveMap />
        </div>
      </section>

      {/* ─────────────── CLIENT COMMAND CENTER ─────────────── */}
      <section className="py-20 sm:py-28 bg-brand-black border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ProjectPortal />
        </div>
      </section>

      {/* ─────────────── LIVE COUNTERS / KPI BAND ─────────────── */}
      <section className="py-16 bg-brand-charcoal border-y border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: 140, suffix: "+", label: "Builds Delivered" },
              { value: 87,  suffix: "+", label: "5-Star Reviews" },
              { value: 12,  suffix: "+", label: "Years On Tools" },
              { value: 100, suffix: "%", label: "Milestone Billed" },
            ].map((s) => (
              <div key={s.label} className="p-6 rounded-2xl border border-brand-border bg-brand-black/50 backdrop-blur text-center glass-panel-hover">
                <div className="text-4xl sm:text-5xl font-extrabold text-gold-shimmer font-mono tracking-tight">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest font-bold text-brand-gray">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── FINAL CTA ─────────────── */}
      <section className="py-24 sm:py-32 bg-brand-black text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-gold/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_50%,rgba(197,168,128,0.06)_0%,transparent_70%)]" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">
          <div className="space-y-4">
            <span className="text-xs font-bold text-brand-gold uppercase tracking-widest">
              Ready when you are
            </span>
            <h2 className="text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-white leading-[1.02]">
              Let&apos;s build <br />
              <span className="text-gold-shimmer">something incredible.</span>
            </h2>
            <p className="text-sm text-brand-gray max-w-md mx-auto leading-relaxed">
              Cranbrook · Fernie · Sparwood · Elkford · Nelson · Kimberley · Invermere · Trail · Kelowna
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
            <a
              href="tel:250-910-9071"
              className="p-5 rounded-2xl bg-brand-charcoal border border-brand-border hover:border-brand-gold/40 transition-all flex items-start space-x-3 text-xs glass-panel-hover"
            >
              <Phone className="w-5 h-5 text-brand-gold flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white uppercase block">Call or Text</span>
                <span className="font-mono text-brand-gold block mt-0.5 font-bold">250-910-9071</span>
                <span className="text-[9px] text-brand-gray block mt-1">Mon–Sat: 7AM – 7PM</span>
              </div>
            </a>

            <button
              onClick={() => triggerQuote(5)}
              className="p-5 rounded-2xl bg-brand-charcoal border border-brand-border hover:border-brand-gold/40 transition-all flex items-start space-x-3 text-xs text-left glass-panel-hover"
            >
              <Calendar className="w-5 h-5 text-brand-gold flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white uppercase block">Book Consultation</span>
                <span className="text-brand-gold block mt-0.5 font-semibold">Select Date & Time</span>
                <span className="text-[9px] text-brand-gray block mt-1">Jaryd&apos;s live calendar</span>
              </div>
            </button>

            <a
              href="mailto:hello@blacktimber.ca"
              className="p-5 rounded-2xl bg-brand-charcoal border border-brand-border hover:border-brand-gold/40 transition-all flex items-start space-x-3 text-xs glass-panel-hover"
            >
              <Mail className="w-5 h-5 text-brand-gold flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white uppercase block">Email</span>
                <span className="text-brand-gold block mt-0.5 font-semibold">hello@blacktimber.ca</span>
                <span className="text-[9px] text-brand-gray block mt-1">Reply within 24 hrs</span>
              </div>
            </a>
          </div>

          <div className="pt-6">
            <button
              onClick={() => triggerQuote(1)}
              className="px-10 py-5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-sm rounded-xl shadow-2xl transition-all inline-flex items-center gap-2"
            >
              Start the 60-Second Quote
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────── FOOTER ─────────────── */}
      <footer className="bg-brand-black border-t border-brand-border py-12 text-[10px] text-brand-gray font-mono relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_SRC}
              alt="Black Timber Contracting"
              className="h-12 w-auto opacity-95"
              draggable={false}
            />
            <span className="text-white uppercase font-bold tracking-wider">
              © {new Date().getFullYear()} · BC Licensed
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 justify-center">
            <a href="#privacy" className="hover:text-white">Privacy</a>
            <a href="#terms" className="hover:text-white">Terms</a>
            <span className="text-brand-gold flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              Cranbrook · Fernie · Sparwood · Elkford · Nelson
            </span>
          </div>
        </div>
      </footer>

      {/* ─────────────── GLOBAL MODALS ─────────────── */}
      <QuoteWizard
        isOpen={isQuoteOpen}
        onClose={() => setIsQuoteOpen(false)}
        initialType="deck"
      />

      <ExitIntentPopup />
    </div>
  );
}
