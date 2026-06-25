import type { Metadata } from "next";
import QrGenerator from "@/components/admin/QrGenerator";
import { getBusinessProfile } from "@/lib/business-config";

export const metadata: Metadata = {
  title: "QR Codes · Black Timber Admin",
  robots: { index: false, follow: false },
};

/**
 * Canonical PUBLIC origin for shareable QR codes. We deliberately skip
 * `VERCEL_URL` (preview deployments are ephemeral + access-protected, so a
 * QR pointing there won't open for customers) and prefer the real domain.
 */
function getPublicOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const domain = getBusinessProfile().domain?.trim();
  if (domain && !domain.includes("localhost")) {
    return `https://www.${domain.replace(/^https?:\/\//, "").replace(/^www\./, "")}`;
  }
  return "https://www.blacktimber.ca";
}

const SHARE_PRESETS = [
  { label: "Home", path: "/" },
  { label: "Transformations", path: "/#transformations-section" },
  { label: "Design Suite", path: "/#interactive-suite" },
  { label: "Pricing", path: "/#calculator-section" },
  { label: "Black Timber TV", path: "/#tv-section" },
  { label: "Client Portal", path: "/#portal-section" },
  { label: "Meet Jaryd", path: "/#meet-jaryd" },
  { label: "Deck Guide", path: "/guide" },
  { label: "Field Guide", path: "/field-guide" },
];

export default function AdminQrPage() {
  const origin = getPublicOrigin();
  const presets = SHARE_PRESETS.map((p) => ({
    label: p.label,
    url: `${origin}${p.path === "/" ? "" : p.path}`,
  }));

  return <QrGenerator origin={origin} defaultUrl={origin} presets={presets} />;
}
