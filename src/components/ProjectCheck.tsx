"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Compass,
  Sun,
  MapPin,
  Loader,
  FileText,
  CheckCircle2,
  Phone,
  Mail,
  User,
  Wind,
  Mountain,
  Layers3,
  Home,
} from "lucide-react";

interface ScanReport {
  address: string;
  slope: string;
  slopeDifficulty: string;
  elevation: string;
  permitZoning: string;
  snowLoad: string;
  sunlight: string;
  wind: string;
  permitRecommendation: string;
  suggestedMaterials: string[];
  styleInspirations: { city: string; style: string }[];
}

export default function ProjectCheck() {
  const [address, setAddress] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [emailInput, setEmailInput] = useState({ name: "", email: "", phone: "" });
  const [reportDownloaded, setReportDownloaded] = useState(false);

  const scanSteps = [
    "Locating property on BC Geographic database…",
    "Pulling satellite topography & slope variance…",
    "Cross-checking East Kootenay climate archives…",
    "Calculating elevation, frost line, and wind exposure…",
    "Reviewing Region 4 snow load + municipal zoning…",
    "Matching to 140+ Black Timber portfolio builds…",
  ];

  const handleScan = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!address) return;

    setIsScanning(true);
    setScanReport(null);
    let idx = 0;
    setScanStep(scanSteps[0]);

    const stepInterval = setInterval(() => {
      idx++;
      if (idx < scanSteps.length) {
        setScanStep(scanSteps[idx]);
      } else {
        clearInterval(stepInterval);
        setIsScanning(false);

        const isFernie  = address.toLowerCase().includes("fernie");
        const isKelowna = address.toLowerCase().includes("kelowna");
        const isNelson  = address.toLowerCase().includes("nelson");

        setScanReport({
          address,
          slope: isFernie ? "8.4% (Steep Slope)" : isNelson ? "5.2% (Moderate)" : "3.1% (Mild)",
          slopeDifficulty: isFernie
            ? "Requires engineered helical piles"
            : "Standard concrete pier pads viable",
          elevation: isFernie
            ? "1,010m (High Alpine)"
            : isKelowna
            ? "344m (Valley Basin)"
            : isNelson
            ? "535m (Lakeside)"
            : "910m (High Elevation)",
          permitZoning: isFernie
            ? "Regional District East Kootenay (RDEK) BP-2"
            : "Municipal Standard Zone R-1",
          snowLoad: isFernie
            ? "7.2 kPa (Extremely Heavy)"
            : isKelowna
            ? "2.2 kPa (Standard)"
            : "4.8 kPa (Heavy)",
          sunlight: isKelowna ? "9.4 hrs/day (Excellent)" : "7.2 hrs/day (Moderate)",
          wind: isFernie ? "Gusts 70+ km/h (Alpine Exposure)" : "Avg 18 km/h (Sheltered)",
          permitRecommendation: isFernie
            ? "Requires structural engineering stamp — Black Timber handles end-to-end."
            : "Standard residential permit. Black Timber files on your behalf.",
          suggestedMaterials: isFernie
            ? [
                "Doug-fir 8x8 timber posts (snow-load grade)",
                "Composite decking (no swelling at altitude)",
                "Steel cable railings (low wind drag)",
                "Polycarbonate roof panels (snow shed)",
              ]
            : isKelowna
            ? [
                "Western Red Cedar (UV-resistant finish)",
                "Glass tempered railings (lakeview)",
                "Pergola w/ louvered top",
                "Integrated low-voltage LED layout",
              ]
            : [
                "Western Red Cedar planks",
                "Black aluminum railings",
                "Cedar privacy wall (eastern exposure)",
                "Helical screw piles to 48\" depth",
              ],
          styleInspirations: isFernie
            ? [
                { city: "Sparwood", style: "Steel + Timber Mountain Modern" },
                { city: "Elkford",  style: "Screened Gazebo Retreat" },
              ]
            : isKelowna
            ? [
                { city: "Kelowna",  style: "Lakeside Cedar Composite" },
                { city: "Penticton", style: "Wine Country Pergola" },
              ]
            : [
                { city: "Cranbrook", style: "Multi-Level Sun Deck" },
                { city: "Nelson",    style: "Heritage Wrap Porch" },
              ],
        });
      }
    }, 700);
  };

  const handleDownload = (ev: React.FormEvent) => {
    ev.preventDefault();
    setReportDownloaded(true);
  };

  return (
    <section className="space-y-6" id="projectcheck-section">
      <div className="max-w-2xl space-y-2">
        <span className="text-xs font-bold text-brand-gold uppercase tracking-widest flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          Kootenay Property Intelligence
        </span>
        <h3 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-[1.05]">
          Put your address in. <br />
          <span className="text-gold-shimmer">Get the secret file on your land.</span>
        </h3>
        <p className="text-sm text-brand-gray leading-relaxed">
          Sun exposure. Wind. Slope. Snow load. Permit zone. Material suggestions.
          And local style references from nearby builds — all computed before you ever pick up the phone.
        </p>
      </div>

      <div className="bg-brand-panel p-6 sm:p-8 rounded-2xl border border-brand-border space-y-6 shadow-xl">
        {!scanReport && !isScanning && (
          <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MapPin className="absolute left-3.5 top-3.5 w-5 h-5 text-brand-gold" />
              <input
                type="text"
                placeholder="Property address (e.g., 402 Dicken Rd, Fernie, BC)"
                required
                value={address}
                onChange={(ev) => setAddress(ev.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-xl text-sm text-white placeholder:text-brand-gray transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-8 py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
            >
              Run Intelligence Scan
            </button>
          </form>
        )}

        {isScanning && (
          <div className="py-10 flex flex-col items-center justify-center space-y-4">
            <Loader className="w-8 h-8 text-brand-gold animate-spin" />
            <div className="text-center">
              <div className="text-xs font-bold text-white uppercase tracking-wider">Scanning Site Intelligence…</div>
              <div className="text-xs text-brand-gray font-mono mt-1">{scanStep}</div>
            </div>
          </div>
        )}

        {scanReport && !isScanning && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
            {/* Indicators (left, 2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-brand-border">
                <FileText className="w-5 h-5 text-brand-gold" />
                <h4 className="font-bold text-white uppercase tracking-wider text-sm">
                  Intelligence Brief — {scanReport.address}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Compass,     label: "Terrain Slope",       value: scanReport.slope,       sub: scanReport.slopeDifficulty },
                  { icon: Mountain,    label: "Elevation",           value: scanReport.elevation,   sub: "Affects framing & material drying cycles" },
                  { icon: Sun,         label: "Sun Exposure",        value: scanReport.sunlight,    sub: "Estimating cedar UV protection cycles" },
                  { icon: Wind,        label: "Wind Exposure",       value: scanReport.wind,        sub: "Drives anchor + railing spec" },
                  { icon: ShieldAlert, label: "Snow Load Capacity",  value: scanReport.snowLoad,    sub: "Requires ledger bolting reinforcement" },
                  { icon: MapPin,      label: "Permit Authority",    value: scanReport.permitZoning,sub: scanReport.permitRecommendation },
                ].map((m) => (
                  <div key={m.label} className="p-3.5 rounded-xl bg-brand-black border border-brand-border flex items-start gap-3">
                    <m.icon className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-brand-gray uppercase font-bold tracking-wider">{m.label}</span>
                      <div className="text-sm font-bold text-white mt-0.5">{m.value}</div>
                      <p className="text-[10px] text-brand-gray mt-1 leading-snug">{m.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggested materials + style inspirations row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-brand-black border border-brand-border">
                  <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <Layers3 className="w-3.5 h-3.5" />
                    AI-Suggested Materials
                  </span>
                  <ul className="mt-2 space-y-1.5">
                    {scanReport.suggestedMaterials.map((m, i) => (
                      <li key={i} className="text-xs text-white/85 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-brand-black border border-brand-border">
                  <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5" />
                    Nearby Style Inspirations
                  </span>
                  <ul className="mt-2 space-y-1.5">
                    {scanReport.styleInspirations.map((s, i) => (
                      <li key={i} className="text-xs text-white/85 flex items-center justify-between gap-2 border-b border-brand-border/40 pb-1.5 last:border-0">
                        <span className="text-brand-gold font-bold uppercase text-[10px] tracking-widest">{s.city}</span>
                        <span className="truncate">{s.style}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Lead capture (right, 1 col) */}
            <div className="lg:col-span-1 bg-brand-black p-5 rounded-xl border border-brand-gold/30 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] text-brand-gold uppercase font-bold tracking-widest">Full PDF Brief</span>
                <h5 className="font-bold text-white text-sm uppercase mt-1">Download the full intelligence package</h5>
                <p className="text-xs text-brand-gray mt-1 leading-relaxed">
                  Structural details, permit guide, costs benchmarked against 140+ local builds — emailed as a PDF.
                </p>
              </div>

              {!reportDownloaded ? (
                <form onSubmit={handleDownload} className="space-y-2.5">
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 w-4 h-4 text-brand-gray" />
                    <input
                      type="text"
                      placeholder="Your Name"
                      required
                      value={emailInput.name}
                      onChange={(ev) => setEmailInput((p) => ({ ...p, name: ev.target.value }))}
                      className="w-full bg-brand-charcoal border border-brand-border focus:border-brand-gold focus:outline-none pl-9 pr-3 py-2 text-xs text-white rounded"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 w-4 h-4 text-brand-gray" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      required
                      value={emailInput.email}
                      onChange={(ev) => setEmailInput((p) => ({ ...p, email: ev.target.value }))}
                      className="w-full bg-brand-charcoal border border-brand-border focus:border-brand-gold focus:outline-none pl-9 pr-3 py-2 text-xs text-white rounded"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 w-4 h-4 text-brand-gray" />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      required
                      value={emailInput.phone}
                      onChange={(ev) => setEmailInput((p) => ({ ...p, phone: ev.target.value }))}
                      className="w-full bg-brand-charcoal border border-brand-border focus:border-brand-gold focus:outline-none pl-9 pr-3 py-2 text-xs text-white rounded"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-bold uppercase tracking-widest text-[10px] rounded transition-all"
                  >
                    Email Me The Full PDF
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-brand-charcoal border border-brand-gold/30 rounded text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
                  <div>
                    <div className="text-xs font-bold text-white uppercase">Report Ready!</div>
                    <div className="text-[10px] text-brand-gray mt-1">PDF sent to {emailInput.email}</div>
                  </div>
                  <a
                    href="#download"
                    onClick={(ev) => {
                      ev.preventDefault();
                      alert("Simulating PDF download for: " + address);
                    }}
                    className="inline-block px-4 py-2 bg-brand-gold text-brand-black hover:bg-brand-gold-hover rounded font-bold uppercase text-[9px] tracking-widest transition-all"
                  >
                    Download PDF
                  </a>
                  <button
                    onClick={() => {
                      setScanReport(null);
                      setReportDownloaded(false);
                      setAddress("");
                      setEmailInput({ name: "", email: "", phone: "" });
                    }}
                    className="block w-full text-center text-[9px] text-brand-gray hover:text-white uppercase tracking-wider mt-1"
                  >
                    Scan Another Address
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
