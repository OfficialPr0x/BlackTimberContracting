"use client";

import React, { useState } from "react";
import { Play, Tv, Clock, Eye, X, Volume2, VolumeX, SkipForward, Flame, ChevronRight } from "lucide-react";

interface Episode {
  id: string;
  category: string;
  title: string;
  hook: string;
  duration: string;
  views: string;
  thumbnail: string;
  description: string;
  featured?: boolean;
}

const EPISODES: Episode[] = [
  {
    id: "v1",
    category: "Flagship",
    title: "Building a Mountain Deck on a Cliff",
    hook: "Fernie, BC. 20° slope. 12-foot drop. We anchored it with helical screws in -8°C.",
    duration: "14:22",
    views: "32.1k",
    thumbnail: "/patio_fernie.png",
    description:
      "Four-week build condensed into 14 minutes. Drone footage, framing detail, the moment a beam almost slipped off the lift, and how we engineered around bedrock.",
    featured: true,
  },
  {
    id: "v2",
    category: "Repair Job",
    title: "Massive Mistake We Inherited (And Fixed)",
    hook: "Another contractor's ledger board was nailed — not bolted. Here's the fix.",
    duration: "8:03",
    views: "18.7k",
    thumbnail: "/before.png",
    description:
      "Jaryd walks through a jobsite audit where he found a previous contractor's incorrect ledger fastening and shows step-by-step how to correct it without tearing the whole structure down.",
  },
  {
    id: "v3",
    category: "Budget Save",
    title: "Customer Thought This Would Cost $60k…",
    hook: "Sarah was quoted $58,400 by two other contractors. We delivered at $32,800.",
    duration: "6:18",
    views: "24.5k",
    thumbnail: "/deck_cranbrook.png",
    description:
      "How a re-engineered post layout, a smarter joist span, and ordering composite direct from the mill turned a 'no' into the deck of her dreams — without cutting a single corner.",
  },
  {
    id: "v4",
    category: "Storm Chase",
    title: "Snowstorm Build Challenge",
    hook: "−22°C. Wind chill -34°C. Pergola had to be up before clients flew home.",
    duration: "9:47",
    views: "41.2k",
    thumbnail: "/hero_bg.png",
    description:
      "We don't shut down for weather. Watch the team work through a Kootenay blizzard to hit a non-negotiable deadline. Heated tents, propane warmers, and 14-hour days.",
  },
  {
    id: "v5",
    category: "Tech Breakdown",
    title: "Why Concrete Piers Are Already Dead",
    hook: "If you're still using concrete pads, your deck has a frost-line clock on it.",
    duration: "5:31",
    views: "11.4k",
    thumbnail: "/after.png",
    description:
      "An in-depth breakdown of helical screw piling torque values, stability on sloped terrain, and why we guarantee them for life.",
  },
  {
    id: "v6",
    category: "Raw Cam",
    title: "Day In The Life of a Black Timber Crew",
    hook: "5:30am coffee to 7pm tools-down. No edits, no voiceover. Just the build.",
    duration: "22:14",
    views: "8.9k",
    thumbnail: "/patio_fernie.png",
    description:
      "Strapped a GoPro to Jaryd for an entire workday on a Cranbrook composite deck job. The good, the muddy, the radio chatter.",
  },
];

const CATEGORIES = ["all", "Flagship", "Repair Job", "Budget Save", "Storm Chase", "Tech Breakdown", "Raw Cam"];

export default function ContractorTV() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [playingVideo, setPlayingVideo] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(30);

  const featured = EPISODES.find((e) => e.featured) ?? EPISODES[0];
  const others = EPISODES.filter((e) => e.id !== featured.id);
  const filtered = activeCategory === "all"
    ? others
    : others.filter((e) => e.category === activeCategory);

  return (
    <section className="space-y-10" id="tv-section">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5" />
            Black Timber TV
          </span>
          <h3 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white mt-1 leading-[1.02]">
            Contractor <span className="text-gold-shimmer">Netflix</span>
          </h3>
          <p className="text-xs text-brand-gray mt-1 max-w-md">
            Real episodes. Real jobsites. Pick a story and watch contractors actually do the work.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-brand-black p-1 border border-brand-border rounded-lg text-[10px] font-bold uppercase tracking-wider max-w-full overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-brand-gold text-brand-black"
                  : "text-brand-gray hover:text-white"
              }`}
            >
              {cat === "all" ? "All Episodes" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* FEATURED EPISODE HERO */}
      <div
        onClick={() => { setPlayingVideo(featured); setIsPlaying(true); }}
        className="group relative rounded-3xl overflow-hidden border border-brand-border cursor-pointer h-[420px] sm:h-[460px]"
      >
        <div
          className="absolute inset-0 bg-cover bg-center animate-ken-burns-slow group-hover:scale-110 transition-transform duration-700"
          style={{ backgroundImage: `url('${featured.thumbnail}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/95 via-transparent to-transparent" />

        <div className="relative h-full max-w-3xl flex flex-col justify-end p-6 sm:p-10 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300">
              <Flame className="w-3 h-3" />
              Featured Episode
            </span>
            <span className="px-2.5 py-1 rounded-full bg-brand-black/60 border border-brand-border text-brand-gold">
              {featured.category}
            </span>
            <span className="text-brand-gray font-mono">{featured.duration}</span>
          </div>

          <h3 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[1.02]">
            {featured.title}
          </h3>
          <p className="text-base text-white/80 max-w-xl leading-relaxed italic">
            {featured.hook}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={(e) => { e.stopPropagation(); setPlayingVideo(featured); setIsPlaying(true); }}
              className="px-6 py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-brand-black" />
              Play Episode
            </button>
            <span className="text-xs text-brand-gray font-mono flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-brand-gold" />
              {featured.views} views
            </span>
          </div>
        </div>

        {/* Floating play orb (right side) */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-brand-gold/25 animate-ping" />
            <span className="relative w-24 h-24 rounded-full bg-brand-gold/95 text-brand-black grid place-items-center shadow-2xl group-hover:scale-110 transition-transform">
              <Play className="w-10 h-10 fill-brand-black pl-1" />
            </span>
          </div>
        </div>
      </div>

      {/* Episode grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((v) => (
          <div
            key={v.id}
            onClick={() => { setPlayingVideo(v); setIsPlaying(true); }}
            className="group bg-brand-panel rounded-2xl overflow-hidden border border-brand-border cursor-pointer glass-panel-hover flex flex-col"
          >
            <div className="relative aspect-video bg-brand-charcoal overflow-hidden border-b border-brand-border">
              <img
                src={v.thumbnail}
                alt={v.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

              <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold text-brand-gold uppercase tracking-wider border border-brand-gold/30 bg-brand-black/70 backdrop-blur">
                {v.category}
              </div>
              <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-mono text-white flex items-center gap-1 border border-white/10">
                <Clock className="w-2.5 h-2.5" />
                {v.duration}
              </div>
              <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-14 h-14 rounded-full bg-brand-gold text-brand-black grid place-items-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                  <Play className="w-5 h-5 fill-brand-black" />
                </div>
              </div>

              {/* Episode title overlay (bottom) */}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h4 className="font-extrabold text-white text-base uppercase tracking-tight leading-snug line-clamp-2 group-hover:text-brand-gold transition-colors">
                  {v.title}
                </h4>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
              <p className="text-xs text-brand-gray italic leading-relaxed line-clamp-2">
                &ldquo;{v.hook}&rdquo;
              </p>
              <div className="flex items-center justify-between text-[9px] text-brand-gray font-mono pt-2 border-t border-brand-border/40">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3 h-3 text-brand-gold" />
                  {v.views} views
                </span>
                <span className="flex items-center gap-1 text-brand-gold uppercase tracking-widest font-bold">
                  Watch
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Player modal */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-5xl rounded-2xl border border-brand-border bg-brand-charcoal overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-brand-border bg-brand-black">
              <span className="text-[10px] font-bold text-brand-gold uppercase tracking-wider flex items-center gap-1">
                <Tv className="w-4 h-4" /> Now Playing · {playingVideo.category}
              </span>
              <button
                onClick={() => setPlayingVideo(null)}
                className="p-1 rounded-full hover:bg-brand-border hover:text-white text-brand-gray transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <img
                src={playingVideo.thumbnail}
                alt="Video playing"
                className={`w-full h-full object-cover opacity-70 ${isPlaying ? "animate-pulse" : ""}`}
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20 pointer-events-none" />
              )}
              {!isPlaying && (
                <div className="absolute p-4 bg-brand-black/80 rounded-full text-brand-gold border border-brand-gold/30">
                  <Play className="w-8 h-8 fill-brand-gold pl-1" />
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-10 space-y-3">
                <div className="space-y-1">
                  <div className="w-full h-1 bg-white/20 rounded-full relative">
                    <div className="bg-brand-gold h-full rounded-full" style={{ width: `${videoProgress}%` }} />
                    <div
                      className="absolute w-2.5 h-2.5 bg-white rounded-full -top-0.75 -translate-x-1/2 cursor-grab shadow"
                      style={{ left: `${videoProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-brand-gray">
                    <span>0:45</span>
                    <span>{playingVideo.duration}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 rounded hover:text-brand-gold transition-all">
                      <span className="font-mono text-xs font-bold tracking-widest uppercase">
                        {isPlaying ? "PAUSE" : "PLAY"}
                      </span>
                    </button>
                    <button onClick={() => setVideoProgress((p) => Math.min(100, p + 10))} className="p-1 rounded hover:text-brand-gold transition-all">
                      <SkipForward className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsMuted(!isMuted)} className="p-1 rounded hover:text-brand-gold transition-all">
                      {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-brand-gold" />}
                    </button>
                  </div>
                  <span className="text-[9px] font-mono text-brand-gray">1080p HD · Raw Cam</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-brand-black space-y-4">
              <div>
                <h4 className="font-bold text-white uppercase text-base tracking-wide">{playingVideo.title}</h4>
                <p className="text-xs text-brand-gray mt-1 leading-relaxed">{playingVideo.description}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-brand-panel border border-brand-border">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Got a structural question about this build?</div>
                  <p className="text-[10px] text-brand-gray">Ask Jaryd directly about the framing, anchors, or material choices.</p>
                </div>
                <button
                  onClick={() => {
                    alert("Opening discussion drawer with Jaryd about: " + playingVideo.title);
                  }}
                  className="px-4 py-2 border border-brand-gold text-[10px] font-bold text-brand-gold rounded hover:bg-brand-gold hover:text-brand-black transition-all uppercase tracking-widest"
                >
                  Ask Builder Jaryd
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
