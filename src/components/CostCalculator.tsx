"use client";

import React, { useState } from "react";
import { Calculator, ArrowRight, Sliders, Shield, BadgeDollarSign, Lock, Sparkles, Loader } from "lucide-react";
import { DECK_UPGRADE_USD, estimateDeck, type DeckUpgrade } from "@/lib/pricing/deck-engine";

interface CostCalculatorProps {
  onTriggerQuote: () => void;
}

interface AiExplainResult {
  narrative: string;
  adjustedRangeUSD: { min: number; max: number };
  experienceNote: string;
  callouts: string[];
}

type Material = "treated" | "cedar" | "composite";

interface UpgradeState {
  stairs: boolean;
  lighting: boolean;
  railing: boolean;
  pergola: boolean;
  roof: boolean;
  skirting: boolean;
  privacy: boolean;
  posts: boolean;
}

const UPGRADE_COSTS = DECK_UPGRADE_USD as Record<keyof UpgradeState, number>;

export default function CostCalculator({ onTriggerQuote }: CostCalculatorProps) {
  const [dimensions, setDimensions] = useState({ length: 20, width: 16 });
  const [material, setMaterial] = useState<Material>("cedar");
  const [upgrades, setUpgrades] = useState<UpgradeState>({
    stairs: true,
    lighting: true,
    railing: true,
    pergola: false,
    roof: false,
    skirting: false,
    privacy: false,
    posts: true,
  });

  const [aiExplain, setAiExplain] = useState<AiExplainResult | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const toggle = (key: keyof UpgradeState) => {
    setUpgrades((prev) => ({ ...prev, [key]: !prev[key] }));
    // Invalidate stale AI explanation on any config change.
    setAiExplain(null);
    setAiError(null);
  };

  const requestAiExplain = async () => {
    setAiPending(true);
    setAiError(null);
    setAiExplain(null);
    try {
      const res = await fetch("/api/ai/explain-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          length: dimensions.length,
          width: dimensions.width,
          material,
          upgrades,
          deterministicRangeUSD: { min: rawMin(), max: rawMax() },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
      }
      setAiExplain((await res.json()) as AiExplainResult);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI sanity-check failed");
    } finally {
      setAiPending(false);
    }
  };

  const deckEstimate = () =>
    estimateDeck({
      length: dimensions.length,
      width: dimensions.width,
      material,
      upgrades: upgrades as Partial<Record<DeckUpgrade, boolean>>,
    });

  const rawMin = () => deckEstimate().minUSD;
  const rawMax = () => deckEstimate().maxUSD;

  const calc = () => {
    const est = deckEstimate();
    const min = aiExplain?.adjustedRangeUSD.min ?? est.minUSD;
    const max = aiExplain?.adjustedRangeUSD.max ?? est.maxUSD;
    const fmt = (n: number) =>
      n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    return {
      min: fmt(min),
      max: fmt(max),
      area: est.areaSqFt,
      materialCost: fmt(est.materialsUSD + est.upgradesUSD),
      laborCost: fmt(est.laborUSD + est.profitUSD),
      permitCost: fmt(est.permitsUSD),
      midpoint: Math.round((min + max) / 2),
    };
  };

  const e = calc();

  return (
    <div className="space-y-8" id="calculator-section">
      {/* Section header */}
      <div className="max-w-2xl space-y-2">
        <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
          <BadgeDollarSign className="w-4 h-4" />
          No BS Live Pricing Engine
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-[1.05]">
          Real numbers. <span className="text-gold-shimmer">Right now.</span> No email gate.
        </h2>
        <p className="text-sm text-brand-gray leading-relaxed">
          Move the sliders. Tap the upgrades. Rates are anchored to Fernie HH / Home Hardware
          material costs plus real install labor — competitive enough to win, priced to profit.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Configurator (left, 7 cols) */}
        <div className="lg:col-span-7 bg-brand-panel p-6 sm:p-8 rounded-2xl border border-brand-border space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Configure Your Build
              </span>
              <h4 className="text-xl font-bold uppercase tracking-tight text-white mt-1">
                Deck dimensions & spec
              </h4>
            </div>

            {/* Size sliders */}
            <div className="space-y-4 bg-brand-black/30 p-5 rounded-xl border border-brand-border">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-gray flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-brand-gold" />
                  Length (ft)
                </span>
                <span className="text-base font-bold text-brand-gold font-mono">{dimensions.length} ft</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                value={dimensions.length}
                onChange={(ev) => setDimensions((p) => ({ ...p, length: parseInt(ev.target.value) }))}
                className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-gray flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-brand-gold" />
                  Width (ft)
                </span>
                <span className="text-base font-bold text-brand-gold font-mono">{dimensions.width} ft</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                value={dimensions.width}
                onChange={(ev) => setDimensions((p) => ({ ...p, width: parseInt(ev.target.value) }))}
                className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
              <div className="text-[11px] text-right text-brand-gray pt-1 font-mono">
                Total Area: <span className="text-white font-bold">{e.area} sq ft</span>
              </div>
            </div>

            {/* Materials */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-gray block">
                Decking Material
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: "treated",   label: "Pressure Treated", sub: "Standard outdoor pine" },
                  { id: "cedar",     label: "Western Red Cedar", sub: "Natural timber scent" },
                  { id: "composite", label: "Composite Planks", sub: "TimberTech zero-maintenance" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMaterial(m.id as Material)}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      material === m.id
                        ? "border-brand-gold bg-brand-gold/5 text-white shadow-[inset_0_0_0_1px_rgba(197,168,128,0.15)]"
                        : "border-brand-border text-brand-gray hover:text-white hover:border-brand-gold/30"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide">{m.label}</span>
                    <span className="text-[9px] text-brand-gray mt-1 font-normal leading-snug">{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upgrades */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-gray">
                  Upgrades & Add-ons
                </span>
                <span className="text-[10px] font-mono text-brand-gold">
                  {(Object.keys(upgrades) as (keyof UpgradeState)[]).filter((k) => upgrades[k]).length} active
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {([
                  { id: "stairs",   label: "Stairs" },
                  { id: "lighting", label: "LED Lighting" },
                  { id: "railing",  label: "Black Railing" },
                  { id: "pergola",  label: "Pergola" },
                  { id: "roof",     label: "Covered Roof" },
                  { id: "skirting", label: "Cedar Skirting" },
                  { id: "privacy",  label: "Privacy Wall" },
                  { id: "posts",    label: "Timber Posts" },
                ] as { id: keyof UpgradeState; label: string }[]).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`relative px-3 py-2.5 rounded-lg border text-left text-xs transition-all overflow-hidden ${
                      upgrades[u.id]
                        ? "border-brand-gold bg-brand-gold/10 text-white"
                        : "border-brand-border text-brand-gray hover:text-white hover:border-brand-gold/30"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold uppercase tracking-wider text-[10px] leading-tight">{u.label}</span>
                      {upgrades[u.id] && <span className="text-brand-gold">✓</span>}
                    </div>
                    <span className="block text-[9px] font-mono text-brand-gray mt-0.5">
                      +${UPGRADE_COSTS[u.id].toLocaleString()}
                    </span>
                    {upgrades[u.id] && (
                      <span className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-gold" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-brand-gray border-t border-brand-border/40 pt-4 mt-4 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-brand-gold flex-shrink-0" />
            <span>Includes engineering permit filings + Simpson Strong-Tie structural anchors.</span>
          </div>
        </div>

        {/* Live price panel (right, 5 cols) */}
        <div className="lg:col-span-5 bg-brand-black p-6 sm:p-8 rounded-2xl border border-brand-gold/30 flex flex-col justify-between text-left space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-5 relative">
            <div>
              <span className="text-[10px] text-brand-gray uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-brand-gold" />
                Live Cost Range — No Surprise Clauses
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-brand-gold font-mono tracking-tight mt-2 leading-none">
                {e.min}
                <span className="text-brand-gray text-2xl mx-2">–</span>
                {e.max}
              </div>
              <p className="text-[10px] text-brand-gray leading-relaxed mt-1.5">
                Updates every time you toggle a slider. Tight range — final site visit confirms slope, access, and footing type.
              </p>
            </div>

            <div className="h-[1px] divider-gold" />

            <div className="space-y-3">
              <span className="text-[10px] text-brand-gray uppercase tracking-wider font-bold block">
                Where Your Money Goes
              </span>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-brand-gray">Timber & hardware</span>
                  <span className="text-white font-bold">{e.materialCost}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-brand-gray">Inspections & permits</span>
                  <span className="text-white font-bold">{e.permitCost}</span>
                </div>
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-brand-gray">Craftsmanship labor</span>
                  <span className="text-white font-bold">{e.laborCost}</span>
                </div>
              </div>
            </div>

            {/* AI sanity-check panel */}
            <div className="p-4 rounded-xl bg-brand-panel border border-brand-border space-y-2">
              {!aiExplain && !aiPending && !aiError && (
                <>
                  <span className="text-[10px] text-brand-gold font-bold uppercase tracking-wider">Black Timber Guarantee</span>
                  <ul className="text-[10px] text-brand-gray space-y-1.5 leading-relaxed">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-brand-gold" /> No corner cutting policy strictly enforced.
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-brand-gold" /> Helical pile foundations — no sagging.
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-brand-gold" /> 5-Year structural warranty in writing.
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={requestAiExplain}
                    className="mt-2 w-full px-3 py-2 border border-brand-gold/40 hover:bg-brand-gold/10 text-brand-gold text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3" />
                    Have AI sanity-check this price
                  </button>
                </>
              )}

              {aiPending && (
                <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-brand-gold uppercase tracking-widest font-bold">
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  AI reviewing your config…
                </div>
              )}

              {aiError && (
                <div className="space-y-2">
                  <div className="text-[10px] text-red-400">{aiError}</div>
                  <button
                    type="button"
                    onClick={requestAiExplain}
                    className="text-[10px] text-brand-gold underline uppercase tracking-widest"
                  >
                    Try again
                  </button>
                </div>
              )}

              {aiExplain && (
                <div className="space-y-2 animate-slide-up">
                  <span className="text-[10px] text-brand-gold font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> AI sanity-check
                  </span>
                  <p className="text-[11px] text-brand-gray leading-relaxed">
                    {aiExplain.narrative}
                  </p>
                  <p className="text-[10px] text-white italic leading-relaxed pt-1 border-t border-brand-border/40">
                    {aiExplain.experienceNote}
                  </p>
                  <ul className="text-[10px] text-brand-gray space-y-1 pt-1">
                    {aiExplain.callouts.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-brand-gold mt-1.5 flex-shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onTriggerQuote}
            className="relative w-full py-4 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
          >
            Lock In My Exact Quote
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
