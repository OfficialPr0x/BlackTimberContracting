"use client";

import React, { useRef } from "react";
import { CheckCircle2, ArrowRight, ShieldCheck, Clock, Wrench } from "lucide-react";

interface ShowcaseItem {
  img: string;
  tag: string;
  headline: string;
  subline: string;
  body: string;
  bullets: string[];
  trustLine: string;
  flip: boolean;
}

const SHOWCASES: ShowcaseItem[] = [
  {
    img: "https://res.cloudinary.com/dpfapm0tl/image/upload/v1782357513/ChatGPT_Image_Jun_24_2026_08_49_14_PM_dec2yx.png",
    tag: "Kitchen Renovation · Sparwood, BC",
    headline: "A kitchen that finally works — and looks the part.",
    subline: "Full gut-to-finish reno. New cabinets, tile backsplash, countertops, and flooring in one coordinated scope.",
    body: "Most contractors hand you a cabinet installer, a tile guy, and a flooring sub — none of them talk to each other, and you're the one babysitting the chaos. We don't work that way. One crew, one foreman, one accountability chain. The homeowner on this Sparwood kitchen handed us the keys on Monday and had a fully finished space by end of the following week.",
    bullets: [
      "Custom two-tone cabinet layout maximized every inch of storage",
      "Stacked subway-tile backsplash tiled tight to underside of uppers — no gaps, no grout shadows",
      "Laminate countertops precision-cut on-site — no seams at the sink",
      "Hardwood-look LVP flooring laid continuous through kitchen and hallway",
    ],
    trustLine: "No subcontractors. No scheduling gaps. One invoice.",
    flip: false,
  },
  {
    img: "https://res.cloudinary.com/dpfapm0tl/image/upload/v1782357514/ChatGPT_Image_Jun_24_2026_08_49_11_PM_wtjo3b.png",
    tag: "Fence & Deck Rebuild · Sparwood, BC",
    headline: "Rotted, unsafe, embarrassing. Now solid for 20 years.",
    subline: "Full fence teardown and rebuild plus deck reframe — both done in three days on a live property.",
    body: "The before photos say everything. Cracked boards, a gate that wouldn't latch, stairs that shifted under foot. The homeowner had been putting it off for two summers because they didn't want a mess left behind. We stripped both structures, reframed from pressure-treated lumber, and stained the full fence in the same week. The mountain backdrop didn't hurt.",
    bullets: [
      "Cedar fence boards edge-selected for grain consistency — looks like a magazine shot",
      "Gate rehung with heavy-duty galvanized hardware rated for BC winters",
      "Deck stairs reframed with proper stringer spacing — no bounce, no wobble",
      "Oil-based semi-transparent stain applied same day as build — one visit, fully done",
    ],
    trustLine: "Weekend project. Zero mess left behind. Neighbours asked for a quote.",
    flip: true,
  },
  {
    img: "https://res.cloudinary.com/dpfapm0tl/image/upload/v1782357513/ChatGPT_Image_Jun_24_2026_08_49_06_PM_avmwyg.png",
    tag: "Full-Flip Flooring · Cranbrook, BC",
    headline: "6 stages. One crew. Zero callbacks.",
    subline: "Investment property flip — full subfloor prep, LVP install across every room, baseboards and transitions included.",
    body: "Rental flips live and die on timeline. Every day of delay is money out of the investor's pocket. We walked into this Cranbrook property with subfloor issues, old carpet glue, and three doorway elevation changes to deal with. The crew handled all of it in-scope, kept the install schedule on track, and handed back a turnkey floor that photographed beautifully for listing day. Six rooms, staged transitions, continuous run — done right.",
    bullets: [
      "Subfloor leveled and patched before any material went down — no hollow spots",
      "LVP run continuous through living, dining, kitchen, and all three bedrooms",
      "Transitions and reducer strips custom-cut at each doorway — clean sight lines",
      "Baseboards reinstalled same day — property listed that Friday",
    ],
    trustLine: "Investor had a showing booked. We met the deadline. Property sold in 4 days.",
    flip: false,
  },
];

interface WorkShowcaseProps {
  onTriggerQuote?: () => void;
}

export default function WorkShowcase({ onTriggerQuote }: WorkShowcaseProps) {
  return (
    <section id="transformations-section" className="bg-brand-black py-20 sm:py-32 border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Section header */}
        <div className="space-y-3 max-w-2xl">
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            The Work Speaks for Itself
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[1.02]">
            Real projects. <span className="text-brand-gold">Real results.</span>
            <br />No fluff.
          </h2>
          <p className="text-sm text-brand-gray leading-relaxed max-w-xl">
            Every photo below is from an actual Black Timber job site — shot by our crew,
            on a real property, for a real homeowner who trusted us with their home.
          </p>
        </div>
      </div>

      {/* Alternating showcase rows */}
      <div className="mt-16 space-y-0">
        {SHOWCASES.map((item, idx) => (
          <ShowcaseRow key={idx} item={item} onTriggerQuote={onTriggerQuote} />
        ))}
      </div>
    </section>
  );
}

function ShowcaseRow({
  item,
  onTriggerQuote,
}: {
  item: ShowcaseItem;
  onTriggerQuote?: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={rowRef}
      className="border-t border-brand-border/40 py-16 sm:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex flex-col ${
            item.flip ? "lg:flex-row-reverse" : "lg:flex-row"
          } gap-10 lg:gap-20 items-center`}
        >
          {/* ── Photo side ── */}
          <div className="w-full lg:w-[55%] shrink-0">
            <div className="relative group rounded-3xl overflow-hidden border border-brand-border shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.img}
                alt={item.headline}
                className="w-full h-auto block object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {/* Subtle corner gold accent */}
              <span className="absolute top-0 left-0 w-12 h-12 border-t-[3px] border-l-[3px] border-brand-gold/70 rounded-tl-3xl pointer-events-none" />
              <span className="absolute bottom-0 right-0 w-12 h-12 border-b-[3px] border-r-[3px] border-brand-gold/40 rounded-br-3xl pointer-events-none" />

              {/* Tag chip */}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur border border-brand-border text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                {item.tag}
              </div>
            </div>
          </div>

          {/* ── Copy side ── */}
          <div className="w-full lg:w-[45%] space-y-6">
            <div className="space-y-3">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight text-white leading-[1.05]">
                {item.headline}
              </h3>
              <p className="text-brand-gold font-semibold text-sm leading-snug">
                {item.subline}
              </p>
            </div>

            <p className="text-sm text-brand-gray leading-relaxed">
              {item.body}
            </p>

            {/* Bullet list */}
            <ul className="space-y-3">
              {item.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                  <CheckCircle2 className="w-4 h-4 text-brand-gold flex-shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Trust line */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-brand-charcoal border border-brand-border">
              <ShieldCheck className="w-5 h-5 text-brand-gold flex-shrink-0 mt-0.5" />
              <span className="text-xs font-bold text-white leading-snug">
                {item.trustLine}
              </span>
            </div>

            {/* CTA */}
            {onTriggerQuote && (
              <button
                onClick={onTriggerQuote}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all group"
              >
                Want results like this?
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
