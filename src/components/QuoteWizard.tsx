"use client";

/**
 * QuoteWizard — redesigned for maximum simplicity and minimum friction.
 *
 * Step 1: Upload photos + describe the job in plain English
 * Step 2: Timeline, budget (soft / non-blunt), financing opt-in, contact info
 * Step 3: AI analysis spinner
 * Step 4: Estimate result + financing callout + booking CTA
 * Step 5: Book a site visit
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Upload, X, CheckCircle, ChevronRight, Sparkles, Loader,
  Camera, MessageSquare, MapPin, Calendar, Clock, Phone,
  Mail, CreditCard, AlertTriangle, ArrowRight, Pencil,
  Layers, AlignJustify, Umbrella, Warehouse, Hammer, HelpCircle,
  Bath, Grid3x3, Grip, Rows2,
  type LucideIcon,
} from "lucide-react";
import { estimateProject } from "@/lib/pricing/quote-engine";
import { buildEstimateDocument } from "@/lib/pricing/estimate-lines";
import WebsiteEstimatePrint from "@/components/WebsiteEstimatePrint";
import DownloadPdfButton from "@/components/pdf/DownloadPdfButton";
import { estimatePdfFilename } from "@/lib/pdf/filename";

// ─── types ──────────────────────────────────────────────────────────────────

interface QuoteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
  initialStep?: number;
}

type UploadedPhoto = { name: string; dataUrl: string; note: string };

interface AiQuoteResult {
  estimate: { minUSD: number; maxUSD: number; confidence: "high" | "medium" | "low" };
  breakdown: { materialsUSD: number; laborUSD: number; permitsAndFeesUSD: number };
  timelineWeeks: { min: number; max: number };
  scopeIncludes: string[];
  riskFactors: string[];
  regionalNotes: string;
  headline: string;
  disclaimer: string;
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ─── max photo file size: compress to keep requests under 8 MB body limit ───

const MAX_DIM = 1400;
const JPEG_Q = 0.82;

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) { reject(new Error("Canvas error.")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", JPEG_Q));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── PROJECT TYPE quick-pick ─────────────────────────────────────────────────

const PROJECT_CHIPS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "deck",       label: "Deck / Patio",    Icon: Layers       },
  { id: "fence",      label: "Fence",           Icon: AlignJustify },
  { id: "pergola",    label: "Pergola",         Icon: Umbrella     },
  { id: "garage",     label: "Garage / Shed",   Icon: Warehouse    },
  { id: "addition",   label: "Reno / Addition", Icon: Hammer       },
  { id: "bathroom",   label: "Bathroom",        Icon: Bath         },
  { id: "tiling",     label: "Tiling",          Icon: Grid3x3      },
  { id: "interlock",  label: "Interlock",       Icon: Grip         },
  { id: "flooring",   label: "Flooring",        Icon: Rows2        },
  { id: "other",      label: "Something Else",  Icon: HelpCircle   },
];

// ─── component ───────────────────────────────────────────────────────────────

export default function QuoteWizard({
  isOpen,
  onClose,
  initialType = "other",
  initialStep = 1,
}: QuoteWizardProps) {
  // ── wizard state ──
  const [step, setStep] = useState(1);

  // ── step 1: project ──
  const [projectType, setProjectType] = useState(initialType || "other");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [annotatingIdx, setAnnotatingIdx] = useState<number | null>(null);

  // ── step 2: soft questions ──
  const [timeline, setTimeline] = useState("");
  const [fundingChoice, setFundingChoice] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // ── ai ──
  const [aiResult, setAiResult] = useState<AiQuoteResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [aiElapsedMs, setAiElapsedMs] = useState(0);
  const [aiPending, setAiPending] = useState(false);

  // ── booking ──
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [isBooked, setIsBooked] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingPending, setBookingPending] = useState(false);

  // ── persistence ──
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `wiz-${Date.now()}`
  );
  const [estimateSaved, setEstimateSaved] = useState(false);
  const [savedLeadId, setSavedLeadId] = useState<string | null>(null);

  // The leads API (and Supabase insert) requires a valid email. Email is
  // optional in our UI, so when a customer skips it we synthesize a routable
  // placeholder tied to the session — the real phone is always captured. This
  // keeps the Supabase insert + lead delivery from failing validation.
  const effectiveEmail = useCallback(
    () =>
      contactEmail.trim() ||
      `lead+${sessionId.slice(0, 16).replace(/-/g, "")}@inquiry.blacktimber.ca`,
    [contactEmail, sessionId]
  );

  // ── reset on open ──
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setProjectType(initialType || "other");
    }
  }, [isOpen, initialStep, initialType]);

  // ─── photo upload ─────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    setPhotoError(null);
    const remaining = 10 - photos.length;
    const toProcess = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, remaining);
    if (toProcess.length === 0) return;
    try {
      const compressed = await Promise.all(toProcess.map(compressPhoto));
      setPhotos(prev => [
        ...prev,
        ...compressed.map((dataUrl, i) => ({ name: toProcess[i]!.name, dataUrl, note: "" })),
      ]);
    } catch {
      setPhotoError("One or more photos couldn't be loaded. Try a different image.");
    }
  }, [photos.length]);

  const removePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    if (annotatingIdx === i) setAnnotatingIdx(null);
  };

  const updatePhotoNote = (i: number, note: string) => {
    setPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, note } : p));
  };

  // ─── AI analysis (step 3) ─────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 3 || aiResult || aiError) return;

    setAiPending(true);
    setAiLogs([]);
    setAiElapsedMs(0);
    const started = Date.now();

    const photoNotes = photos.map((p, i) => p.note ? `Photo ${i + 1}: "${p.note}"` : "").filter(Boolean).join(" · ");
    const fullNotes = [
      description,
      photoNotes ? `Photo notes — ${photoNotes}` : "",
      budgetRange ? `Customer budget range: ${budgetRange}` : "",
      timeline ? `Timeline: ${timeline}` : "",
      fundingChoice ? `Funding: ${fundingChoice}` : "",
    ].filter(Boolean).join("\n");

    const logQueue = [
      "Receiving project description…",
      photos.length ? `Reading ${photos.length} photo(s) — checking scope, site conditions, access…` : "No photos — analyzing description only…",
      "Cross-referencing East Kootenay material rates and snow load tables…",
      "Computing materials · labour · permits breakdown…",
      "Flagging risk factors and timeline…",
      "Packaging your estimate…",
    ];
    let li = 0;
    const logTimer = setInterval(() => {
      if (li < logQueue.length) { setAiLogs(prev => [...prev, logQueue[li]!]); li++; }
    }, 900);
    const elapsed = setInterval(() => setAiElapsedMs(Date.now() - started), 100);

    (async () => {
      try {
        const res = await fetch("/api/ai/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectType: projectType || "other",
            dimensions: { length: 20, width: 20 },
            material: "other",
            upgrades: [],
            notes: fullNotes || undefined,
            location: location || undefined,
            photos: photos.slice(0, 6).map(p => ({ url: p.dataUrl, kind: "yard" })),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as AiQuoteResult;
        setAiResult(data);
        setAiLogs(prev => [...prev, "Estimate ready."]);
        setTimeout(() => setStep(4), 600);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "AI request failed");
        setAiLogs(prev => [...prev, "Running fallback estimate…"]);
        setTimeout(() => setStep(4), 600);
      } finally {
        setAiPending(false);
        clearInterval(logTimer);
        clearInterval(elapsed);
      }
    })();
    return () => { clearInterval(logTimer); clearInterval(elapsed); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── estimate document (for PDF) ─────────────────────────────────────────

  const estimateDocument = useMemo(() =>
    buildEstimateDocument(
      { projectType: (projectType as Parameters<typeof estimateProject>[0]["projectType"]) || "other", length: 20, width: 20, material: "other", style: "", upgrades: [], corners: 0, gates: 0 },
      aiResult ? { headline: aiResult.headline, disclaimer: aiResult.disclaimer, scopeIncludes: aiResult.scopeIncludes, minUSD: aiResult.estimate.minUSD, maxUSD: aiResult.estimate.maxUSD } : undefined
    ),
    [projectType, aiResult]
  );

  // ─── save lead on step 4 ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || step !== 4 || estimateSaved) return;
    void (async () => {
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "quote_wizard",
            contact: {
              name: contactName || "Website Visitor",
              email: effectiveEmail(),
              phone: contactPhone || undefined,
            },
            website: honeypot,
            payload: {
              stage: "estimate_generated",
              sessionId,
              tags: ["quote-wizard", "estimate-generated", "v2"],
              projectType,
              description,
              location,
              timeline,
              fundingChoice,
              budgetRange,
              photoCount: photos.length,
              photoNotes: photos.map(p => p.note).filter(Boolean),
              estimateDocument,
              aiQuote: aiResult ?? null,
            },
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { leadId?: string };
          if (body.leadId) setSavedLeadId(body.leadId);
          setEstimateSaved(true);
        }
      } catch { /* non-blocking */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, estimateSaved]);

  // ─── booking ──────────────────────────────────────────────────────────────

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setBookingPending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "quote_wizard",
          contact: { name: contactName, email: effectiveEmail(), phone: contactPhone },
          website: honeypot,
          payload: {
            stage: "booked",
            sessionId,
            tags: ["quote-wizard", "consultation-booked", "v2"],
            relatedLeadId: savedLeadId,
            projectType, description, location,
            timeline, fundingChoice, budgetRange,
            preferredDate: bookingDate,
            preferredTime: bookingTime,
            photoCount: photos.length,
            estimateDocument,
            aiQuote: aiResult ?? null,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { leadId?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(body?.error?.message ?? `Submission failed (${res.status})`);
      if (body.leadId) setSavedLeadId(body.leadId);
      setIsBooked(true);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBookingPending(false);
    }
  };

  if (!isOpen) return null;

  const wantsFinancing = fundingChoice === "financing";
  const displayQuote = (() => {
    if (aiResult) return { min: aiResult.estimate.minUSD, max: aiResult.estimate.maxUSD, source: "ai" as const };
    const fb = estimateProject({ projectType: (projectType as Parameters<typeof estimateProject>[0]["projectType"]) || "other", length: 20, width: 20, material: "other", style: "", upgrades: [], corners: 0, gates: 0 });
    return { min: fb.minUSD, max: fb.maxUSD, source: "fallback" as const };
  })();

  const canProceedStep1 = description.trim().length > 10 || photos.length > 0;
  const canProceedStep2 = contactName.trim().length > 0 && contactPhone.trim().length > 6;

  // ── progress ──
  const TOTAL_STEPS = 5;
  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in print:hidden">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-brand-border bg-brand-charcoal text-left shadow-2xl flex flex-col max-h-[96vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border bg-brand-black shrink-0">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png"
              alt="Black Timber Contracting"
              className="h-9 w-auto"
              draggable={false}
            />
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-white leading-none">
                Get a Quote
              </h2>
              <p className="text-[10px] text-brand-gray mt-0.5">Fast · Free · No pressure</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-brand-gray hover:text-white hover:bg-brand-border transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-brand-border shrink-0">
          <div
            className="h-full bg-brand-gold transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step label */}
        <div className="px-5 pt-3 pb-1 shrink-0 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
            {step === 1 && "Step 1 · Show Us Your Project"}
            {step === 2 && "Step 2 · Two Quick Questions"}
            {step === 3 && "Hang tight — running your numbers"}
            {step === 4 && "Your Estimate Is Ready"}
            {step === 5 && "Book a Free Site Visit"}
          </span>
          <span className="text-[10px] font-mono text-brand-gray">{step} / {TOTAL_STEPS}</span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">

          {/* ═══ STEP 1: Photos + Description ════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-5 animate-slide-up">

              {/* Project type quick-pick */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-gray">
                  What are we building? <span className="text-brand-gray/50 font-normal normal-case tracking-normal">(optional — describe below if unsure)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PROJECT_CHIPS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setProjectType(id)}
                      className={`py-3 px-2 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${
                        projectType === id
                          ? "border-brand-gold bg-brand-gold/10 text-white"
                          : "border-brand-border text-brand-gray hover:border-brand-gold/30 hover:text-white"
                      }`}
                    >
                      <Icon className={`w-5 h-5 transition-colors ${projectType === id ? "text-brand-gold" : "text-brand-gray group-hover:text-white"}`} strokeWidth={1.75} />
                      <span className="text-[9px] font-bold uppercase tracking-wider leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description — the star */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-gray">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                  Describe what you need done
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder={
                    `Tell us in your own words — no fancy language needed.\n\nE.g. "I need a fence replaced along my back yard, roughly 80 feet. There's a gate at the driveway. Old fence needs to come down first." Or "Kitchen reno — new cabinets, countertops, and backsplash."`
                  }
                  className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-xl p-4 text-sm text-white placeholder:text-brand-gray/60 resize-none leading-relaxed"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-gray">
                  <MapPin className="w-3.5 h-3.5 text-brand-gold" />
                  What city / town is the job in?
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Sparwood, Cranbrook, Fernie, Nelson…"
                  className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder:text-brand-gray/60"
                />
              </div>

              {/* Photo upload */}
              <div className="space-y-3">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-gray">
                  <Camera className="w-3.5 h-3.5 text-brand-gold" />
                  Upload photos of your space
                  <span className="text-brand-gray/50 font-normal normal-case tracking-normal">(optional but helps a lot)</span>
                </label>

                {photos.length < 10 && (
                  <div
                    className="border-2 border-dashed border-brand-border hover:border-brand-gold/50 rounded-2xl p-6 text-center relative cursor-pointer transition-all bg-brand-black/20"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={e => void handleFiles(e.target.files)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-brand-gold mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">Drag & drop photos here, or tap to browse</p>
                    <p className="text-[11px] text-brand-gray mt-1">
                      Phone photos work great · up to 10 · {photos.length} attached so far
                    </p>
                    <p className="text-[10px] text-brand-gold/70 mt-2">
                      More photos = tighter estimate. Shoot the space from multiple angles if you can.
                    </p>
                  </div>
                )}

                {photoError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{photoError}</p>
                )}

                {/* Photo thumbnails with per-photo notes */}
                {photos.length > 0 && (
                  <div className="space-y-2">
                    {photos.map((p, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-brand-border bg-brand-black/40">
                        <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-brand-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-brand-gray font-mono truncate">{p.name}</span>
                            <button
                              onClick={() => removePhoto(i)}
                              className="p-1 rounded-full hover:text-red-400 text-brand-gray/60 transition-colors shrink-0"
                              aria-label="Remove photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="relative">
                            <Pencil className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-gray/50 pointer-events-none" />
                            <input
                              type="text"
                              value={p.note}
                              onChange={e => updatePhotoNote(i, e.target.value)}
                              placeholder='Add a note, e.g. "this is the back fence" or "fence needs to go here"'
                              className="w-full bg-brand-black border border-brand-border focus:border-brand-gold/60 focus:outline-none rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder:text-brand-gray/50"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!canProceedStep1 && (
                <p className="text-[11px] text-brand-gray text-center">
                  Add at least a photo or a quick description to continue.
                </p>
              )}
            </div>
          )}

          {/* ═══ STEP 2: Soft Questions + Contact ════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6 animate-slide-up">

              {/* Timeline */}
              <div className="space-y-3">
                <label className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-white">
                  <Calendar className="w-4 h-4 text-brand-gold" />
                  When are you hoping to get this done?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "asap",      label: "ASAP",              sub: "I need it done now" },
                    { id: "summer",    label: "This Summer",       sub: "Next few months" },
                    { id: "6months",   label: "3–6 Months",        sub: "Still planning" },
                    { id: "planning",  label: "Just Exploring",    sub: "No set timeline" },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTimeline(t.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        timeline === t.id
                          ? "border-brand-gold bg-brand-gold/10 text-white"
                          : "border-brand-border text-brand-gray hover:border-brand-gold/30 hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider">{t.label}</div>
                      <div className="text-[9px] text-brand-gray mt-0.5 leading-tight">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Financing / budget — soft, non-blunt */}
              <div className="space-y-3">
                <label className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-white">
                  <CreditCard className="w-4 h-4 text-brand-gold" />
                  How are you thinking about the investment?
                </label>
                <p className="text-[11px] text-brand-gray -mt-1">
                  We use this to make sure we bring you the right options — no pressure either way.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: "ready",       label: "Funds are ready to go",          sub: "I know my budget and I'm ready to move" },
                    { id: "open",        label: "Open to fair pricing",            sub: "Show me what it costs, I'll decide from there" },
                    { id: "financing",   label: "Interested in financing",         sub: "I'd love options to pay over time" },
                    { id: "exploring",   label: "Just getting a ballpark",         sub: "Early stages, not committed yet" },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFundingChoice(f.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        fundingChoice === f.id
                          ? "border-brand-gold bg-brand-gold/10 text-white"
                          : "border-brand-border text-brand-gray hover:border-brand-gold/30 hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider leading-snug">{f.label}</div>
                      <div className="text-[10px] text-brand-gray mt-1 leading-snug">{f.sub}</div>
                    </button>
                  ))}
                </div>

                {/* If ready — reveal soft budget range */}
                {fundingChoice === "ready" && (
                  <div className="space-y-2 animate-slide-up pt-1">
                    <p className="text-[11px] text-brand-gray">
                      Roughly what range are you working with? We&apos;ll do our best to land under it.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["Under $5K", "$5K – $15K", "$15K – $30K", "$30K – $60K", "$60K+", "Prefer not to say"].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setBudgetRange(r)}
                          className={`px-4 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all ${
                            budgetRange === r
                              ? "border-brand-gold bg-brand-gold/10 text-white"
                              : "border-brand-border text-brand-gray hover:text-white"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financing reassurance */}
                {fundingChoice === "financing" && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-brand-gold/5 border border-brand-gold/30 animate-slide-up">
                    <CreditCard className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
                    <div className="text-xs text-white leading-relaxed">
                      <strong className="text-brand-gold">We offer financing.</strong> We work with homeowners to find payment plans that fit their situation. We&apos;ll walk you through options on the site visit — no hard sell.
                    </div>
                  </div>
                )}
              </div>

              {/* Contact info */}
              <div className="space-y-3 bg-brand-black/40 rounded-2xl border border-brand-border p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-white">
                  Where should Jaryd reach you?
                </div>
                <p className="text-[11px] text-brand-gray -mt-1">
                  We&apos;ll send your estimate and follow up once — your info stays private.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-brand-gray">Your Name *</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder="First name is fine"
                      required
                      className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-brand-gray/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-gray">
                      <Phone className="w-3 h-3" />
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      placeholder="250-555-0123"
                      required
                      className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-brand-gray/50"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-gray">
                      <Mail className="w-3 h-3" />
                      Email <span className="text-brand-gray/50 font-normal normal-case tracking-normal">(optional — for your estimate PDF)</span>
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-brand-gray/50"
                    />
                  </div>
                </div>
                {/* Honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  aria-hidden="true"
                  className="absolute -left-[9999px] w-1 h-1 opacity-0"
                  name="website"
                />
              </div>

              {!canProceedStep2 && (
                <p className="text-[11px] text-brand-gray text-center">Name and phone are required to continue.</p>
              )}
            </div>
          )}

          {/* ═══ STEP 3: AI Analyzing ════════════════════════════════════════ */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-10 space-y-8 animate-slide-up">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-brand-border" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-brand-gold border-t-transparent animate-spin"
                  style={{ animationDuration: "1.4s" }}
                />
                <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-brand-gold font-mono">
                  {(aiElapsedMs / 1000).toFixed(1)}s
                </div>
              </div>
              <div className="text-center space-y-1 max-w-sm">
                <h4 className="font-bold text-white uppercase tracking-wider text-sm">
                  Black Timber AI is reading your project
                </h4>
                <p className="text-xs text-brand-gray">
                  {aiPending
                    ? "Analysing your photos and description against real Kootenay material costs and regional snow load requirements."
                    : aiError
                    ? "AI hit a snag — loading a deterministic fallback."
                    : "Done — compiling your estimate."}
                </p>
              </div>
              <div className="w-full bg-brand-black rounded-xl border border-brand-border p-4 font-mono text-[11px] text-green-400 space-y-1.5 h-40 overflow-y-auto">
                {aiLogs.map((log, i) => (
                  <div key={i} className="flex items-start">
                    <span className="text-brand-gold mr-2 shrink-0">›</span>
                    <span>{log}</span>
                  </div>
                ))}
                {aiPending && (
                  <div className="animate-pulse flex items-center">
                    <span className="text-brand-gold mr-2">›</span>
                    <span className="w-2 h-3.5 bg-green-400 inline-block" />
                  </div>
                )}
                {aiError && (
                  <div className="flex items-start text-red-400 mt-2">
                    <span className="mr-2">!</span><span>{aiError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Estimate Result ══════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-5 animate-slide-up">

              {/* Financing callout — prominently first if they want it */}
              {wantsFinancing && (
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/40">
                  <CreditCard className="w-6 h-6 text-brand-gold shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-extrabold text-brand-gold uppercase tracking-wider">
                      We Offer Financing — Let&apos;s Make It Work
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">
                      Don&apos;t let budget timing stop a project you need. We work with homeowners on payment structures that fit their situation. Book a site visit and we&apos;ll walk through options — no pressure, no hard sell.
                    </p>
                  </div>
                </div>
              )}

              {/* Headline */}
              <div className="flex items-start justify-between border-b border-brand-border pb-4">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-gold uppercase tracking-widest">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {displayQuote.source === "ai"
                      ? `AI Estimate · ${aiResult!.estimate.confidence} confidence`
                      : "Estimate (specs-based)"}
                  </div>
                  <h3 className="text-lg font-bold uppercase text-white mt-1 leading-snug">
                    {aiResult?.headline ?? "Project Cost Estimate"}
                  </h3>
                </div>
              </div>

              {/* Big range */}
              <div className="bg-brand-black/60 border border-brand-gold/20 p-6 rounded-2xl text-center space-y-2">
                <span className="text-[10px] uppercase tracking-widest text-brand-gray font-bold">Estimated Investment Range</span>
                <div className="text-4xl font-extrabold text-brand-gold font-mono tracking-tight">
                  {usd(displayQuote.min)} – {usd(displayQuote.max)}
                </div>
                {aiResult && (
                  <p className="text-[11px] text-brand-gray">
                    Timeline: <span className="text-white font-bold">{aiResult.timelineWeeks.min}–{aiResult.timelineWeeks.max} weeks</span>
                    {" · "}
                    Materials {usd(aiResult.breakdown.materialsUSD)} · Labour {usd(aiResult.breakdown.laborUSD)} · Permits {usd(aiResult.breakdown.permitsAndFeesUSD)}
                  </p>
                )}
                {budgetRange && budgetRange !== "Prefer not to say" && (
                  <p className="text-[10px] text-brand-gold/80 font-semibold">
                    You mentioned a target around {budgetRange} — we&apos;ll work to hit that on the site visit.
                  </p>
                )}
              </div>

              {/* Scope + risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiResult && (
                  <>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray">What this includes</span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {aiResult.scopeIncludes.map((item, i) => (
                          <div key={i} className="flex items-start text-[11px] text-white/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mr-2 mt-1.5 shrink-0" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-brand-black/30 p-3 rounded-xl border border-brand-border space-y-2">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                        <AlertTriangle className="w-3 h-3" />
                        What could affect the price
                      </span>
                      <div className="space-y-1.5 text-[11px] text-brand-gray">
                        {aiResult.riskFactors.length > 0
                          ? aiResult.riskFactors.map((r, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                                {r}
                              </div>
                            ))
                          : <p>No major risk flags from your inputs.</p>
                        }
                        <p className="pt-1 border-t border-brand-border/40 text-[10px]">
                          <strong className="text-white">Regional:</strong> {aiResult.regionalNotes}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {aiResult && (
                <p className="text-[10px] text-brand-gray italic border-t border-brand-border/40 pt-3">
                  {aiResult.disclaimer}
                </p>
              )}

              {/* PDF download */}
              <div className="flex items-center gap-4 pt-1">
                <DownloadPdfButton
                  filename={estimatePdfFilename(`EST-${sessionId.slice(0, 8).toUpperCase()}`, projectType)}
                  label="Download Estimate PDF"
                  variant="wizard"
                />
                <p className="text-[10px] text-brand-gray flex-1">
                  Branded line-item estimate — download and keep it.
                </p>
              </div>
            </div>
          )}

          {/* ═══ STEP 5: Book Site Visit ══════════════════════════════════════ */}
          {step === 5 && (
            <div className="space-y-6 animate-slide-up">
              {!isBooked ? (
                <form onSubmit={handleBooking} className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">Pick a Time for a Free Site Visit</h3>
                    <p className="text-xs text-brand-gray">Jaryd comes to you, walks the job, and locks in a firm number. No surprises.</p>
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-gray">
                      <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                      Preferred Date
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {nextTwoWeeks().map(d => (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => setBookingDate(d.iso)}
                          className={`p-2.5 rounded-lg border text-center text-xs transition-all ${
                            bookingDate === d.iso
                              ? "bg-brand-gold text-brand-black border-brand-gold font-bold"
                              : "border-brand-border text-brand-gray hover:border-brand-gold/30 hover:text-white"
                          }`}
                        >
                          <span className="block font-bold">{d.label}</span>
                          <span className="text-[9px] uppercase tracking-widest block opacity-70 mt-0.5">{d.day}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time */}
                  {bookingDate && (
                    <div className="space-y-2 animate-slide-up">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-gray">
                        <Clock className="w-3.5 h-3.5 text-brand-gold" />
                        Preferred Time
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {["8:00 AM", "10:30 AM", "1:00 PM", "3:30 PM"].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setBookingTime(t)}
                            className={`p-2.5 rounded-lg border text-[11px] font-mono transition-all ${
                              bookingTime === t
                                ? "bg-brand-gold text-brand-black border-brand-gold font-semibold"
                                : "border-brand-border text-brand-gray hover:border-brand-gold/20"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {bookingError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{bookingError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!bookingDate || !bookingTime || bookingPending}
                    className="w-full py-4 bg-brand-gold disabled:bg-brand-border disabled:text-brand-gray disabled:cursor-not-allowed hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {bookingPending ? (
                      <><Loader className="w-4 h-4 animate-spin" />Sending…</>
                    ) : (
                      <>Confirm Free Site Visit<ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-10 space-y-6 animate-slide-up">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold uppercase text-white">You&apos;re Booked, {contactName}!</h3>
                    <p className="text-sm text-brand-gray max-w-sm mx-auto">
                      Jaryd will confirm your{" "}
                      <strong className="text-brand-gold">{bookingDate} at {bookingTime}</strong> visit by phone or text — usually within a few hours.
                    </p>
                    <p className="text-xs text-brand-gray max-w-sm mx-auto pt-1">
                      Anything urgent? Call or text{" "}
                      <a className="text-brand-gold font-bold underline" href="tel:2509109071">250-910-9071</a> directly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 bg-brand-border text-white text-xs font-bold rounded-xl hover:bg-brand-border/80 uppercase tracking-widest transition-all"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer nav */}
        {step !== 3 && (
          <div className="px-5 py-4 border-t border-brand-border bg-brand-black shrink-0 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(p => Math.max(1, p - 1))}
              disabled={step === 1 || step === 3 || isBooked}
              className="px-4 py-2.5 border border-brand-border hover:border-brand-gold/30 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest text-brand-gray disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Back
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="flex-1 sm:flex-none px-7 py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={!canProceedStep2}
                onClick={() => {
                  setAiResult(null);
                  setAiError(null);
                  setStep(3);
                }}
                className="flex-1 sm:flex-none px-7 py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Run My Estimate
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex-1 sm:flex-none px-7 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
              >
                Book a Free Site Visit <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

      </div>
    </div>

    {/* Off-screen estimate doc for one-click PDF */}
    {step >= 4 && (
      <div className="fixed left-[-12000px] top-0 w-[8.5in] pointer-events-none opacity-0 print:hidden" aria-hidden>
        <WebsiteEstimatePrint
          data={estimateDocument}
          referenceId={`EST-${sessionId.slice(0, 8).toUpperCase()}`}
        />
      </div>
    )}
    </>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function nextTwoWeeks(): { iso: string; label: string; day: string }[] {
  const out: { iso: string; label: string; day: string }[] = [];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (out.length < 8) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0 || cursor.getDay() === 6) continue;
    out.push({
      iso: `${months[cursor.getMonth()]} ${String(cursor.getDate()).padStart(2, "0")}`,
      label: `${months[cursor.getMonth()]} ${String(cursor.getDate()).padStart(2, "0")}`,
      day: days[cursor.getDay()]!,
    });
  }
  return out;
}
