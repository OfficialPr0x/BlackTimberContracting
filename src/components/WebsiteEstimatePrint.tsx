"use client";

/**
 * Customer-facing printable estimate for the Quote Wizard (Ctrl+P → Save as PDF).
 */

import { BRAND } from "@/lib/brand";
import { getBusinessProfile } from "@/lib/business-config";
import type { EstimateDocumentData } from "@/lib/pricing/estimate-lines";

const LOGO_URL =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

const BUSINESS = getBusinessProfile();

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(): string {
  return new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const SECTION_LABEL: Record<string, string> = {
  materials: "Materials",
  labor: "Labor",
  upgrade: "Upgrades & options",
  permits: "Permits & fees",
  summary: "Project coordination",
};

export default function WebsiteEstimatePrint({
  data,
  referenceId,
}: {
  data: EstimateDocumentData;
  referenceId: string;
}) {
  const lineTotal = data.lines.reduce((s, l) => s + l.totalUSD, 0);
  const sections = ["materials", "labor", "upgrade", "permits", "summary"] as const;

  return (
    <article
      data-pdf-document
      className="btc-document relative bg-white text-[#1a1816] mx-auto max-w-[8.5in] shadow-2xl print:shadow-none print:rounded-none rounded-lg overflow-hidden"
    >
      <header className="relative px-10 pt-8 pb-7" style={{ background: BRAND.black }}>
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${BRAND.goldDark}, ${BRAND.gold}, ${BRAND.goldDark})`,
          }}
        />
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-[72px] h-[72px] shrink-0 rounded-md overflow-hidden bg-white/5 p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LOGO_URL}
                alt={`${BUSINESS.name} logo`}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <div>
              <p
                className="text-[10px] font-mono uppercase tracking-[0.45em] mb-1"
                style={{ color: BRAND.gold }}
              >
                {BUSINESS.region}
              </p>
              <h1 className="text-[26px] font-extrabold tracking-tight leading-none text-white">
                {BUSINESS.name}
              </h1>
              <p className="text-[11px] mt-2 text-white/75">
                {BUSINESS.phone} · {BUSINESS.email}
              </p>
              <p className="text-[11px] text-white/60">{BUSINESS.domain}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p
              className="text-[32px] font-extrabold uppercase tracking-tight leading-none"
              style={{ color: BRAND.gold }}
            >
              Estimate
            </p>
            <p className="font-mono text-[13px] text-white/90 mt-2">{referenceId}</p>
            <dl className="mt-4 text-[11px] grid grid-cols-[auto_auto] gap-x-3 gap-y-1 justify-end text-white/80">
              <dt className="text-white/50 text-right">Issued</dt>
              <dd className="font-mono text-right text-white">{fmtDate()}</dd>
              <dt className="text-white/50 text-right">Good until</dt>
              <dd className="font-mono text-right text-white">
                {new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </dl>
          </div>
        </div>
      </header>

      <div className="px-10 py-9">
        <section
          className="rounded-lg p-4 mb-8"
          style={{ background: BRAND.paper, border: `1px solid ${BRAND.gold}33` }}
        >
          <h2
            className="text-[10px] font-mono uppercase tracking-[0.35em] mb-2"
            style={{ color: BRAND.goldDark }}
          >
            Project scope
          </h2>
          <p className="text-sm font-bold capitalize">{data.headline}</p>
          <p className="text-[12px] text-black/70 mt-1">
            {data.projectType.replace(/_/g, " ")} · {data.dimensionsLabel}
            {data.style ? ` · ${data.style.replace(/-/g, " ")}` : ""}
          </p>
          <p className="text-[12px] text-black/65 mt-1">
            Primary measure: {data.primaryMeasure} {data.measureLabel}
          </p>
        </section>

        <section className="mb-8">
          <div
            className="text-center rounded-xl py-5 mb-6"
            style={{ background: BRAND.paperAccent, border: `1px solid ${BRAND.gold}44` }}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-black/50">
              Estimated investment range
            </p>
            <p className="text-3xl font-extrabold font-mono mt-1" style={{ color: BRAND.goldDark }}>
              {usd(data.rangeMinUSD)} – {usd(data.rangeMaxUSD)}
            </p>
          </div>

          {sections.map((section) => {
            const rows = data.lines.filter((l) => l.section === section);
            if (!rows.length) return null;
            return (
              <div key={section} className="mb-5">
                <h3
                  className="text-[10px] font-mono uppercase tracking-[0.35em] mb-2 pb-1 border-b"
                  style={{ color: BRAND.goldDark, borderColor: `${BRAND.gold}44` }}
                >
                  {SECTION_LABEL[section]}
                </h3>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[9px] font-mono uppercase tracking-wider text-black/45">
                      <th className="py-1.5 pr-2 font-normal">Description</th>
                      <th className="py-1.5 pr-2 font-normal w-24">Qty</th>
                      <th className="py-1.5 pr-2 font-normal w-24 text-right">Unit</th>
                      <th className="py-1.5 font-normal w-24 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-black/8">
                        <td className="py-2 pr-2">{row.description}</td>
                        <td className="py-2 pr-2 font-mono text-black/70">{row.qty}</td>
                        <td className="py-2 pr-2 text-right font-mono">{usd(row.unitPriceUSD)}</td>
                        <td className="py-2 text-right font-mono font-semibold">{usd(row.totalUSD)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="flex justify-end border-t-2 pt-3 mt-4" style={{ borderColor: BRAND.gold }}>
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest text-black/45">
                Line-item subtotal (before range adjustment)
              </p>
              <p className="text-xl font-extrabold font-mono" style={{ color: BRAND.goldDark }}>
                {usd(lineTotal)}
              </p>
            </div>
          </div>
        </section>

        {data.scopeIncludes.length > 0 ? (
          <section className="mb-8">
            <h2
              className="text-[10px] font-mono uppercase tracking-[0.35em] mb-2"
              style={{ color: BRAND.goldDark }}
            >
              Scope includes
            </h2>
            <ul className="text-[12px] space-y-1 text-black/75 list-disc pl-5">
              {data.scopeIncludes.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer
          className="text-[11px] text-black/60 border-t pt-6 leading-relaxed"
          style={{ borderColor: `${BRAND.gold}33` }}
        >
          <p>{data.disclaimer}</p>
          <p className="mt-3 font-mono text-[10px] text-black/45">
            {BUSINESS.legalName} · {BUSINESS.phone} · This document is for budgeting purposes only.
          </p>
        </footer>
      </div>
    </article>
  );
}
