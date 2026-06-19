"use client";

import { useEffect, useState } from "react";
import type { EsignSignatureFont } from "@/lib/esign/types";

export interface TypedSignatureValue {
  legalName: string;
  signatureText: string;
  signatureFont: EsignSignatureFont;
  title?: string;
  company?: string;
  address?: string;
  dateSigned: string;
  /** Rendered PNG of the typed signature (data URL). */
  signatureDataUrl: string | null;
  /** True when all required fields are present + signature rendered. */
  valid: boolean;
}

const FONTS: Array<{ id: EsignSignatureFont; label: string; family: string }> = [
  { id: "dancing", label: "Dancing Script", family: "'Dancing Script', cursive" },
  { id: "greatvibes", label: "Great Vibes", family: "'Great Vibes', cursive" },
  { id: "sacramento", label: "Sacramento", family: "'Sacramento', cursive" },
  { id: "caveat", label: "Caveat", family: "'Caveat', cursive" },
];

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Caveat&family=Dancing+Script:wght@600&family=Great+Vibes&family=Sacramento&display=swap";

function todayISO(): string {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return tz.toISOString().slice(0, 10);
}

function familyFor(id: EsignSignatureFont): string {
  return FONTS.find((f) => f.id === id)?.family ?? "cursive";
}

function renderSignaturePng(text: string, id: EsignSignatureFont): string | null {
  if (!text.trim()) return null;
  const canvas = document.createElement("canvas");
  const W = 640;
  const H = 200;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  // White card so the signature is legible on any background (paper-like).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1a1816";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  let size = 72;
  const family = familyFor(id);
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > W - 48 && size > 20) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  ctx.fillText(text, W / 2, H / 2);
  return canvas.toDataURL("image/png");
}

export default function TypedSignatureForm({
  signerName,
  requireAddress,
  disabled,
  onChange,
}: {
  signerName: string;
  requireAddress: boolean;
  disabled?: boolean;
  onChange: (value: TypedSignatureValue) => void;
}) {
  const [legalName, setLegalName] = useState(signerName ?? "");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [dateSigned, setDateSigned] = useState(todayISO());
  const [font, setFont] = useState<EsignSignatureFont>("dancing");
  const [fontsReady, setFontsReady] = useState(false);

  // Load the script fonts once so the canvas + preview render correctly.
  // setState only happens in async callbacks (promise/timeout), never sync.
  useEffect(() => {
    if (!document.querySelector("link[data-esign-fonts]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS_HREF;
      link.setAttribute("data-esign-fonts", "true");
      document.head.appendChild(link);
    }
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    // Fallback in case fonts.ready never resolves.
    const t = setTimeout(() => {
      if (!cancelled) setFontsReady(true);
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // Emit current value whenever an input changes (or fonts finish loading).
  // `onChange` is a stable setter from the parent, safe as a dependency.
  useEffect(() => {
    const signatureText = legalName.trim();
    const signatureDataUrl = signatureText ? renderSignaturePng(signatureText, font) : null;
    const valid =
      !!signatureText &&
      !!dateSigned &&
      !!signatureDataUrl &&
      (!requireAddress || !!address.trim());
    onChange({
      legalName: legalName.trim(),
      signatureText,
      signatureFont: font,
      title: title.trim() || undefined,
      company: company.trim() || undefined,
      address: address.trim() || undefined,
      dateSigned,
      signatureDataUrl,
      valid,
    });
  }, [legalName, title, company, address, dateSigned, font, requireAddress, fontsReady, onChange]);

  const inputCls =
    "mt-1 w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-gray/60 focus:border-brand-gold/60 outline-none disabled:opacity-50";
  const labelCls = "block";
  const labelText = "text-[10px] font-mono uppercase tracking-wider text-brand-gray";

  const reqMark = <span className="text-brand-gold">*</span>;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className={`${labelCls} sm:col-span-2`}>
          <span className={labelText}>Full legal name {reqMark}</span>
          <input
            value={legalName}
            disabled={disabled}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="e.g. Jordan A. Smith"
            className={inputCls}
            autoComplete="name"
          />
        </label>
        <label className={labelCls}>
          <span className={labelText}>Title / role</span>
          <input
            value={title}
            disabled={disabled}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Owner, PM…"
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          <span className={labelText}>Company</span>
          <input
            value={company}
            disabled={disabled}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional"
            className={inputCls}
            autoComplete="organization"
          />
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          <span className={labelText}>
            Mailing address {requireAddress ? reqMark : <span className="text-brand-gray/60">(optional)</span>}
          </span>
          <input
            value={address}
            disabled={disabled}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, City, Province, Postal code"
            className={inputCls}
            autoComplete="street-address"
          />
        </label>
        <label className={labelCls}>
          <span className={labelText}>Date {reqMark}</span>
          <input
            type="date"
            value={dateSigned}
            disabled={disabled}
            onChange={(e) => setDateSigned(e.target.value)}
            className={`${inputCls} [color-scheme:dark]`}
          />
        </label>
        <label className={labelCls}>
          <span className={labelText}>Signature style</span>
          <select
            value={font}
            disabled={disabled}
            onChange={(e) => setFont(e.target.value as EsignSignatureFont)}
            className={inputCls}
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className={labelText}>Signature preview</span>
        <div className="mt-1 h-28 rounded-lg border-2 border-dashed border-brand-border bg-white flex items-center justify-center overflow-hidden px-4">
          {legalName.trim() ? (
            <span
              style={{ fontFamily: familyFor(font), fontSize: 48 }}
              className="text-[#1a1816] leading-none whitespace-nowrap"
            >
              {legalName.trim()}
            </span>
          ) : (
            <span className="text-brand-gray/50 text-xs font-mono">
              Type your name above to generate your signature
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-brand-gray/70 font-mono">
          Your typed name + the details above form your legal electronic signature.
        </p>
      </div>
    </div>
  );
}
