"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { LogOut, Printer } from "lucide-react";
import FieldGuideNextStep from "@/components/guide/FieldGuideNextStep";
import GuideTocSidebar from "@/components/guide/GuideTocSidebar";
import type { GuideHeading } from "@/lib/guide/toc";

const LOGO_URL =
  "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1779592928/ChatGPT_Image_May_23__2026__08_07_11_PM-removebg-preview_f81lz0.png";

export default function FieldGuideView({
  markdown,
  subscriberEmail,
  headings,
}: {
  markdown: string;
  subscriberEmail: string;
  headings: GuideHeading[];
}) {
  const logout = async () => {
    await fetch("/api/guide/logout", { method: "POST" });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1a1816]">
      <header className="sticky top-0 z-30 border-b border-[#e8e4dc] bg-[#0b0a09] text-white print:hidden">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-10 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="Black Timber" className="h-10 w-auto shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#c5a880] truncate">
                Field Guide · Member access
              </p>
              <p className="text-[11px] text-white/70 truncate font-mono">{subscriberEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-[10px] font-mono uppercase hover:bg-white/10"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-[10px] font-mono uppercase hover:bg-white/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-10 py-10 sm:py-14 flex gap-10 lg:gap-16">
        <GuideTocSidebar headings={headings} />
        <article className="btc-field-guide min-w-0 flex-1 max-w-[60rem] prose-guide prose-guide--wide">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSlug]}>
            {markdown}
          </ReactMarkdown>
        </article>
      </div>

      <FieldGuideNextStep />
    </div>
  );
}
