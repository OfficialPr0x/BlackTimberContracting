"use client";

import React, { useState } from "react";
import { Lock, CloudRain, Sun, User, Camera, ShieldCheck } from "lucide-react";
import { PORTAL_PHOTOS } from "@/data/jobPhotos";

interface ProjectSession {
  clientName: string;
  city: string;
  projectTitle: string;
  status: string;
  completion: number;
  totalCost: number;
  paid: number;
  activeStage: string;
  weather: string;
  crew: string[];
  stages: { name: string; status: "completed" | "active" | "pending" }[];
  logs: { date: string; text: string; image: string }[];
  availableUpgrades: { id: string; name: string; cost: number; desc: string }[];
}

const DEMO_SESSIONS: Record<string, ProjectSession> = {
  marcus: {
    clientName: "Marcus L.",
    city: "Fernie, BC",
    projectTitle: "Covered Timber Patio & Pergola",
    status: "Active - Framing Stage",
    completion: 60,
    totalCost: 24500,
    paid: 12250,
    activeStage: "Framing & Pergola Truss Setup",
    weather: "Rain Shower Delay (1-Day extension applied)",
    crew: ["Jaryd (Lead Builder)", "Tyler (Apprentice)"],
    stages: [
      { name: "Drafting & Engineered Prints", status: "completed" },
      { name: "RDEK Permit Issuance", status: "completed" },
      { name: "Helical Screw Pile Install", status: "completed" },
      { name: "Timber Support Framing", status: "active" },
      { name: "Cedar Pergola & Rafters", status: "pending" },
      { name: "Final Inspection", status: "pending" }
    ],
    logs: [
      {
        date: "May 22, 2026",
        text: "Support posts anchored. Placed helical screw anchors at 6,000 lbs torque to bypass frost line.",
        image: PORTAL_PHOTOS[0]
      },
      {
        date: "May 20, 2026",
        text: "Zoning review finalized with regional district. Site cleared and layout stakes set.",
        image: PORTAL_PHOTOS[1]
      }
    ],
    availableUpgrades: [
      { id: "wall", name: "6ft Cedar Privacy Wall", cost: 1500, desc: "Add a custom cedar slat privacy screen to the western exposure." },
      { id: "light", name: "LED Ambient Lighting Pack", cost: 1200, desc: "Low-voltage post-cap and stair-riser LED lighting with smart controller." }
    ]
  },
  sarah: {
    clientName: "Sarah J.",
    city: "Cranbrook, BC",
    projectTitle: "Premium Multi-Level Sun Deck",
    status: "Active - Decking Installation",
    completion: 80,
    totalCost: 32800,
    paid: 25000,
    activeStage: "Composite Plank Fastening",
    weather: "Clear Skies (Work proceeding on schedule)",
    crew: ["Jaryd (Lead Builder)", "Alex (Apprentice)"],
    stages: [
      { name: "Structural Design Prints", status: "completed" },
      { name: "City Permit Approval", status: "completed" },
      { name: "Helical Footing Placement", status: "completed" },
      { name: "Structural Joist Framing", status: "completed" },
      { name: "TimberTech Plank Installation", status: "active" },
      { name: "Final Inspection Approval", status: "pending" }
    ],
    logs: [
      {
        date: "May 23, 2026",
        text: "Plank laying started. Utilizing hidden fasteners for a clean, screw-free composite surface.",
        image: PORTAL_PHOTOS[2]
      },
      {
        date: "May 18, 2026",
        text: "Double-flashing moisture barrier applied along the ledger board. Framing structure approved by inspector.",
        image: PORTAL_PHOTOS[3]
      }
    ],
    availableUpgrades: [
      { id: "glass", name: "Tempered Glass Railing Panels", cost: 2800, desc: "Swap standard black spindles for clear tempered glass panels to open up the view." },
      { id: "bench", name: "Integrated Timber Corner Bench", cost: 950, desc: "Built-in cedar corner bench matching deck specifications." }
    ]
  }
};

export default function ProjectPortal() {
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [session, setSession] = useState<ProjectSession | null>(null);
  const [approvedUpgrades, setApprovedUpgrades] = useState<string[]>([]);

  const handleLogin = (key: string) => {
    setSessionKey(key);
    setSession(JSON.parse(JSON.stringify(DEMO_SESSIONS[key]))); // Deep clone to avoid mutating preset
  };

  const handleLogout = () => {
    setSessionKey(null);
    setSession(null);
    setApprovedUpgrades([]);
  };

  const handleUpgradeApproval = (upgradeId: string, cost: number) => {
    if (!session) return;
    
    // Add to approved checklist
    setApprovedUpgrades(prev => [...prev, upgradeId]);
    
    // Modify session live state
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        totalCost: prev.totalCost + cost,
        availableUpgrades: prev.availableUpgrades.filter(u => u.id !== upgradeId),
        logs: [
          {
            date: "Today (Just Approved)",
            text: `Change Order Signed: Approved addition of ${prev.availableUpgrades.find(u => u.id === upgradeId)?.name} for ${cost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}. Timeline and design package updated.`,
            image: prev.logs[0].image
          },
          ...prev.logs
        ]
      };
    });
  };

  return (
    <section className="space-y-6 animate-fade-in" id="portal-section">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Client Command Center
          </span>
          <h3 className="text-2xl font-bold uppercase tracking-tight text-white mt-1">
            Project Portal
          </h3>
          <p className="text-xs text-brand-gray">
            Where transparency meets high performance. Active clients log in to watch daily updates, sign change orders, and track invoices.
          </p>
        </div>

        {session && (
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-brand-border hover:border-red-500/30 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all"
          >
            Logout Command Center
          </button>
        )}
      </div>

      {!session ? (
        // LOGIN VIEW
        <div className="bg-brand-panel p-8 sm:p-12 rounded-2xl border border-brand-border text-center space-y-6 max-w-xl mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-brand-gold/5 text-brand-gold border border-brand-gold/10 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h4 className="font-extrabold text-white text-lg uppercase tracking-wider">Client Login Simulation</h4>
            <p className="text-xs text-brand-gray max-w-sm mx-auto leading-relaxed">
              No dead brochures here. Clients log in directly to oversee the active jobsite. Select one of our active demo accounts below to explore.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => handleLogin("marcus")}
              className="px-5 py-3 border border-brand-gold/30 hover:border-brand-gold bg-brand-black hover:bg-brand-gold/5 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex-1"
            >
              Marcus L. (Fernie Deck Build)
            </button>
            <button
              onClick={() => handleLogin("sarah")}
              className="px-5 py-3 border border-brand-gold/30 hover:border-brand-gold bg-brand-black hover:bg-brand-gold/5 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex-1"
            >
              Sarah J. (Cranbrook Deck Build)
            </button>
          </div>
        </div>
      ) : (
        // PORTAL COMMAND CENTER VIEW
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch animate-slide-up">
          
          {/* Timeline & Quick Stats (Left - 7 cols) */}
          <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
            <div className="bg-brand-panel p-6 sm:p-8 rounded-2xl border border-brand-border space-y-6 flex-1">
              
              {/* Header Info */}
              <div className="flex justify-between items-start border-b border-brand-border/60 pb-4">
                <div>
                  <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold">Active Build Project</span>
                  <h4 className="font-extrabold text-white text-lg uppercase tracking-tight mt-0.5">
                    {session.projectTitle}
                  </h4>
                  <div className="text-[10px] text-brand-gray mt-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Client: <strong>{session.clientName}</strong> ({session.city})</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-brand-gray uppercase block font-bold">Overall Progress</span>
                  <span className="text-lg font-mono font-bold text-brand-gold">{session.completion}%</span>
                  <div className="w-24 bg-brand-border h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-brand-gold h-full" style={{ width: `${session.completion}%` }} />
                  </div>
                </div>
              </div>

              {/* Progress Stepper Stages */}
              <div className="space-y-4">
                <span className="text-[10px] text-brand-gray uppercase tracking-wider font-bold block">Gantt Milestones Checklist</span>
                
                <div className="space-y-3">
                  {session.stages.map((stage, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                        stage.status === "completed"
                          ? "bg-brand-black/30 border-brand-border text-brand-gray"
                          : stage.status === "active"
                          ? "border-brand-gold bg-brand-gold/5 text-white font-bold"
                          : "border-brand-border/30 text-brand-gray/40 bg-transparent"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] border ${
                          stage.status === "completed"
                            ? "bg-brand-gold/10 text-brand-gold border-brand-gold/30"
                            : stage.status === "active"
                            ? "bg-brand-gold text-brand-black border-brand-gold font-extrabold animate-pulse"
                            : "border-brand-border/30 text-brand-gray/30"
                        }`}>
                          {stage.status === "completed" ? "✓" : idx + 1}
                        </span>
                        <span className="uppercase tracking-wider text-[11px]">{stage.name}</span>
                      </div>
                      
                      {stage.status === "active" && (
                        <span className="text-[9px] text-brand-gold uppercase tracking-widest font-bold">
                          Active Now
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weather Delay Overlay */}
              <div className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
                session.weather.includes("Delay") 
                  ? "bg-red-500/5 border-red-500/20 text-red-300"
                  : "bg-green-500/5 border-green-500/20 text-green-300"
              }`}>
                {session.weather.includes("Delay") ? (
                  <CloudRain className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Sun className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold uppercase text-[10px] tracking-wider">Kootenay Climate Alert</div>
                  <p className="mt-0.5 opacity-80 leading-normal">{session.weather}</p>
                </div>
              </div>
            </div>

            {/* Crew on site */}
            <div className="bg-brand-panel p-4 rounded-xl border border-brand-border flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-brand-gold" />
                <span className="font-bold text-white uppercase tracking-wider">Assigned Crew Today:</span>
                <span className="text-brand-gray">{session.crew.join(", ")}</span>
              </div>
              <span className="text-[9px] text-brand-gold uppercase font-mono tracking-widest">
                Radio: Channel 4
              </span>
            </div>
          </div>

          {/* Daily Logs & Financial Signoffs (Right - 5 cols) */}
          <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
            {/* Financial summary & change orders */}
            <div className="bg-brand-black p-5 rounded-xl border border-brand-border space-y-5">
              <div className="space-y-1">
                <span className="text-[9px] text-brand-gray uppercase tracking-widest font-bold">Command Center Billings</span>
                <div className="flex justify-between items-end font-mono">
                  <div>
                    <span className="text-[8px] text-brand-gray uppercase block">Approved Estimate</span>
                    <span className="text-white font-bold text-sm">
                      {session.totalCost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-brand-gray uppercase block">Paid-to-date</span>
                    <span className="text-brand-gold font-bold text-sm">
                      {session.paid.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-[1px] bg-brand-border" />

              {/* Dynamic Change Orders (Interactive Sales Pitch) */}
              {session.availableUpgrades.length > 0 ? (
                <div className="space-y-3">
                  <span className="text-[10px] text-brand-gold uppercase tracking-wider font-bold block">Suggested Project Upgrades</span>
                  
                  <div className="space-y-3">
                    {session.availableUpgrades.map(up => (
                      <div key={up.id} className="p-3 bg-brand-panel rounded-lg border border-brand-border/60 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-white uppercase tracking-wide">{up.name}</span>
                            <span className="text-[9px] text-brand-gray block mt-0.5 font-normal leading-normal">{up.desc}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-brand-gold flex-shrink-0">
                            +{up.cost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <button
                          onClick={() => handleUpgradeApproval(up.id, up.cost)}
                          className="w-full py-1.5 bg-brand-gold/10 hover:bg-brand-gold hover:text-brand-black border border-brand-gold/30 hover:border-brand-gold text-brand-gold text-[9px] font-bold uppercase tracking-widest rounded transition-all"
                        >
                          Approve Upgrade & Sign Contract
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 bg-brand-panel/30 rounded border border-brand-border text-[10px] text-green-400 font-mono">
                  ✓ All suggested project upgrades reviewed or signed.
                </div>
              )}
            </div>

            {/* Daily Photo Log */}
            <div className="bg-brand-panel p-5 rounded-xl border border-brand-border space-y-4 flex-1 flex flex-col justify-between">
              <span className="text-[10px] text-brand-gray uppercase tracking-wider font-bold flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-brand-gold" />
                Live Site Photo Log
              </span>

              {/* Feed items */}
              <div className="space-y-4 overflow-y-auto max-h-72 pr-1">
                {session.logs.map((log, idx) => (
                  <div key={idx} className="bg-brand-black p-3.5 rounded-lg border border-brand-border space-y-2.5">
                    <div className="flex justify-between text-[9px] text-brand-gray font-mono">
                      <span>Log #{session.logs.length - idx}</span>
                      <span>{log.date}</span>
                    </div>
                    <p className="text-[10px] text-white leading-relaxed font-normal">
                      {log.text}
                    </p>
                    <div className="aspect-video rounded overflow-hidden border border-brand-border bg-brand-charcoal">
                      <img src={log.image} alt="Site update" className="w-full h-full object-cover" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}
    </section>
  );
}
