"use client";

import React, { useState, useRef, useEffect } from "react";
import { Eye, Sun, Moon, Info, Sparkles } from "lucide-react";

type Material = "cedar" | "composite" | "charcoal";

interface ToggleDef {
  id: string;
  label: string;
  short: string;
}

const TOGGLES: ToggleDef[] = [
  { id: "railing",     label: "Black Aluminum Railing",  short: "Railing" },
  { id: "lighting",    label: "Integrated LED Lighting", short: "LEDs" },
  { id: "pergola",     label: "Timber Pergola Frame",    short: "Pergola" },
  { id: "roof",        label: "Covered Solid Roof",      short: "Roof" },
  { id: "privacy",     label: "Cedar Privacy Wall",      short: "Privacy" },
  { id: "posts",       label: "Heavy Timber Posts",      short: "Posts" },
];

export default function Visualizer() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [material, setMaterial] = useState<Material>("cedar");
  const [active, setActive] = useState<Record<string, boolean>>({
    railing: true,
    lighting: false,
    pergola: false,
    roof: false,
    privacy: false,
    posts: true,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const toggle = (id: string) => setActive((s) => ({ ...s, [id]: !s[id] }));

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPosition(pct);
  };

  useEffect(() => {
    const onUp = () => (dragging.current = false);
    const onMove = (e: MouseEvent) => dragging.current && handleMove(e.clientX);
    const onTouch = (e: TouchEvent) => dragging.current && e.touches.length > 0 && handleMove(e.touches[0].clientX);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  const getMaterialFilter = () => {
    if (material === "charcoal")  return "hue-rotate(15deg) brightness(0.55) contrast(1.15) saturate(0.2)";
    if (material === "composite") return "hue-rotate(-15deg) brightness(0.78) contrast(1.08) saturate(0.55)";
    return "none";
  };

  const activeCount = Object.values(active).filter(Boolean).length;

  return (
    <section className="space-y-6" id="visualizer-section">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Design Your Dream — Live
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white mt-1">
            Visualizer Studio
          </h3>
          <p className="text-xs text-brand-gray max-w-md">
            Drag the slider. Tap any feature. Watch your future deck mutate in real time.
          </p>
        </div>

        {/* Material switcher */}
        <div className="flex rounded-lg bg-brand-black p-1 border border-brand-border text-[10px] font-bold uppercase tracking-wider">
          {[
            { id: "cedar",     label: "Red Cedar" },
            { id: "composite", label: "Ash Composite" },
            { id: "charcoal",  label: "Charcoal Stain" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMaterial(m.id as Material)}
              className={`px-3 py-1.5 rounded transition-all ${
                material === m.id
                  ? "bg-brand-gold text-brand-black"
                  : "text-brand-gray hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visualizer canvas */}
        <div
          ref={containerRef}
          className="lg:col-span-9 relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden border border-brand-border select-none cursor-ew-resize shadow-2xl bg-brand-black"
        >
          {/* BEFORE */}
          <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: "url('/before.png')" }}>
            <div className="absolute top-4 left-4 px-3 py-1 bg-black/80 backdrop-blur-md rounded text-[10px] font-bold tracking-widest text-white uppercase border border-white/10">
              Before
            </div>
          </div>

          {/* AFTER (clipped) */}
          <div
            className="absolute inset-0 w-full h-full overflow-hidden transition-all duration-75"
            style={{ width: `${sliderPosition}%` }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: "url('/after.png')",
                width: containerRef.current?.clientWidth ?? "100%",
                filter: getMaterialFilter(),
              }}
            />

            <div className="absolute top-4 right-4 px-3 py-1 bg-brand-gold rounded text-[10px] font-bold tracking-widest text-brand-black uppercase shadow">
              After
            </div>

            {/* Heavy timber posts overlay */}
            {active.posts && (
              <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none">
                <div className="absolute left-[18%] bottom-0 w-3 h-[70%] bg-gradient-to-t from-brand-wood to-brand-wood-light opacity-90 shadow-[0_0_18px_2px_rgba(0,0,0,0.6)]" />
                <div className="absolute left-[45%] bottom-0 w-3 h-[65%] bg-gradient-to-t from-brand-wood to-brand-wood-light opacity-90 shadow-[0_0_18px_2px_rgba(0,0,0,0.6)]" />
                <div className="absolute left-[72%] bottom-0 w-3 h-[68%] bg-gradient-to-t from-brand-wood to-brand-wood-light opacity-90 shadow-[0_0_18px_2px_rgba(0,0,0,0.6)]" />
              </div>
            )}

            {/* Railing overlay */}
            {active.railing && (
              <div className="absolute inset-x-0 bottom-[18%] h-16 pointer-events-none">
                <div className="absolute inset-x-0 top-0 h-1 bg-brand-black/90" />
                <div
                  className="w-full h-full opacity-90"
                  style={{
                    backgroundImage: "linear-gradient(90deg, transparent 0px, transparent 14px, #0b0a09 14px, #0b0a09 17px)",
                    backgroundSize: "22px 100%",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-1 bg-brand-black/90" />
              </div>
            )}

            {/* Pergola overhead */}
            {active.pergola && (
              <div className="absolute inset-x-0 top-[8%] h-12 pointer-events-none">
                <div className="absolute inset-x-[8%] top-0 h-3 bg-brand-wood shadow-md" />
                <div className="absolute inset-x-[8%] top-4 h-full opacity-90"
                  style={{
                    backgroundImage: "linear-gradient(90deg, transparent 0px, transparent 30px, var(--color-brand-wood) 30px, var(--color-brand-wood) 36px)",
                    backgroundSize: "50px 100%",
                  }}
                />
              </div>
            )}

            {/* Covered solid roof */}
            {active.roof && (
              <div className="absolute inset-x-0 top-0 h-[28%] pointer-events-none">
                <div className="absolute inset-x-[6%] top-3 h-2 bg-brand-wood-light" />
                <div
                  className="absolute inset-x-[6%] top-5 h-[85%] opacity-70"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(28,25,23,0.85) 0%, rgba(28,25,23,0.25) 100%)",
                    clipPath: "polygon(0 0, 100% 0, 96% 100%, 4% 100%)",
                  }}
                />
              </div>
            )}

            {/* Privacy wall side */}
            {active.privacy && (
              <div className="absolute right-0 top-[20%] bottom-[10%] w-[14%] pointer-events-none">
                <div
                  className="w-full h-full opacity-95"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, var(--color-brand-wood) 0px, var(--color-brand-wood) 14px, rgba(0,0,0,0.4) 14px, rgba(0,0,0,0.4) 17px)",
                  }}
                />
              </div>
            )}

            {/* LED lighting */}
            {active.lighting && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-brand-gold/10 mix-blend-color-burn" />
                {[20, 35, 50, 65, 80].map((x) => (
                  <div
                    key={x}
                    className="absolute bottom-[18%] w-2.5 h-2.5 rounded-full bg-yellow-300 blur-[2px] shadow-[0_0_14px_5px_rgba(253,224,71,0.8)] animate-pulse"
                    style={{ left: `${x}%` }}
                  />
                ))}
                <div className="absolute top-[18%] inset-x-[10%] h-8 flex justify-around opacity-90">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-yellow-200 shadow-[0_0_15px_6px_rgba(253,224,71,0.9)] animate-pulse"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Slider divider */}
          <div
            className="absolute inset-y-0 w-[2px] bg-brand-gold cursor-ew-resize z-20"
            style={{ left: `${sliderPosition}%` }}
            onMouseDown={() => (dragging.current = true)}
            onTouchStart={() => (dragging.current = true)}
          >
            <div className="w-10 h-10 rounded-full bg-brand-gold text-brand-black flex items-center justify-center slider-handle absolute z-30 font-bold top-1/2 -translate-y-1/2 -translate-x-1/2 left-0">
              ↔
            </div>
          </div>
        </div>

        {/* Feature toggles panel (right, 3 cols) */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="p-4 rounded-2xl border border-brand-gold/30 bg-brand-charcoal flex items-center justify-between">
            <div>
              <span className="text-[9px] text-brand-gray uppercase tracking-widest font-bold block">
                Active Features
              </span>
              <span className="text-2xl font-extrabold text-brand-gold font-mono">
                {activeCount}<span className="text-brand-gray text-base">/{TOGGLES.length}</span>
              </span>
            </div>
            <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {TOGGLES.map((t) => {
              const on = active[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`relative px-3 py-3 rounded-xl border text-left transition-all overflow-hidden ${
                    on
                      ? "border-brand-gold/50 bg-brand-gold/10 text-white shadow-[inset_0_0_0_1px_rgba(197,168,128,0.2)]"
                      : "border-brand-border bg-brand-panel/40 text-brand-gray hover:text-white hover:border-brand-gold/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest leading-tight">
                      {t.short}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold ${
                        on ? "text-brand-gold" : "text-brand-gray/50"
                      }`}
                    >
                      {on ? "ON" : "OFF"}
                    </span>
                  </div>
                  <span className="text-[9px] text-brand-gray block mt-1 leading-snug">
                    {t.label}
                  </span>
                  {on && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-gold" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-brand-black/60 border border-brand-border text-[10px] font-mono text-brand-gray">
            <span className="flex items-center gap-1.5">
              {active.lighting ? <Moon className="w-3 h-3 text-brand-gold" /> : <Sun className="w-3 h-3" />}
              {active.lighting ? "Dusk Mode" : "Day Mode"}
            </span>
            <span className="text-brand-gold">{material === "cedar" ? "Cedar" : material === "composite" ? "Composite" : "Charcoal"}</span>
          </div>
        </aside>
      </div>

      {/* Helper info */}
      <div className="flex gap-2.5 p-4 rounded-xl border border-brand-border bg-brand-panel/30 text-xs text-brand-gray">
        <Info className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
        <p>
          Tap features to layer them on. Each combo automatically updates the live cost engine below.
          When you&apos;re ready, lock the configuration into a real AI quote — no email gate.
        </p>
      </div>
    </section>
  );
}
