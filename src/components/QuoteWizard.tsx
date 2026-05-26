"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  Clock,
  Calendar,
  CheckCircle,
  ChevronRight,
  X,
  AlertTriangle,
  Sparkles,
  Loader,
} from "lucide-react";

interface QuoteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
}

const STEPS = [
  { id: 1, title: "Project Specs" },
  { id: 2, title: "Media Upload" },
  { id: 3, title: "AI Analysis" },
  { id: 4, title: "Your Quote" },
  { id: 5, title: "Book Site Visit" },
];

type UploadedPhoto = { name: string; dataUrl: string };

// Shape returned by /api/ai/quote — kept narrow so we don't import the full
// zod schema into the client bundle.
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

export default function QuoteWizard({ isOpen, onClose, initialType = "deck" }: QuoteWizardProps) {
  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState(initialType);
  const [dimensions, setDimensions] = useState({ length: 16, width: 12 });
  const [material, setMaterial] = useState("cedar");
  const [upgrades, setUpgrades] = useState<string[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [notes, setNotes] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [contactInfo, setContactInfo] = useState({ name: "", email: "", phone: "", address: "" });
  const [isBooked, setIsBooked] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingPending, setBookingPending] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  // AI analysis state
  const [aiResult, setAiResult] = useState<AiQuoteResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [aiElapsedMs, setAiElapsedMs] = useState(0);
  const [aiPending, setAiPending] = useState(false);

  // Drive the live log stream + run the real AI call when entering step 3.
  useEffect(() => {
    if (step !== 3 || aiResult || aiError) return;

    setAiPending(true);
    setAiLogs([]);
    setAiElapsedMs(0);
    const started = Date.now();

    // Honest progressive log — describes what's actually happening server-side.
    const logQueue = [
      "Sending project specs to Black Timber AI…",
      photos.length
        ? `Uploading ${photos.length} photo(s) for vision analysis…`
        : "No photos attached — running specs-only analysis…",
      "Vision model reading site conditions and geometry…",
      "Cross-referencing East Kootenay snow load + frost-line tables…",
      "Computing material + labor + permit breakdown…",
      "Validating output against estimate schema…",
    ];
    let li = 0;
    const logTimer = setInterval(() => {
      if (li < logQueue.length) {
        setAiLogs((prev) => [...prev, logQueue[li]]);
        li++;
      }
    }, 900);

    const elapsedTimer = setInterval(() => {
      setAiElapsedMs(Date.now() - started);
    }, 100);

    // Fire the real request.
    (async () => {
      try {
        const res = await fetch("/api/ai/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectType,
            dimensions,
            material,
            upgrades,
            notes: notes || undefined,
            photos: photos.map((p) => ({ url: p.dataUrl, kind: "yard" })),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as AiQuoteResult;
        setAiResult(data);
        setAiLogs((prev) => [...prev, "Quote package finalized."]);
        // Brief beat so the user sees the success log before advancing.
        setTimeout(() => setStep(4), 600);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "AI request failed");
        setAiLogs((prev) => [...prev, "AI failed — falling back to deterministic estimate."]);
        setTimeout(() => setStep(4), 600);
      } finally {
        setAiPending(false);
        clearInterval(logTimer);
        clearInterval(elapsedTimer);
      }
    })();

    return () => {
      clearInterval(logTimer);
      clearInterval(elapsedTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!isOpen) return null;

  const toggleUpgrade = (id: string) => {
    setUpgrades((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 6 - photos.length);
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [
          ...prev,
          { name: file.name, dataUrl: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Deterministic fallback (still useful when AI errors or as initial estimate).
  const fallbackPrice = () => {
    const area = dimensions.length * dimensions.width;
    let basePricePerSqFt = 45;
    if (material === "cedar") basePricePerSqFt = 65;
    if (material === "composite") basePricePerSqFt = 85;

    let subtotal = area * basePricePerSqFt;
    if (upgrades.includes("stairs")) subtotal += 1800;
    if (upgrades.includes("lighting")) subtotal += 1200;
    if (upgrades.includes("railing")) subtotal += 2500;
    if (upgrades.includes("pergola")) subtotal += 5500;
    if (upgrades.includes("roof")) subtotal += 8000;

    const min = Math.round(subtotal * 0.9);
    const max = Math.round(subtotal * 1.15);
    return { min, max, area };
  };

  // Resolve which numbers to display in step 4 — AI if we got one, fallback otherwise.
  const displayQuote = (() => {
    if (aiResult) {
      return {
        min: aiResult.estimate.minUSD,
        max: aiResult.estimate.maxUSD,
        area: dimensions.length * dimensions.width,
        source: "ai" as const,
      };
    }
    const fb = fallbackPrice();
    return { ...fb, source: "fallback" as const };
  })();

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
          contact: {
            name: contactInfo.name,
            email: contactInfo.email,
            phone: contactInfo.phone,
            address: contactInfo.address || undefined,
          },
          website, // honeypot — server drops if non-empty
          payload: {
            projectType,
            dimensions,
            material,
            upgrades,
            notes,
            preferredDate: bookingDate,
            preferredTime: bookingTime,
            photoCount: photos.length,
            aiQuote: aiResult ?? null,
            fallbackQuote: aiResult ? null : fallbackPrice(),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message ?? `Submission failed (${res.status})`);
      }
      setIsBooked(true);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBookingPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-brand-border bg-brand-charcoal text-left shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-brand-border bg-brand-black">
          <div className="flex items-center space-x-3">
            <img
              src="https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png"
              alt="Black Timber Contracting"
              className="h-10 w-auto"
              draggable={false}
            />
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight uppercase text-foreground">
                Instant AI Estimate Builder
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-brand-gray hover:text-white hover:bg-brand-border transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 bg-brand-black/40 border-b border-brand-border hidden md:flex justify-between items-center text-xs">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold mr-2 border transition-all ${
                  step === s.id
                    ? "bg-brand-gold text-brand-black border-brand-gold font-bold scale-110 shadow-sm"
                    : step > s.id
                    ? "bg-brand-gold/20 text-brand-gold border-brand-gold/30"
                    : "bg-transparent text-brand-gray border-brand-border"
                }`}
              >
                {step > s.id ? "✓" : s.id}
              </span>
              <span
                className={`font-semibold tracking-wider uppercase ${
                  step === s.id ? "text-brand-gold" : "text-brand-gray"
                }`}
              >
                {s.title}
              </span>
              {idx < STEPS.length - 1 && (
                <div className={`h-[1px] w-8 mx-4 ${step > s.id ? "bg-brand-gold/30" : "bg-brand-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6 animate-slide-up">
              <div>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Project Details</h3>
                <p className="text-sm text-brand-gray">Select what you want to build and choose the dimensions.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "deck", label: "Deck", desc: "Custom outdoor living" },
                  { id: "pergola", label: "Pergola", desc: "Timber & shading" },
                  { id: "garage", label: "Garage", desc: "Parking & framing" },
                  { id: "addition", label: "Addition", desc: "Home expansion" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProjectType(p.id)}
                    className={`p-4 rounded-xl text-left border transition-all glass-panel ${
                      projectType === p.id
                        ? "border-brand-gold bg-brand-gold/5 text-foreground"
                        : "border-brand-border hover:border-brand-gold/30 text-brand-gray hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold text-white uppercase tracking-wider">{p.label}</div>
                    <div className="text-[11px] mt-1 text-brand-gray">{p.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 bg-brand-black/30 p-5 rounded-xl border border-brand-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-wider text-brand-gray">Length (ft)</span>
                    <span className="text-lg font-bold text-brand-gold">{dimensions.length} ft</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={dimensions.length}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, length: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
                  />

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-brand-gray">Width (ft)</span>
                    <span className="text-lg font-bold text-brand-gold">{dimensions.width} ft</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={dimensions.width}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, width: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
                  />
                  <div className="text-[11px] text-right text-brand-gray pt-1">
                    Total Estimated Area:{" "}
                    <span className="text-white font-bold">{dimensions.length * dimensions.width} sq ft</span>
                  </div>
                </div>

                <div className="space-y-4 bg-brand-black/30 p-5 rounded-xl border border-brand-border">
                  <div className="text-sm font-bold uppercase tracking-wider text-brand-gray mb-2">Wood / Material</div>
                  {[
                    { id: "treated", label: "Pressure Treated Wood", price: "Budget-Friendly ($)" },
                    { id: "cedar", label: "Western Red Cedar", price: "Premium Natural ($$)" },
                    { id: "composite", label: "Composite (Trex / TimberTech)", price: "Zero Maintenance ($$$)" },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        material === m.id
                          ? "border-brand-gold bg-brand-gold/5"
                          : "border-brand-border hover:bg-brand-charcoal"
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="material"
                          checked={material === m.id}
                          onChange={() => setMaterial(m.id)}
                          className="mr-3 text-brand-gold accent-brand-gold focus:ring-0"
                        />
                        <span className="text-sm font-bold text-white uppercase">{m.label}</span>
                      </div>
                      <span className="text-[10px] text-brand-gold uppercase tracking-wider font-semibold">{m.price}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-bold uppercase tracking-wider text-brand-gray">Select Add-ons & Features</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: "stairs", label: "Add Stairs" },
                    { id: "lighting", label: "Post & Step Lighting" },
                    { id: "railing", label: "Black Metal Railing" },
                    { id: "pergola", label: "Timber Pergola Structure" },
                    { id: "roof", label: "Covered Solid Patio Roof" },
                  ].map((u) => (
                    <button
                      key={u.id}
                      onClick={() => toggleUpgrade(u.id)}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        upgrades.includes(u.id)
                          ? "border-brand-gold bg-brand-gold/5 text-white"
                          : "border-brand-border text-brand-gray hover:text-white hover:border-brand-gold/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold uppercase tracking-wider">{u.label}</span>
                        {upgrades.includes(u.id) && <span className="text-brand-gold">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-brand-gray">
                  Anything else we should know? (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. corner is on a slope, want hot-tub cutout, attach to existing ledger board…"
                  rows={3}
                  className="w-full bg-brand-black/30 border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg p-3 text-sm text-white placeholder:text-brand-gray resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6 animate-slide-up">
              <div>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Upload Backyard Photos or Sketch</h3>
                <p className="text-sm text-brand-gray">
                  Our vision AI reads photos to check structural attachments, slope, access, and hidden complexity.
                  More photos → tighter estimate. (Up to 6.)
                </p>
              </div>

              <div className="border-2 border-dashed border-brand-border hover:border-brand-gold/40 rounded-xl p-8 text-center bg-brand-black/20 cursor-pointer transition-all relative">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={photos.length >= 6}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Upload className="w-12 h-12 text-brand-gold mx-auto mb-3 animate-bounce" />
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  {photos.length >= 6 ? "Maximum reached" : "Drag & drop photos here, or click to browse"}
                </p>
                <p className="text-xs text-brand-gray mt-1">
                  PNG / JPG — up to 6 photos · {photos.length}/6 attached
                </p>
              </div>

              {photos.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-gray">
                    Attached Photos ({photos.length})
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {photos.map((p, i) => (
                      <div
                        key={i}
                        className="relative aspect-video rounded-lg border border-brand-border overflow-hidden bg-brand-black"
                      >
                        <img src={p.dataUrl} alt={p.name} className="object-cover w-full h-full" />
                        <button
                          onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-black/80 rounded-full p-0.5 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-brand-panel p-4 rounded-lg border border-brand-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Bad at explaining in text?</div>
                  <div className="text-xs text-brand-gray">You can sketch your project directly in our Draw It Out widget.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    const canvasSec = document.getElementById("canvas-section");
                    if (canvasSec) canvasSec.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-4 py-2 border border-brand-gold text-[10px] font-bold text-brand-gold rounded hover:bg-brand-gold hover:text-brand-black transition-all uppercase tracking-widest"
                >
                  Go Sketch Instead
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — real AI analysis */}
          {step === 3 && (
            <div className="space-y-8 py-8 animate-slide-up flex flex-col items-center justify-center">
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 rounded-full border-4 border-brand-border" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-brand-gold border-t-transparent animate-spin"
                  style={{ animationDuration: "1.5s" }}
                />
                <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-brand-gold font-mono">
                  {(aiElapsedMs / 1000).toFixed(1)}s
                </div>
              </div>

              <div className="text-center space-y-2 max-w-md">
                <h4 className="font-bold text-white uppercase tracking-wider text-base">
                  Black Timber AI Vision Pipeline
                </h4>
                <p className="text-xs text-brand-gray">
                  {aiPending
                    ? "Reading your specs, photos, and the regional Kootenay context to compute a defensible estimate."
                    : aiError
                    ? "AI hit a snag — we'll show a deterministic fallback so you don't lose your input."
                    : "Estimate ready — finalizing."}
                </p>
              </div>

              <div className="w-full bg-black rounded-lg border border-brand-border p-4 font-mono text-[11px] text-green-400 space-y-1 h-44 overflow-y-auto scrollbar-thin">
                {aiLogs.map((log, i) => (
                  <div key={i} className="flex items-start">
                    <span className="text-brand-gold mr-2">{">"}</span>
                    <span>{log}</span>
                  </div>
                ))}
                {aiPending && (
                  <div className="animate-pulse flex items-center">
                    <span className="text-brand-gold mr-2">{">"}</span>
                    <span className="w-2 h-4 bg-green-400 inline-block" />
                  </div>
                )}
                {aiError && (
                  <div className="flex items-start text-red-400 mt-2">
                    <span className="mr-2">!</span>
                    <span>{aiError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4 — real AI result, or deterministic fallback */}
          {step === 4 && (
            <div className="space-y-6 animate-slide-up">
              <div className="flex justify-between items-start border-b border-brand-border pb-4">
                <div>
                  <div className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                    {displayQuote.source === "ai"
                      ? `AI Estimate · ${aiResult!.estimate.confidence} confidence`
                      : "Deterministic Estimate (AI offline)"}
                  </div>
                  <h3 className="text-xl font-bold uppercase text-white mt-1">
                    {aiResult?.headline ?? "Rough Pricing Summary"}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-brand-gray uppercase block">Project Area</span>
                  <span className="font-mono font-bold text-white">{displayQuote.area} sq ft</span>
                </div>
              </div>

              <div className="bg-brand-black/50 border border-brand-gold/20 p-6 rounded-xl text-center space-y-2">
                <span className="text-xs uppercase tracking-widest text-brand-gray font-bold">Estimated Cost Bracket</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-gold font-mono tracking-tight">
                  {usd(displayQuote.min)} – {usd(displayQuote.max)}
                </h2>
                {aiResult && (
                  <p className="text-[11px] text-brand-gray max-w-md mx-auto">
                    Timeline: <span className="text-white font-bold">{aiResult.timelineWeeks.min}–{aiResult.timelineWeeks.max} weeks</span>
                    {" · "}
                    Materials {usd(aiResult.breakdown.materialsUSD)} · Labor {usd(aiResult.breakdown.laborUSD)} · Permits {usd(aiResult.breakdown.permitsAndFeesUSD)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-gray">
                    {aiResult ? "What This Price Includes" : "Material Breakdown"}
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {(aiResult?.scopeIncludes ?? defaultIncludes(material, upgrades)).map((item, i) => (
                      <div key={i} className="flex items-start text-xs text-brand-gray">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mr-2 mt-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 bg-brand-panel p-4 rounded-lg border border-brand-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-brand-gold" />
                    {aiResult ? "What Could Push It Out Of Range" : "Kootenay Signal Assessment"}
                  </span>
                  <div className="text-xs space-y-2 text-brand-gray leading-relaxed">
                    {aiResult ? (
                      <>
                        {aiResult.riskFactors.length > 0 ? (
                          <ul className="space-y-1.5">
                            {aiResult.riskFactors.map((r, i) => (
                              <li key={i} className="flex items-start">
                                <span className="w-1 h-1 rounded-full bg-brand-gold mr-2 mt-1.5 flex-shrink-0" />
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-brand-gray">Clean scope — no major risk flags from your inputs.</p>
                        )}
                        <p className="pt-2 border-t border-brand-border/40 mt-2">
                          <strong className="text-white">Regional context:</strong> {aiResult.regionalNotes}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>Permits:</strong> East Kootenay District. Structural design requires municipal review for snow loads.
                        </p>
                        <p>
                          <strong>Frost Line:</strong> Standard footing depth of 48 inches recommended.
                        </p>
                      </>
                    )}
                    <p className="text-[10px] text-brand-gold pt-2">
                      💡 Click &quot;Book Consultation&quot; to lock in materials and reserve a priority site visit.
                    </p>
                  </div>
                </div>
              </div>

              {aiResult && (
                <div className="text-[10px] text-brand-gray italic border-t border-brand-border/40 pt-3">
                  {aiResult.disclaimer}
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — booking */}
          {step === 5 && (
            <div className="space-y-6 animate-slide-up">
              {!isBooked ? (
                <form onSubmit={handleBooking} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Schedule Your Site Visit</h3>
                    <p className="text-sm text-brand-gray">Pick a time for a site layout consult. Real builder. Not a sales rep.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-brand-black/30 p-4 rounded-xl border border-brand-border">
                      <div className="text-xs font-bold uppercase text-brand-gray tracking-wider mb-3 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                        Available Dates (next 2 weeks)
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {nextTwoWeeks().map((d) => (
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

                    <div className="bg-brand-black/30 p-4 rounded-xl border border-brand-border flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase text-brand-gray tracking-wider mb-3 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-brand-gold" />
                          Time Slots
                        </div>
                        {bookingDate ? (
                          <div className="grid grid-cols-2 gap-2">
                            {["08:00 AM", "10:30 AM", "01:00 PM", "03:30 PM"].map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setBookingTime(t)}
                                className={`p-2 rounded border text-[11px] transition-all font-mono ${
                                  bookingTime === t
                                    ? "bg-brand-gold text-brand-black border-brand-gold font-semibold"
                                    : "border-brand-border text-brand-gray hover:border-brand-gold/20"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-brand-gray italic text-center py-6">Select a date first to reveal times.</div>
                        )}
                      </div>

                      {bookingDate && bookingTime && (
                        <div className="text-center text-xs text-brand-gold mt-4 font-mono">
                          Selected: {bookingDate} @ {bookingTime}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 bg-brand-panel p-5 rounded-xl border border-brand-border">
                    <div className="text-xs font-bold uppercase text-white tracking-wider">Contact & Site Address</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Your Name"
                        required
                        value={contactInfo.name}
                        onChange={(e) => setContactInfo((p) => ({ ...p, name: e.target.value }))}
                        className="bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded p-2.5 text-xs text-white placeholder:text-brand-gray"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        required
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo((p) => ({ ...p, email: e.target.value }))}
                        className="bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded p-2.5 text-xs text-white placeholder:text-brand-gray"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        required
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo((p) => ({ ...p, phone: e.target.value }))}
                        className="bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded p-2.5 text-xs text-white placeholder:text-brand-gray"
                      />
                      <input
                        type="text"
                        placeholder="Property Address (optional)"
                        value={contactInfo.address}
                        onChange={(e) => setContactInfo((p) => ({ ...p, address: e.target.value }))}
                        className="bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded p-2.5 text-xs text-white placeholder:text-brand-gray"
                      />
                    </div>
                    {/* Honeypot — visually hidden, bots fill, real users don't */}
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      aria-hidden="true"
                      className="absolute -left-[9999px] w-1 h-1 opacity-0"
                      name="website"
                    />
                  </div>

                  {bookingError && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
                      {bookingError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!bookingDate || !bookingTime || bookingPending}
                    className="w-full py-4 bg-brand-gold disabled:bg-brand-border disabled:text-brand-gray disabled:cursor-not-allowed hover:bg-brand-gold-hover text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {bookingPending ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>Confirm Booking Consultation</>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-10 space-y-6 animate-slide-up">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    <CheckCircle className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold uppercase text-white">Consultation Requested!</h3>
                    <p className="text-sm text-brand-gray max-w-md mx-auto">
                      Thank you, {contactInfo.name}. Your request for{" "}
                      <strong className="text-brand-gold">{bookingDate} at {bookingTime}</strong> has been sent to Jaryd.
                    </p>
                    <p className="text-xs text-brand-gray max-w-md mx-auto">
                      You'll get a confirmation by email or phone within one business day. For anything urgent, call <a className="text-brand-gold underline" href="tel:2509198476">250-919-8476</a>.
                    </p>
                  </div>

                  <div className="bg-brand-panel max-w-sm mx-auto p-4 rounded-lg border border-brand-border space-y-2 text-xs text-brand-gray font-mono">
                    <div className="flex justify-between">
                      <span>Lead reference:</span>
                      <span className="text-white">{contactInfo.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned builder:</span>
                      <span className="text-white">Jaryd (Black Timber)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 bg-brand-border text-white text-xs font-bold rounded-lg hover:bg-brand-border/80 uppercase tracking-widest transition-all"
                  >
                    Close Window
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-brand-border bg-brand-black flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            disabled={step === 1 || step === 3 || isBooked || aiPending}
            className="px-4 py-2 border border-brand-border hover:border-brand-gold/30 hover:text-white rounded-lg text-xs font-bold uppercase tracking-widest text-brand-gray disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Back
          </button>

          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep((prev) => prev + 1)}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black rounded-lg text-xs font-bold uppercase tracking-widest shadow transition-all flex items-center"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={() => setStep(5)}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black rounded-lg text-xs font-bold uppercase tracking-widest shadow transition-all flex items-center"
            >
              Book Site Consultation
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────── helpers ───────────────────────

function defaultIncludes(material: string, upgrades: string[]): string[] {
  const matLabel =
    material === "cedar"
      ? "Premium Western Red Cedar"
      : material === "composite"
      ? "TimberTech/Trex Composite"
      : "Pressure-Treated Structural Wood";
  const base = [
    `${matLabel} planks`,
    "Simpson Strong-Tie structural framing screws & connectors",
    "Helical pile anchors or engineered concrete footings",
    "Weather-resistant flashing & moisture barrier",
  ];
  const u = upgrades.map((up) => {
    if (up === "stairs") return "Custom stringer stairs with landing steps";
    if (up === "lighting") return "Low-voltage LED step & post-cap lighting";
    if (up === "railing") return "Premium black aluminum handrails";
    if (up === "pergola") return "Custom structural timber pergola frame";
    if (up === "roof") return "Engineered heavy snow load solid patio roof";
    return up;
  });
  return [...base, ...u];
}

/** Next 8 weekdays, skipping weekends. */
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
      day: days[cursor.getDay()],
    });
  }
  return out;
}
