"use client";

import React, { useEffect, useState } from "react";
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

// Mirrors SiteIntelOutput from src/lib/openrouter/schemas.ts. Kept narrow
// (only the fields we render) so we don't bring zod into the client bundle.
interface ScanReport {
  address: string;
  resolvedLocation: string;
  region: string;
  terrain: {
    slopePercent: number;
    slopeDifficulty: "mild" | "moderate" | "steep" | "extreme";
    elevationMeters: number;
  };
  climate: {
    snowLoadKPa: number;
    snowLoadCategory: "standard" | "heavy" | "extreme";
    frostLineInches: number;
    sunHoursPerDay: number;
    windCategory: "sheltered" | "moderate" | "alpine_exposed";
  };
  permitting: { authority: string; typicalRequirements: string; needsEngineerStamp: boolean };
  suggestedMaterials: string[];
  styleInspirations: { city: string; style: string }[];
  confidence: "high" | "medium" | "low";
}

const SLOPE_DIFFICULTY_LABEL: Record<ScanReport["terrain"]["slopeDifficulty"], string> = {
  mild: "Standard concrete pier pads viable",
  moderate: "Concrete piers + careful framing",
  steep: "Requires engineered helical piles",
  extreme: "Engineering stamp + heli-pile foundation",
};

const SNOW_CATEGORY_LABEL: Record<ScanReport["climate"]["snowLoadCategory"], string> = {
  standard: "Standard",
  heavy: "Heavy",
  extreme: "Extremely Heavy",
};

const WIND_LABEL: Record<ScanReport["climate"]["windCategory"], string> = {
  sheltered: "Sheltered",
  moderate: "Moderate exposure",
  alpine_exposed: "Alpine — gusts 70+ km/h",
};

export default function ProjectCheck() {
  const [address, setAddress] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState({ name: "", email: "", phone: "" });
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPending, setReportPending] = useState(false);

  const scanSteps = [
    "Geocoding property on BC Geographic database…",
    "Pulling elevation + slope from terrain models…",
    "Querying snow load + frost line for this latitude…",
    "Looking up permit authority + zoning rules…",
    "Matching nearby Black Timber-style references…",
  ];

  // Rotate the log lines while the request is in flight — purely cosmetic,
  // but honest (each line is something the model is actually doing).
  useEffect(() => {
    if (!isScanning) return;
    let i = 0;
    setScanStep(scanSteps[0]);
    const t = setInterval(() => {
      i = (i + 1) % scanSteps.length;
      setScanStep(scanSteps[i]);
    }, 1400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  const handleScan = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!address.trim()) return;

    setIsScanning(true);
    setScanReport(null);
    setScanError(null);

    try {
      const res = await fetch("/api/ai/site-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message ?? `Scan failed (${res.status})`);
      }
      const data = (await res.json()) as Omit<ScanReport, "address"> & { resolvedLocation: string };
      setScanReport({ ...data, address });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDownload = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!scanReport) return;
    setReportPending(true);
    setReportError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "site_intel_report",
          contact: {
            name: emailInput.name,
            email: emailInput.email,
            phone: emailInput.phone,
            address,
          },
          payload: { report: scanReport },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message ?? `Submit failed (${res.status})`);
      }
      setReportSent(true);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setReportPending(false);
    }
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
          <>
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
            {scanError && (
              <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
                {scanError}
              </div>
            )}
          </>
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
              <div className="flex items-center justify-between pb-2 border-b border-brand-border">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-brand-gold" />
                  <h4 className="font-bold text-white uppercase tracking-wider text-sm">
                    Intelligence Brief — {scanReport.resolvedLocation || scanReport.address}
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    scanReport.confidence === "high"
                      ? "border-green-500/40 text-green-400 bg-green-500/10"
                      : scanReport.confidence === "medium"
                      ? "border-brand-gold/40 text-brand-gold bg-brand-gold/10"
                      : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                  }`}
                >
                  {scanReport.confidence} confidence
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    icon: Compass,
                    label: "Terrain Slope",
                    value: `${scanReport.terrain.slopePercent.toFixed(1)}% (${scanReport.terrain.slopeDifficulty})`,
                    sub: SLOPE_DIFFICULTY_LABEL[scanReport.terrain.slopeDifficulty],
                  },
                  {
                    icon: Mountain,
                    label: "Elevation",
                    value: `${scanReport.terrain.elevationMeters.toLocaleString()}m`,
                    sub: `Frost line: ${scanReport.climate.frostLineInches}" footing depth`,
                  },
                  {
                    icon: Sun,
                    label: "Sun Exposure",
                    value: `${scanReport.climate.sunHoursPerDay.toFixed(1)} hrs/day`,
                    sub: "Drives cedar UV protection + finish cycles",
                  },
                  {
                    icon: Wind,
                    label: "Wind Exposure",
                    value: WIND_LABEL[scanReport.climate.windCategory],
                    sub: "Drives anchor + railing spec",
                  },
                  {
                    icon: ShieldAlert,
                    label: "Snow Load",
                    value: `${scanReport.climate.snowLoadKPa.toFixed(1)} kPa (${SNOW_CATEGORY_LABEL[scanReport.climate.snowLoadCategory]})`,
                    sub: "BC Building Code structural requirement",
                  },
                  {
                    icon: MapPin,
                    label: "Permit Authority",
                    value: scanReport.permitting.authority,
                    sub: scanReport.permitting.needsEngineerStamp
                      ? "Engineer stamp required — we handle it"
                      : "Standard residential pathway",
                  },
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

              {scanReport.permitting.typicalRequirements && (
                <p className="text-xs text-brand-gray bg-brand-black border border-brand-border rounded-lg p-3 leading-relaxed">
                  <strong className="text-brand-gold uppercase tracking-wider text-[10px] block mb-1">Permitting note</strong>
                  {scanReport.permitting.typicalRequirements}
                </p>
              )}

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

              {!reportSent ? (
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
                  {reportError && (
                    <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                      {reportError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={reportPending}
                    className="w-full py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 text-brand-black font-bold uppercase tracking-widest text-[10px] rounded transition-all flex items-center justify-center gap-1.5"
                  >
                    {reportPending ? (
                      <>
                        <Loader className="w-3 h-3 animate-spin" /> Sending…
                      </>
                    ) : (
                      <>Email Me The Full Brief</>
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-brand-charcoal border border-brand-gold/30 rounded text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
                  <div>
                    <div className="text-xs font-bold text-white uppercase">Brief Sent To Jaryd</div>
                    <div className="text-[10px] text-brand-gray mt-1">We&apos;ll email your detailed brief to {emailInput.email} within one business day.</div>
                  </div>
                  <button
                    onClick={() => {
                      setScanReport(null);
                      setReportSent(false);
                      setReportError(null);
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
