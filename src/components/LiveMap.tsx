"use client";

import React, { useState } from "react";
import { MapPin, X, Star, Calendar, DollarSign, Hammer } from "lucide-react";

interface ProjectPin {
  id: string;
  city: string;
  title: string;
  budget: string;
  timeline: string;
  material: string;
  review: string;
  client: string;
  image: string;
  x: number; // percentage from left
  y: number; // percentage from top
}

const PROJECTS: ProjectPin[] = [
  {
    id: "fernie",
    city: "Fernie",
    title: "Covered Timber Patio & Pergola",
    budget: "$24,500",
    timeline: "3 Weeks",
    material: "Western Red Cedar",
    review: "The heavy timber joinery is absolutely flawless. Jaryd and the crew worked through mountain snow delays and finished right on target.",
    client: "Marcus L.",
    image: "/patio_fernie.png",
    x: 65,
    y: 75
  },
  {
    id: "cranbrook",
    city: "Cranbrook",
    title: "Premium Multi-Level Sun Deck",
    budget: "$32,800",
    timeline: "4 Weeks",
    material: "TimberTech Composite",
    review: "I thought it would cost 40k. They found a structural framing workaround that saved me over 7k. Unbelievable efficiency and service.",
    client: "Sarah J.",
    image: "/deck_cranbrook.png",
    x: 45,
    y: 70
  },
  {
    id: "sparwood",
    city: "Sparwood",
    title: "Heavy-Duty Mountain Deck",
    budget: "$18,200",
    timeline: "2 Weeks",
    material: "Pressure Treated & Steel Rods",
    review: "Solid build. Solid team. They did helical screw anchors which means my sloped property is completely locked in.",
    client: "Robert K.",
    image: "/after.png",
    x: 75,
    y: 50
  },
  {
    id: "elkford",
    city: "Elkford",
    title: "Structural Gazebo & Screen Room",
    budget: "$29,000",
    timeline: "3.5 Weeks",
    material: "Cedar & Glass Panels",
    review: "Exceptional timber work. Our backyard looks like a 5-star Kootenay ski chalet now. Recommend them to everyone.",
    client: "Douglas W.",
    image: "/hero_bg.png",
    x: 78,
    y: 35
  },
  {
    id: "kelowna",
    city: "Kelowna",
    title: "Lakeside Modern Cedar Deck",
    budget: "$42,000",
    timeline: "5 Weeks",
    material: "Clear Red Cedar Planks",
    review: "Amazing build quality. They managed all permit inspections and designed a layout that integrates perfectly with our pool.",
    client: "Linda H.",
    image: "/deck_cranbrook.png",
    x: 20,
    y: 55
  }
];

export default function LiveMap() {
  const [selectedProject, setSelectedProject] = useState<ProjectPin | null>(PROJECTS[1]); // Cranbrook pre-selected

  return (
    <section className="space-y-6" id="map-section">
      <div>
        <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Kootenay & BC Coverage Map
        </span>
        <h3 className="text-2xl font-bold uppercase tracking-tight text-white mt-1">
          Active Jobsite Map
        </h3>
        <p className="text-xs text-brand-gray">
          Click any active project pin to see recent photo uploads, exact material specs, project budgets, and client handshakes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-brand-panel p-6 rounded-2xl border border-brand-border shadow-xl items-stretch">
        
        {/* SVG/Interactive Map Panel (Left side - 7 cols) */}
        <div className="lg:col-span-7 bg-brand-black rounded-xl border border-brand-border aspect-[4/3] relative overflow-hidden flex items-center justify-center p-4">
          
          {/* Simulated BC Map Background Lines */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M 50,50 L 150,120 L 220,100 L 280,180 L 350,150 L 420,280 L 480,240 L 580,350 L 600,450" fill="none" stroke="#c5a880" strokeWidth="2" />
              <path d="M 120,200 L 180,280 L 290,320 L 390,380 L 490,440" fill="none" stroke="#c5a880" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="50" cy="50" r="3" fill="#c5a880" />
              <circle cx="150" cy="120" r="3" fill="#c5a880" />
              <circle cx="280" cy="180" r="3" fill="#c5a880" />
              <circle cx="480" cy="240" r="3" fill="#c5a880" />
            </svg>
          </div>

          {/* Mountains Silhouette lines */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 opacity-5 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon points="0,100 20,40 40,80 60,30 80,70 100,20 100,100" fill="#c5a880" />
            </svg>
          </div>

          {/* Map Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(28,25,23,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(28,25,23,0.3)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

          {/* Region Label */}
          <div className="absolute top-4 left-4 text-[10px] font-mono text-brand-gold uppercase tracking-widest">
            British Columbia, Canada
          </div>

          {/* Map Pins */}
          {PROJECTS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 z-10"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {/* Pulsing ring */}
              <span className={`absolute -inset-2 rounded-full animate-ping opacity-40 ${
                selectedProject?.id === p.id ? "bg-brand-gold" : "bg-brand-gray group-hover:bg-brand-gold/40"
              }`} style={{ animationDuration: "3s" }} />

              {/* Pin body */}
              <div className={`p-2 rounded-full border transition-all shadow-md flex items-center justify-center ${
                selectedProject?.id === p.id 
                  ? "bg-brand-gold text-brand-black border-brand-gold scale-125" 
                  : "bg-brand-charcoal text-brand-gold border-brand-border group-hover:border-brand-gold/50 group-hover:scale-110"
              }`}>
                <MapPin className="w-4 h-4" />
              </div>

              {/* Hover label */}
              <div className="absolute top-9 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 backdrop-blur-md rounded text-[9px] font-bold text-white uppercase tracking-wider border border-brand-border whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                {p.city}
              </div>
            </button>
          ))}

          {/* Map Scale */}
          <div className="absolute bottom-4 left-4 text-[9px] font-mono text-brand-gray flex items-center gap-1">
            <span className="w-8 h-[2px] bg-brand-gray inline-block" />
            <span>50 KM</span>
          </div>

          <div className="absolute bottom-4 right-4 text-[10px] font-bold text-brand-gold uppercase tracking-widest bg-brand-charcoal/80 px-3 py-1 rounded border border-brand-border">
            Kootenays → BC Wide
          </div>
        </div>

        {/* Project Card Display (Right side - 5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {selectedProject ? (
            <div className="bg-brand-black p-5 rounded-xl border border-brand-border space-y-4 flex-1 flex flex-col justify-between animate-slide-up">
              
              {/* Project Image */}
              <div className="relative aspect-video rounded-lg overflow-hidden border border-brand-border bg-brand-charcoal">
                <img 
                  src={selectedProject.image} 
                  alt={selectedProject.title} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-brand-gold text-brand-black px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded">
                  {selectedProject.city}
                </div>
              </div>

              {/* Title & Stats */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-white text-base uppercase tracking-tight leading-snug">
                    {selectedProject.title}
                  </h4>
                  <span className="text-[10px] text-brand-gold uppercase tracking-wider font-semibold">
                    Spec: {selectedProject.material}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-brand-charcoal p-2 rounded border border-brand-border flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-brand-gold" />
                    <div>
                      <span className="text-[8px] text-brand-gray block uppercase">Cost</span>
                      <span className="text-white font-bold">{selectedProject.budget}</span>
                    </div>
                  </div>
                  <div className="bg-brand-charcoal p-2 rounded border border-brand-border flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                    <div>
                      <span className="text-[8px] text-brand-gray block uppercase">Duration</span>
                      <span className="text-white font-bold">{selectedProject.timeline}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Review Box */}
              <div className="bg-brand-panel p-4 rounded-lg border border-brand-border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-brand-gray font-bold uppercase tracking-wider">Customer Feedback</span>
                  <div className="flex text-brand-gold">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-brand-gold" />
                    ))}
                  </div>
                </div>
                <blockquote className="text-[11px] text-brand-gray italic leading-relaxed">
                  &quot;{selectedProject.review}&quot;
                </blockquote>
                <div className="text-[10px] text-white font-bold text-right">
                  — {selectedProject.client}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-brand-black p-8 rounded-xl border border-brand-border flex items-center justify-center text-center text-xs text-brand-gray italic flex-1">
              Select a location pin on the map to reveal project details.
            </div>
          )}

          {/* Quick Stats banner */}
          <div className="bg-brand-gold/5 p-4 rounded-xl border border-brand-gold/10 flex justify-around text-center text-xs font-mono">
            <div>
              <span className="text-[8px] text-brand-gray block uppercase">Total builds</span>
              <span className="text-brand-gold font-bold">140+ Projects</span>
            </div>
            <div className="border-l border-brand-border h-8" />
            <div>
              <span className="text-[8px] text-brand-gray block uppercase">Average rating</span>
              <span className="text-brand-gold font-bold">5.0 Star</span>
            </div>
            <div className="border-l border-brand-border h-8" />
            <div>
              <span className="text-[8px] text-brand-gray block uppercase">Avg Timeline</span>
              <span className="text-brand-gold font-bold">2.5 Weeks</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
