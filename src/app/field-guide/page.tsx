import type { Metadata } from "next";
import FieldGuideFunnel from "@/components/guide/FieldGuideFunnel";
import { GUIDE_FUNNEL_TITLE } from "@/lib/guide/funnel-content";

const SHARE_IMAGE =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781160201/ChatGPT_Image_Jun_11_2026_12_42_27_AM_hx7bam.png";

export const metadata: Metadata = {
  title: "Free Kootenay Field Guide | Black Timber Contracting",
  description:
    "Get the free Kootenay Homeowner Project Readiness & Resilience Manual — 18 chapters on permits, snow loads, wildfire prep, contractor red flags, rebates, and budgeting. Instant access.",
  openGraph: {
    title: "Free Kootenay Homeowner Field Guide",
    description:
      "The manual we wish every client read before calling a contractor. Permits, climate, FireSmart, hiring tips — free instant access.",
    images: [{ url: SHARE_IMAGE, alt: "Kootenay Field Guide" }],
  },
};

export default function FieldGuideLandingPage() {
  return <FieldGuideFunnel />;
}
