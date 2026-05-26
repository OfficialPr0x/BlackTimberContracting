"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Camera, MapPin } from "lucide-react";
import { JOB_PHOTOS } from "@/data/jobPhotos";

/**
 * The Job Gallery — wall of real Black Timber builds.
 *
 * - CSS columns masonry so every photo fits its native aspect without cropping.
 * - "Load more" pager keeps the initial DOM light.
 * - Click any tile to open a fullscreen lightbox; arrows/swipes/keys to navigate.
 * - Subtle gold gradient + city chip overlay on hover so the wall reads like
 *   a curated portfolio, not a Facebook dump.
 */

const PAGE_SIZE = 18;

const CITY_CYCLE = [
  "Cranbrook",
  "Fernie",
  "Sparwood",
  "Elkford",
  "Kimberley",
  "Nelson",
  "Invermere",
  "Trail",
  "Castlegar",
];

interface JobGalleryProps {
  onTriggerQuote?: () => void;
}

export default function JobGallery({ onTriggerQuote }: JobGalleryProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const visible = JOB_PHOTOS.slice(0, visibleCount);
  const hasMore = visibleCount < JOB_PHOTOS.length;

  const openLightbox = useCallback((i: number) => setLightboxIdx(i), []);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const nextLightbox = useCallback(() => {
    setLightboxIdx((i) => (i === null ? null : (i + 1) % JOB_PHOTOS.length));
  }, []);
  const prevLightbox = useCallback(() => {
    setLightboxIdx((i) =>
      i === null ? null : (i - 1 + JOB_PHOTOS.length) % JOB_PHOTOS.length
    );
  }, []);

  // Keyboard nav for the lightbox
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextLightbox();
      if (e.key === "ArrowLeft") prevLightbox();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIdx, closeLightbox, nextLightbox, prevLightbox]);

  return (
    <section id="job-gallery" className="space-y-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div className="max-w-xl space-y-3">
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            Real Builds · Real Photos
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[1.02]">
            Every photo here is{" "}
            <span className="text-brand-gold">our crew.</span>
          </h2>
          <p className="text-sm text-brand-gray leading-relaxed">
            {JOB_PHOTOS.length}+ builds across the Kootenays and BC. Tap any
            photo to view full-frame. No stock images — ever.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-brand-gray uppercase tracking-widest">
          <span>
            <span className="text-brand-gold font-bold">{JOB_PHOTOS.length}</span> photos
          </span>
          <span className="opacity-50">·</span>
          <span>
            <span className="text-brand-gold font-bold">12+</span> yrs
          </span>
          <span className="opacity-50">·</span>
          <span>
            <span className="text-brand-gold font-bold">9</span> service cities
          </span>
        </div>
      </div>

      {/* Masonry wall */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
          {visible.map((src, i) => (
            <button
              key={src}
              onClick={() => openLightbox(i)}
              className="group relative mb-4 break-inside-avoid block w-full overflow-hidden rounded-2xl border border-brand-border bg-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              style={{ animation: `fade-in 0.6s ease-out both`, animationDelay: `${(i % PAGE_SIZE) * 40}ms` }}
              aria-label={`Open photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Black Timber Contracting build #${i + 1}`}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="w-full h-auto block object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />

              {/* Hover gradient + meta overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-gold text-brand-black text-[9px] font-bold uppercase tracking-widest">
                  <MapPin className="w-3 h-3" />
                  {CITY_CYCLE[i % CITY_CYCLE.length]}
                </span>
                <span className="text-[9px] font-mono text-white/80">
                  #{String(i + 1).padStart(3, "0")}
                </span>
              </div>

              {/* Persistent gold corner accent */}
              <span className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-brand-gold/0 group-hover:border-brand-gold/80 transition-all duration-500 rounded-tl-lg" />
            </button>
          ))}
        </div>

        {/* Load more / CTA strip */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, JOB_PHOTOS.length))}
              className="px-7 py-3.5 border border-brand-border hover:border-brand-gold/50 text-white font-bold uppercase tracking-widest text-xs rounded-xl transition-all"
            >
              Show {Math.min(PAGE_SIZE, JOB_PHOTOS.length - visibleCount)} more photos
            </button>
          )}
          {!hasMore && (
            <span className="text-xs font-mono text-brand-gray uppercase tracking-widest">
              You&apos;ve seen all {JOB_PHOTOS.length} photos.
            </span>
          )}
          {onTriggerQuote && (
            <button
              onClick={onTriggerQuote}
              className="px-7 py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
            >
              Start Your Build →
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center animate-fade-in"
          onClick={closeLightbox}
        >
          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 px-4 sm:px-8 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-bold font-mono">
              <span className="px-2.5 py-1 rounded-full bg-brand-gold text-brand-black flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                {CITY_CYCLE[lightboxIdx % CITY_CYCLE.length]}
              </span>
              <span className="text-brand-gray">
                Build #{String(lightboxIdx + 1).padStart(3, "0")} of {JOB_PHOTOS.length}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
              className="p-2 rounded-full border border-brand-border hover:border-brand-gold/40 hover:text-brand-gold text-white transition-all"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); prevLightbox(); }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-[61] w-12 h-12 rounded-full border border-brand-border hover:border-brand-gold/50 hover:text-brand-gold bg-black/40 text-white grid place-items-center transition-all"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Image */}
          <div className="relative max-w-[95vw] max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={JOB_PHOTOS[lightboxIdx]}
              alt={`Black Timber Contracting build #${lightboxIdx + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-brand-border shadow-[0_50px_120px_-20px_rgba(0,0,0,0.9)]"
              draggable={false}
            />
          </div>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); nextLightbox(); }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-[61] w-12 h-12 rounded-full border border-brand-border hover:border-brand-gold/50 hover:text-brand-gold bg-black/40 text-white grid place-items-center transition-all"
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Thumb strip */}
          <div className="absolute bottom-4 inset-x-0 px-4 overflow-x-auto snap-x-mandatory" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-start sm:justify-center gap-1.5 mx-auto w-max">
              {JOB_PHOTOS.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setLightboxIdx(i)}
                  className={`snap-center shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden border transition-all ${
                    lightboxIdx === i
                      ? "border-brand-gold scale-110"
                      : "border-brand-border/60 opacity-50 hover:opacity-100"
                  }`}
                  aria-label={`Jump to photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
