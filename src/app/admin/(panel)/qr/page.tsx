import type { Metadata } from "next";
import QrGenerator from "@/components/admin/QrGenerator";
import { getSiteOrigin } from "@/lib/esign/site-url";

export const metadata: Metadata = {
  title: "QR Codes · Black Timber Admin",
  robots: { index: false, follow: false },
};

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
  const origin = getSiteOrigin();
  const presets = SHARE_PRESETS.map((p) => ({
    label: p.label,
    url: `${origin}${p.path === "/" ? "" : p.path}`,
  }));

  return <QrGenerator defaultUrl={origin} presets={presets} />;
}
