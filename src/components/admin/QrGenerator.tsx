"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Download,
  Check,
  Link as LinkIcon,
  ImageDown,
  RotateCcw,
  Save,
  Activity,
  Eye,
  Users,
  Archive,
  Trash2,
  RefreshCw,
  Loader,
  Plus,
} from "lucide-react";

const LOGO_SRC = "/black-timber-logo.png";

interface SharePreset {
  label: string;
  url: string;
}

export interface SavedQrCode {
  id: string;
  slug: string;
  label: string;
  destination: string;
  archived: boolean;
  scanCount: number;
  uniqueScans: number;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QrGeneratorProps {
  origin: string;
  defaultUrl: string;
  presets: SharePreset[];
}

const RESOLUTIONS = [
  { label: "512px", value: 512 },
  { label: "1024px", value: 1024 },
  { label: "2048px", value: 2048 },
];

const COLOR_PRESETS = [
  { label: "Classic", dark: "#0a0a0a", light: "#ffffff" },
  { label: "Timber", dark: "#1a1a1a", light: "#f5f0e6" },
  { label: "Gold ground", dark: "#0a0a0a", light: "#e7c873" },
];

let logoPromise: Promise<HTMLImageElement> | null = null;
function loadLogo(): Promise<HTMLImageElement> {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = LOGO_SRC;
  });
  return logoPromise;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function slugifyForFilename(value: string): string {
  try {
    const u = new URL(value);
    const path = (u.pathname + u.hash)
      .replace(/^\//, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase();
    return path ? `blacktimber-qr-${path}` : "blacktimber-qr-home";
  } catch {
    return "blacktimber-qr";
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function QrGenerator({
  origin,
  defaultUrl,
  presets,
}: QrGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderToken = useRef(0);

  const [url, setUrl] = useState(defaultUrl);
  const [label, setLabel] = useState("");
  const [resolution, setResolution] = useState(1024);
  const [margin, setMargin] = useState(2);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoRatio, setLogoRatio] = useState(0.16);
  const [darkColor, setDarkColor] = useState("#0a0a0a");
  const [lightColor, setLightColor] = useState("#ffffff");

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "image" | null>(null);

  // Tracking state
  const [active, setActive] = useState<SavedQrCode | null>(null);
  const [saved, setSaved] = useState<SavedQrCode[]>([]);
  const [trackingAvailable, setTrackingAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const trackingUrl = active
    ? `${origin.replace(/\/$/, "")}/r/${active.slug}`
    : null;
  const encodedValue = (trackingUrl ?? url).trim();
  const displayLink = trackingUrl ?? url.trim();

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/qr", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        available: boolean;
        codes: SavedQrCode[];
      };
      setTrackingAvailable(data.available);
      setSaved(data.codes ?? []);
    } catch {
      // Non-fatal — plain generation still works.
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = encodedValue;
    const token = ++renderToken.current;

    if (!text) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setError(null);
      return;
    }

    try {
      await QRCode.toCanvas(canvas, text, {
        errorCorrectionLevel: includeLogo ? "H" : "M",
        margin,
        width: resolution,
        color: { dark: darkColor, light: lightColor },
      });
      if (token !== renderToken.current) return;
      setError(null);

      if (includeLogo) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const logo = await loadLogo();
        if (token !== renderToken.current) return;

        const size = canvas.width;
        const plateSize = Math.round(size * logoRatio);
        const pad = Math.round(plateSize * 0.1);
        const box = plateSize - pad * 2;
        const plateX = Math.round((size - plateSize) / 2);
        const plateY = Math.round((size - plateSize) / 2);
        const radius = Math.round(plateSize * 0.2);

        ctx.save();
        roundedRectPath(ctx, plateX, plateY, plateSize, plateSize, radius);
        ctx.fillStyle = lightColor;
        ctx.fill();
        ctx.restore();

        const logoX = plateX + pad;
        const logoY = plateY + pad;
        ctx.save();
        roundedRectPath(ctx, logoX, logoY, box, box, Math.round(box * 0.14));
        ctx.clip();
        ctx.drawImage(logo, logoX, logoY, box, box);
        ctx.restore();
      }
    } catch (err) {
      if (token !== renderToken.current) return;
      setError(err instanceof Error ? err.message : "Could not generate QR code.");
    }
  }, [encodedValue, resolution, margin, includeLogo, logoRatio, darkColor, lightColor]);

  useEffect(() => {
    void render();
  }, [render]);

  const downloadName = active
    ? `blacktimber-qr-${active.label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase() || active.slug}`
    : slugifyForFilename(url);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !encodedValue) return;
    const link = document.createElement("a");
    link.download = `${downloadName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [encodedValue, downloadName]);

  const handleCopyImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !encodedValue) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied("image");
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Copy image isn't supported in this browser — use Download PNG.");
    }
  }, [encodedValue]);

  const handleCopyLink = useCallback(async () => {
    if (!displayLink) return;
    try {
      await navigator.clipboard.writeText(displayLink);
      setCopied("link");
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Couldn't copy the link.");
    }
  }, [displayLink]);

  const handleSaveAndTrack = useCallback(async () => {
    const dest = url.trim();
    const name = label.trim();
    if (!dest) {
      setError("Add a destination URL first.");
      return;
    }
    if (!name) {
      setError("Give this QR code a name so you can find it in the list.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: name, destination: dest }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || "Could not save the QR code.");
      }
      const code = data.code as SavedQrCode;
      setSaved((prev) => [code, ...prev]);
      setActive(code);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the QR code.");
    } finally {
      setSaving(false);
    }
  }, [url, label]);

  const handleSelectSaved = useCallback((code: SavedQrCode) => {
    setActive(code);
    setUrl(code.destination);
    setError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleNewUntracked = useCallback(() => {
    setActive(null);
    setError(null);
  }, []);

  const handleArchive = useCallback(
    async (code: SavedQrCode) => {
      try {
        const res = await fetch(`/api/admin/qr/${code.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: !code.archived }),
        });
        if (!res.ok) throw new Error();
        await loadList();
      } catch {
        setError("Could not update that code.");
      }
    },
    [loadList],
  );

  const handleDelete = useCallback(
    async (code: SavedQrCode) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Delete "${code.label}" and its scan history? This can't be undone.`)
      ) {
        return;
      }
      try {
        const res = await fetch(`/api/admin/qr/${code.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        if (active?.id === code.id) setActive(null);
        setSaved((prev) => prev.filter((c) => c.id !== code.id));
      } catch {
        setError("Could not delete that code.");
      }
    },
    [active],
  );

  const applyColorPreset = (dark: string, light: string) => {
    setDarkColor(dark);
    setLightColor(light);
  };

  const totalScans = saved.reduce((sum, c) => sum + c.scanCount, 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
          Sharing
        </p>
        <h1 className="text-xl sm:text-2xl font-medium text-white mt-0.5 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-brand-gold" />
          QR Code Generator
        </h1>
        <p className="text-xs text-brand-gray mt-1">
          Point a branded QR code at any page or link. Save it to track every scan
          — total views and unique devices — then download a print-ready PNG.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        {/* Controls */}
        <div className="space-y-5">
          {active && (
            <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-medium text-brand-gold">
                  <Activity className="h-3.5 w-3.5" />
                  Tracking ON · scans are counted
                </span>
                <button
                  type="button"
                  onClick={handleNewUntracked}
                  className="flex items-center gap-1 text-[11px] text-brand-gray hover:text-brand-gold"
                >
                  <Plus className="h-3 w-3" />
                  New code
                </button>
              </div>
              <p className="text-sm text-white font-medium">{active.label}</p>
              <p className="break-all text-[11px] text-brand-gray">
                {trackingUrl}{" "}
                <span className="text-brand-gray/60">→ {active.destination}</span>
              </p>
              <div className="flex gap-4 pt-1 text-xs text-brand-gray">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-brand-gold" />
                  {active.scanCount} scans
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-brand-gold" />
                  {active.uniqueScans} unique
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-brand-gold">
              Destination URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (active) setActive(null);
              }}
              placeholder="https://www.blacktimber.ca/…"
              spellCheck={false}
              className="w-full rounded-lg bg-brand-black border border-brand-border px-3 py-2.5 text-sm text-white placeholder:text-brand-gray/60 focus:outline-none focus:border-brand-gold/50"
            />
            {active && (
              <p className="text-[11px] text-brand-gray/70">
                Editing the URL starts a new untracked code. The saved code above
                keeps its own destination.
              </p>
            )}
          </div>

          {presets.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                Quick share — company pages
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => {
                  const isActive = !active && url.trim() === p.url;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setActive(null);
                        setUrl(p.url);
                        if (!label.trim()) setLabel(p.label);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        isActive
                          ? "border-brand-gold/60 text-brand-gold bg-brand-gold/10"
                          : "border-brand-border text-brand-gray hover:text-brand-gold hover:border-brand-gold/40"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save & track */}
          <div className="space-y-2 rounded-lg border border-brand-border p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gold">
              Save &amp; track this link
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Name (e.g. Truck decal, Yard sign, Business card)"
                maxLength={160}
                className="w-full rounded-lg bg-brand-black border border-brand-border px-3 py-2 text-sm text-white placeholder:text-brand-gray/60 focus:outline-none focus:border-brand-gold/50"
              />
              <button
                type="button"
                onClick={handleSaveAndTrack}
                disabled={saving || !trackingAvailable || !url.trim()}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-brand-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save &amp; track
              </button>
            </div>
            <p className="text-[11px] text-brand-gray/80">
              {trackingAvailable
                ? "Saved codes encode a short bt.ca/r/… link that records every scan, then forwards to your destination."
                : "Connect Supabase to save & track codes. You can still download an untracked QR below."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                Download size
              </p>
              <div className="flex gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setResolution(r.value)}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                      resolution === r.value
                        ? "border-brand-gold/60 text-brand-gold bg-brand-gold/10"
                        : "border-brand-border text-brand-gray hover:text-brand-gold hover:border-brand-gold/40"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                Colour
              </p>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => applyColorPreset(c.dark, c.light)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs border border-brand-border text-brand-gray hover:text-brand-gold hover:border-brand-gold/40 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ background: c.dark }}
                    />
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-brand-gray">
                  Dots
                  <input
                    type="color"
                    value={darkColor}
                    onChange={(e) => setDarkColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-brand-border bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-brand-gray">
                  Background
                  <input
                    type="color"
                    value={lightColor}
                    onChange={(e) => setLightColor(e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-brand-border bg-transparent"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-brand-border p-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-white">Black Timber logo in centre</span>
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => setIncludeLogo(e.target.checked)}
                className="h-4 w-4 accent-brand-gold cursor-pointer"
              />
            </label>
            {includeLogo && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                  <span>Logo size</span>
                  <span>{Math.round(logoRatio * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.2}
                  step={0.01}
                  value={logoRatio}
                  onChange={(e) => setLogoRatio(Number(e.target.value))}
                  className="w-full accent-brand-gold"
                />
                <p className="text-[11px] text-brand-gray/80">
                  Uses high error correction so the code still scans with the logo
                  on top. Smaller is safer — test the download before printing.
                </p>
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                <span>Quiet zone (border)</span>
                <span>{margin}</span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full accent-brand-gold"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Preview + actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-border bg-brand-black p-4">
            <div
              className="relative mx-auto flex aspect-square w-full max-w-[300px] items-center justify-center overflow-hidden rounded-lg"
              style={{ background: encodedValue ? lightColor : undefined }}
            >
              <canvas
                ref={canvasRef}
                className={`h-full w-full ${encodedValue ? "" : "invisible"}`}
                aria-label="QR code preview"
              />
              {!encodedValue && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-gray">
                  <QrCode className="h-10 w-10 opacity-40" />
                  <span className="text-xs">Enter a URL to generate</span>
                </div>
              )}
            </div>
            {active && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-brand-gold">
                <Activity className="h-3 w-3" />
                Tracked link
              </p>
            )}
            <p className="mt-1 break-all text-center text-[11px] text-brand-gray">
              {displayLink || "—"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!encodedValue}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-medium text-brand-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={!encodedValue}
                className="flex items-center justify-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs text-brand-gray transition-colors hover:text-brand-gold hover:border-brand-gold/40 disabled:opacity-40"
              >
                {copied === "image" ? (
                  <Check className="h-4 w-4 text-brand-gold" />
                ) : (
                  <ImageDown className="h-4 w-4" />
                )}
                {copied === "image" ? "Copied" : "Copy image"}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!displayLink}
                className="flex items-center justify-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs text-brand-gray transition-colors hover:text-brand-gold hover:border-brand-gold/40 disabled:opacity-40"
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4 text-brand-gold" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                {copied === "link" ? "Copied" : "Copy link"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setActive(null);
                setUrl(defaultUrl);
              }}
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-brand-gray transition-colors hover:text-brand-gold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to site home
            </button>
          </div>
        </div>
      </div>

      {/* Saved & tracked codes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
              Tracked codes
            </p>
            <h2 className="text-base font-medium text-white mt-0.5">
              Saved QR codes
              {saved.length > 0 && (
                <span className="ml-2 text-xs text-brand-gray">
                  {saved.length} · {totalScans} total scans
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadList()}
            disabled={listLoading}
            className="flex items-center gap-1.5 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs text-brand-gray transition-colors hover:text-brand-gold hover:border-brand-gold/40 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {!trackingAvailable ? (
          <p className="rounded-lg border border-brand-border p-4 text-xs text-brand-gray">
            Supabase isn&apos;t configured, so tracked codes can&apos;t be saved
            yet. Add your Supabase keys and run{" "}
            <code className="text-brand-gold">supabase/qr-codes.sql</code> to turn
            on scan tracking.
          </p>
        ) : listLoading ? (
          <p className="flex items-center gap-2 rounded-lg border border-brand-border p-4 text-xs text-brand-gray">
            <Loader className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : saved.length === 0 ? (
          <p className="rounded-lg border border-brand-border p-4 text-xs text-brand-gray">
            No saved codes yet. Enter a destination, give it a name, and hit{" "}
            <span className="text-brand-gold">Save &amp; track</span>.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-brand-border">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[10px] font-mono uppercase tracking-wider text-brand-gray">
                <tr>
                  <th className="px-3 py-2 text-left font-normal">Code</th>
                  <th className="px-3 py-2 text-right font-normal">Scans</th>
                  <th className="px-3 py-2 text-right font-normal">Unique</th>
                  <th className="px-3 py-2 text-right font-normal">Last</th>
                  <th className="px-3 py-2 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {saved.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-brand-border ${
                      active?.id === c.id ? "bg-brand-gold/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectSaved(c)}
                        className="text-left"
                      >
                        <span className="block font-medium text-white hover:text-brand-gold">
                          {c.label}
                          {c.archived && (
                            <span className="ml-2 text-[10px] text-brand-gray">
                              (archived)
                            </span>
                          )}
                        </span>
                        <span className="block break-all text-[11px] text-brand-gray">
                          /r/{c.slug} → {c.destination}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">
                      {c.scanCount}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-brand-gray">
                      {c.uniqueScans}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-brand-gray">
                      {relativeTime(c.lastScanAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Open to download"
                          onClick={() => handleSelectSaved(c)}
                          className="rounded p-1.5 text-brand-gray hover:text-brand-gold hover:bg-white/5"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title={c.archived ? "Unarchive" : "Archive"}
                          onClick={() => void handleArchive(c)}
                          className="rounded p-1.5 text-brand-gray hover:text-brand-gold hover:bg-white/5"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => void handleDelete(c)}
                          className="rounded p-1.5 text-brand-gray hover:text-red-400 hover:bg-white/5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
