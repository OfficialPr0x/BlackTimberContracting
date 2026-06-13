import type { Metadata } from "next";
import { GUIDE_COVER_ALT, GUIDE_COVER_URL } from "./images";
import { FUNNEL_FAQ } from "./funnel-content";

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.blacktimber.ca";

const PAGE_PATH = "/field-guide";
const PAGE_URL = `${SITE_ORIGIN}${PAGE_PATH}`;

const LOGO_URL =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

/** Primary keyword targets: Kootenay homeowner guide, permits, wildfire, renovation planning. */
export const FIELD_GUIDE_SEO = {
  title: "Free Kootenay Homeowner Field Guide | Permits, Snow Load & Wildfire Prep",
  description:
    "Free homeowner field guide for Fernie, Cranbrook, Nelson, Sparwood & Elkford. 18 chapters on BC building permits, snow loads, FireSmart, contractor red flags, rebates & renovation budgeting.",
  ogTitle: "The Kootenay Homeowner Field Guide — Free Download",
  ogDescription:
    "The manual every Kootenay homeowner should read before calling a contractor. Permits, snow load, wildfire prep, flood risk, hiring tips & budgeting — free instant access.",
  shareImage: GUIDE_COVER_URL,
  shareImageAlt: GUIDE_COVER_ALT,
  keywords: [
    "Kootenay homeowner guide",
    "Fernie home renovation guide",
    "Cranbrook building permits",
    "Nelson contractor hiring",
    "East Kootenay home improvement",
    "BC snow load requirements",
    "FireSmart homeowner guide",
    "Kootenay renovation planning",
    "Sparwood Elkford homeowner manual",
    "RDEK RDCK building permits",
    "Kootenay wildfire preparedness",
    "home renovation budget BC",
    "Black Timber Contracting",
  ],
} as const;

export function fieldGuideMetadata(): Metadata {
  const { title, description, ogTitle, ogDescription, shareImage, shareImageAlt, keywords } =
    FIELD_GUIDE_SEO;

  return {
    metadataBase: new URL(SITE_ORIGIN),
    title,
    description,
    keywords: [...keywords],
    authors: [{ name: "Black Timber Contracting", url: SITE_ORIGIN }],
    creator: "Black Timber Contracting",
    publisher: "Black Timber Contracting",
    category: "Home Improvement",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: PAGE_PATH,
    },
    openGraph: {
      type: "website",
      locale: "en_CA",
      url: PAGE_URL,
      siteName: "Black Timber Contracting",
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: shareImage,
          width: 1200,
          height: 630,
          alt: shareImageAlt,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [shareImage],
    },
  };
}

/** JSON-LD graph: WebPage + WebSite + Organization + FAQPage for rich results. */
export function fieldGuideJsonLd(): Record<string, unknown> {
  const { title, description, ogDescription, shareImage, shareImageAlt } = FIELD_GUIDE_SEO;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: "Black Timber Contracting",
        description:
          "Licensed Kootenay contractor serving Fernie, Cranbrook, Nelson, Sparwood & Elkford.",
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        inLanguage: "en-CA",
      },
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "Black Timber Contracting",
        legalName: "Black Timber Contracting Ltd.",
        url: SITE_ORIGIN,
        logo: {
          "@type": "ImageObject",
          url: LOGO_URL,
          caption: "Black Timber Contracting",
        },
        telephone: "+1-250-910-9071",
        email: "hello@blacktimber.ca",
        areaServed: [
          { "@type": "City", name: "Fernie", containedInPlace: { "@type": "State", name: "British Columbia" } },
          { "@type": "City", name: "Cranbrook", containedInPlace: { "@type": "State", name: "British Columbia" } },
          { "@type": "City", name: "Nelson", containedInPlace: { "@type": "State", name: "British Columbia" } },
          { "@type": "City", name: "Sparwood", containedInPlace: { "@type": "State", name: "British Columbia" } },
          { "@type": "City", name: "Elkford", containedInPlace: { "@type": "State", name: "British Columbia" } },
        ],
        knowsAbout: [
          "Kootenay home renovation",
          "BC building permits",
          "snow load engineering",
          "FireSmart wildfire protection",
          "mountain home construction",
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: title,
        description,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
        about: {
          "@type": "Thing",
          name: "Kootenay homeowner project readiness and resilience",
          description: ogDescription,
        },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: shareImage,
          caption: shareImageAlt,
        },
        inLanguage: "en-CA",
        isAccessibleForFree: true,
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "DigitalDocument",
        name: "The Kootenay Homeowner Field Guide",
        description:
          "A free 18-chapter homeowner manual covering project readiness, permits, snow loads, wildfire prep, flood risk, contractor hiring, rebates, and budgeting for East Kootenay homes.",
        url: PAGE_URL,
        image: shareImage,
        author: { "@id": `${SITE_ORIGIN}/#organization` },
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        inLanguage: "en-CA",
        isAccessibleForFree: true,
        genre: "Home improvement guide",
        keywords: FIELD_GUIDE_SEO.keywords.join(", "),
      },
      {
        "@type": "FAQPage",
        "@id": `${PAGE_URL}#faq`,
        url: PAGE_URL,
        mainEntity: FUNNEL_FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };
}
