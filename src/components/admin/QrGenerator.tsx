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
} from "lucide-react";

const LOGO_SRC = "/black-timber-logo.png";

interface SharePreset {
  label: string;
  url: string;
}

interface QrGeneratorProps {
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

function slugifyForFilename(url: string): string {
  try {
    const u = new URL(url);
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

export default function QrGenerator({ defaultUrl, presets }: QrGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderToken = useRef(0);

  const [url, setUrl] = useState(defaultUrl);
  const [resolution, setResolution] = useState(1024);
  const [margin, setMargin] = useState(2);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoRatio, setLogoRatio] = useState(0.22);
  const [darkColor, setDarkColor] = useState("#0a0a0a");
  const [lightColor, setLightColor] = useState("#ffffff");

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "image" | null>(null);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = url.trim();
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
        const box = Math.round(size * logoRatio);
        const pad = Math.round(box * 0.16);
        const plateSize = box + pad * 2;
        const plateX = Math.round((size - plateSize) / 2);
        const plateY = Math.round((size - plateSize) / 2);
        const radius = Math.round(plateSize * 0.18);

        // White plate so the QR pattern reads cleanly around the logo.
        ctx.save();
        roundedRectPath(ctx, plateX, plateY, plateSize, plateSize, radius);
        ctx.fillStyle = lightColor;
        ctx.fill();
        ctx.restore();

        // Logo (clipped to a rounded square matching the plate).
        const logoX = plateX + pad;
        const logoY = plateY + pad;
        ctx.save();
        roundedRectPath(ctx, logoX, logoY, box, box, Math.round(box * 0.16));
        ctx.clip();
        ctx.drawImage(logo, logoX, logoY, box, box);
        ctx.restore();
      }
    } catch (err) {
      if (token !== renderToken.current) return;
      setError(err instanceof Error ? err.message : "Could not generate QR code.");
    }
  }, [url, resolution, margin, includeLogo, logoRatio, darkColor, lightColor]);

  useEffect(() => {
    void render();
  }, [render]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url.trim()) return;
    const link = document.createElement("a");
    link.download = `${slugifyForFilename(url)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [url]);

  const handleCopyImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !url.trim()) return;
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
  }, [url]);

  const handleCopyLink = useCallback(async () => {
    if (!url.trim()) return;
    try {
      await navigator.clipboard.writeText(url.trim());
      setCopied("link");
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Couldn't copy the link.");
    }
  }, [url]);

  const applyColorPreset = (dark: string, light: string) => {
    setDarkColor(dark);
    setLightColor(light);
  };

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
          Point a branded QR code at any page or link. Updates live · Black Timber
          logo in the centre · download a print-ready PNG.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        {/* Controls */}
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-brand-gold">
              Destination URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.blacktimber.ca/…"
              spellCheck={false}
              className="w-full rounded-lg bg-brand-black border border-brand-border px-3 py-2.5 text-sm text-white placeholder:text-brand-gray/60 focus:outline-none focus:border-brand-gold/50"
            />
          </div>

          {presets.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gray">
                Quick share — company pages
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => {
                  const active = url.trim() === p.url;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setUrl(p.url)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        active
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
                  min={0.14}
                  max={0.28}
                  step={0.01}
                  value={logoRatio}
                  onChange={(e) => setLogoRatio(Number(e.target.value))}
                  className="w-full accent-brand-gold"
                />
                <p className="text-[11px] text-brand-gray/80">
                  Uses high error correction so the code still scans with the logo
                  on top. Keep it under ~25% for reliable scanning.
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
              style={{ background: url.trim() ? lightColor : undefined }}
            >
              <canvas
                ref={canvasRef}
                className={`h-full w-full ${url.trim() ? "" : "invisible"}`}
                aria-label="QR code preview"
              />
              {!url.trim() && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-gray">
                  <QrCode className="h-10 w-10 opacity-40" />
                  <span className="text-xs">Enter a URL to generate</span>
                </div>
              )}
            </div>
            <p className="mt-3 break-all text-center text-[11px] text-brand-gray">
              {url.trim() || "—"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!url.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-medium text-brand-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={!url.trim()}
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
                disabled={!url.trim()}
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
              onClick={() => setUrl(defaultUrl)}
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-brand-gray transition-colors hover:text-brand-gold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to site home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
