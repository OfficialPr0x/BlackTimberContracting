"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, MoveHorizontal, MapPin } from "lucide-react";

interface Transformation {
  id: string;
  title: string;
  city: string;
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  budget: string;
  duration: string;
}

const TRANSFORMATIONS: Transformation[] = [
  {
    id: "fernie-deck",
    title: "Rotted Pine Deck → Heavy Timber Build",
    city: "Fernie, BC",
    before: "/before.png",
    after: "/after.png",
    beforeLabel: "12yr-old pressure treated deck",
    afterLabel: "Cantilevered cedar w/ helical piles",
    budget: "$24,500",
    duration: "3 wks",
  },
  {
    id: "cranbrook-yard",
    title: "Dead Backyard → Multi-Level Outdoor Living",
    city: "Cranbrook, BC",
    before: "/before.png",
    after: "/deck_cranbrook.png",
    beforeLabel: "Patchy lawn, no shade",
    afterLabel: "Composite + black aluminum railing",
    budget: "$32,800",
    duration: "4 wks",
  },
  {
    id: "fernie-patio",
    title: "Exposed Patio → Covered Timber Pergola",
    city: "Fernie, BC",
    before: "/before.png",
    after: "/patio_fernie.png",
    beforeLabel: "Concrete slab, no cover",
    afterLabel: "Doug-fir pergola, polycarbonate roof",
    budget: "$18,900",
    duration: "2.5 wks",
  },
  {
    id: "sparwood-mountain",
    title: "Sloped Yard → Engineered Mountain Deck",
    city: "Sparwood, BC",
    before: "/before.png",
    after: "/after.png",
    beforeLabel: "20° natural slope, unusable",
    afterLabel: "Tiered deck w/ steel anchors",
    budget: "$18,200",
    duration: "2 wks",
  },
  {
    id: "elkford-gazebo",
    title: "Wind-Swept Lot → Screened Gazebo Retreat",
    city: "Elkford, BC",
    before: "/before.png",
    after: "/hero_bg.png",
    beforeLabel: "Open wind, no privacy",
    afterLabel: "Cedar + glass screen room",
    budget: "$29,000",
    duration: "3.5 wks",
  },
];

function SingleSlider({ t }: { t: Transformation }) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    const onUp = () => (dragging.current = false);
    const onMove = (e: MouseEvent) => {
      if (dragging.current) move(e.clientX);
    };
    const onTouch = (e: TouchEvent) => {
      if (dragging.current && e.touches.length > 0) move(e.touches[0].clientX);
    };
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
  }, [move]);

  return (
    <div className="snap-center shrink-0 w-[88vw] sm:w-[640px] lg:w-[760px] relative group">
      <div className="rounded-2xl overflow-hidden border border-brand-border bg-brand-black shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] glass-panel-hover">
        {/* Image stage */}
        <div
          ref={containerRef}
          className="relative aspect-[16/10] cursor-ew-resize select-none"
          onMouseDown={(e) => {
            dragging.current = true;
            move(e.clientX);
          }}
          onTouchStart={(e) => {
            dragging.current = true;
            if (e.touches.length > 0) move(e.touches[0].clientX);
          }}
        >
          {/* BEFORE (bottom) */}
          <img
            src={t.before}
            alt={`Before — ${t.title}`}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded text-[9px] font-bold tracking-widest text-white uppercase border border-white/10">
            Before
          </div>

          {/* AFTER (clipped overlay) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${position}%` }}
          >
            <img
              src={t.after}
              alt={`After — ${t.title}`}
              className="absolute inset-0 h-full w-auto max-w-none object-cover"
              style={{ width: containerRef.current?.clientWidth ?? "100%" }}
              draggable={false}
            />
            <div className="absolute top-3 right-3 px-2.5 py-1 bg-brand-gold rounded text-[9px] font-bold tracking-widest text-brand-black uppercase shadow">
              After
            </div>
          </div>

          {/* Divider + handle */}
          <div
            className="absolute inset-y-0 w-[2px] bg-brand-gold z-20"
            style={{ left: `${position}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0">
              <div className="w-10 h-10 rounded-full bg-brand-gold text-brand-black flex items-center justify-center slider-handle font-bold">
                <MoveHorizontal className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Bottom dark gradient for legibility */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

          {/* Caption strip overlay */}
          <div className="absolute inset-x-0 bottom-0 p-4 flex justify-between items-end gap-3 pointer-events-none">
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/70 leading-tight">
              <span className="block text-white/50">Before</span>
              {t.beforeLabel}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-brand-gold leading-tight text-right">
              <span className="block text-brand-gold/60">After</span>
              {t.afterLabel}
            </div>
          </div>
        </div>

        {/* Meta footer */}
        <div className="p-5 flex items-center justify-between gap-4 border-t border-brand-border bg-brand-charcoal">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white uppercase tracking-tight truncate">
              {t.title}
            </h4>
            <div className="text-[10px] text-brand-gray uppercase tracking-widest font-semibold mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-brand-gold" />
              {t.city}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 text-[10px] font-mono">
            <span className="px-2.5 py-1 rounded border border-brand-border text-white">{t.budget}</span>
            <span className="px-2.5 py-1 rounded border border-brand-border text-brand-gold">{t.duration}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BeforeAfterWall() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    if (!scrollerRef.current) return;
    const w = scrollerRef.current.clientWidth;
    scrollerRef.current.scrollBy({ left: dir * w * 0.85, behavior: "smooth" });
  };

  return (
    <section className="space-y-8" id="transformations-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div className="max-w-xl">
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest">
            Holy Sh*t Wall
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white mt-1 leading-[1.05]">
            Before. <span className="text-gold-shimmer">After.</span> Drag the middle.
          </h2>
          <p className="text-xs text-brand-gray mt-3 leading-relaxed">
            Five real Kootenay transformations. Swipe left to keep going. Drag the gold handle on any image to reveal the build.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll(-1)}
            aria-label="Previous transformation"
            className="w-11 h-11 rounded-full border border-brand-border hover:border-brand-gold hover:text-brand-gold text-white grid place-items-center transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Next transformation"
            className="w-11 h-11 rounded-full border border-brand-border hover:border-brand-gold hover:text-brand-gold text-white grid place-items-center transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal infinite-feel scroller */}
      <div
        ref={scrollerRef}
        className="snap-x-mandatory overflow-x-auto flex gap-6 pb-6 px-4 sm:px-6 lg:px-8 cinema-edge-fade"
      >
        {TRANSFORMATIONS.map((t) => (
          <SingleSlider key={t.id} t={t} />
        ))}
        {/* End card encouraging more */}
        <div className="snap-center shrink-0 w-[88vw] sm:w-[480px] grid place-items-center rounded-2xl border border-dashed border-brand-border bg-brand-charcoal/30 text-center p-8">
          <div className="space-y-3 max-w-xs">
            <div className="text-3xl text-brand-gold font-extrabold tracking-tight">+ 140</div>
            <div className="text-[10px] text-brand-gray uppercase font-bold tracking-widest">
              More transformations on the map
            </div>
            <p className="text-xs text-brand-gray">
              Every project tagged, photographed, and locked into the live jobsite map below.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
