"use client";

import React from "react";
import { Star, MapPin } from "lucide-react";

interface Review {
  city: string;
  name: string;
  text: string;
  project: string;
}

const REVIEWS: Review[] = [
  { city: "Fernie",     name: "Marcus L.",  project: "Covered Pergola",          text: "Heavy timber joinery is flawless. Worked through snow delays, hit the target." },
  { city: "Cranbrook",  name: "Sarah J.",   project: "Multi-Level Sun Deck",     text: "Thought it would cost $40k. They engineered a workaround that saved me $7k." },
  { city: "Sparwood",   name: "Robert K.",  project: "Mountain Deck",            text: "Sloped property locked in with helical screws. Solid build, solid crew." },
  { city: "Elkford",    name: "Douglas W.", project: "Gazebo & Screen Room",     text: "Backyard now feels like a 5-star Kootenay ski chalet. Recommend them daily." },
  { city: "Kelowna",    name: "Linda H.",   project: "Lakeside Cedar Deck",      text: "Managed every permit. Layout integrates perfectly with the pool." },
  { city: "Nelson",     name: "James P.",   project: "Heritage Porch Rebuild",   text: "Communication was insane. Daily photos, real builder texting me back." },
  { city: "Kimberley",  name: "Erin S.",    project: "Ski Cabin Wraparound",     text: "Showed up in -22°C and didn't blink. The deck holds 4 feet of snow easy." },
  { city: "Invermere",  name: "Tristan B.", project: "Lake View Composite Deck", text: "Zero hidden costs. Final invoice was within $200 of the AI quote." },
  { city: "Trail",      name: "Megan A.",   project: "Detached Garage Build",    text: "Framed and roofed in 9 days. Inspector said it was the cleanest he'd seen." },
  { city: "Castlegar",  name: "Brian H.",   project: "Custom Cedar Privacy",     text: "8-foot privacy wall, no warping a year later. They build like it's their own." },
];

function Chip({ r }: { r: Review }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-brand-charcoal/80 border border-brand-border hover:border-brand-gold/40 transition-all backdrop-blur-md shrink-0 max-w-md">
      <div className="flex text-brand-gold">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-3 h-3 fill-brand-gold" />
        ))}
      </div>
      <span className="text-[10px] uppercase font-bold tracking-widest text-brand-gold flex items-center gap-1 whitespace-nowrap">
        <MapPin className="w-3 h-3" />
        {r.city}
      </span>
      <span className="text-xs text-white/80 italic line-clamp-1 max-w-[28ch]">
        &ldquo;{r.text}&rdquo;
      </span>
      <span className="text-[10px] font-mono text-brand-gray whitespace-nowrap">— {r.name}</span>
    </div>
  );
}

interface ReviewsTickerProps {
  speed?: "fast" | "slow";
  reverse?: boolean;
}

/**
 * Edge-to-edge marquee of customer review chips. Uses CSS animation on a
 * single duplicated track so the loop is perfectly seamless.
 */
export default function ReviewsTicker({ speed = "slow", reverse = false }: ReviewsTickerProps) {
  const duration = speed === "fast" ? "45s" : "75s";

  return (
    <div className="relative w-full overflow-hidden cinema-edge-fade marquee-pause" aria-label="Customer reviews">
      <div
        className="marquee-track gap-3 py-1"
        style={{
          ["--marquee-duration" as string]: duration,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {[...REVIEWS, ...REVIEWS].map((r, i) => (
          <Chip key={`${r.city}-${i}`} r={r} />
        ))}
      </div>
    </div>
  );
}
