import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// In-site logo — transparent PNG, sits on dark header/footer.
// (Browser tab favicon + Apple touch icon are handled by src/app/icon.png and
// src/app/apple-icon.png via the Next.js file convention. Do NOT also define
// `metadata.icons` here — it would override the file-convention output.)
const LOGO_URL =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

// Branded full-logo-on-black mark for social share previews.
const SHARE_IMAGE =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779589045/ChatGPT_Image_May_23_2026_08_07_11_PM_m3hfi0.png";

export const metadata: Metadata = {
  title: "Black Timber Contracting | Kootenay Custom Decks & Construction",
  description:
    "High-performance deck builders, pergolas, and premium structural renovations serving Cranbrook, Fernie, Sparwood, and across British Columbia. Get an instant design and pricing estimation in under 60 seconds.",
  keywords: [
    "Kootenay deck builders",
    "Black Timber Contracting",
    "Cranbrook contractor",
    "Fernie custom timber",
    "BC deck construction",
    "instant quote contractor",
  ],
  authors: [{ name: "Black Timber Contracting" }],
  openGraph: {
    title: "Black Timber Contracting",
    description: "Real Work. Real Standards. Real Results. Kootenay-built craftsmanship serving BC-wide.",
    images: [{ url: SHARE_IMAGE, alt: "Black Timber Contracting" }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-brand-black text-foreground selection:bg-brand-gold selection:text-brand-black">
        {children}
      </body>
    </html>
  );
}
