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
const LOGO_URL =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

// Favicon / Apple touch / OG share — full logo on its own black background so it
// stays legible at tiny browser-tab sizes and previews cleanly on light backgrounds.
const ICON_URL =
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
  icons: {
    icon: ICON_URL,
    shortcut: ICON_URL,
    apple: ICON_URL,
  },
  openGraph: {
    title: "Black Timber Contracting",
    description: "Real Work. Real Standards. Real Results. Kootenay-built craftsmanship serving BC-wide.",
    images: [{ url: ICON_URL, alt: "Black Timber Contracting" }],
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
