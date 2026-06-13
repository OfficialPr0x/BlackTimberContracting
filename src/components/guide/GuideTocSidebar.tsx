"use client";

import { useEffect, useState } from "react";
import type { GuideHeading } from "@/lib/guide/toc";

export default function GuideTocSidebar({ headings }: { headings: GuideHeading[] }) {
  const [activeSlug, setActiveSlug] = useState<string>(headings[0]?.slug ?? "");

  useEffect(() => {
    const sections = headings
      .map((h) => document.getElementById(h.slug))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveSlug(visible[0].target.id);
        }
      },
      // Trigger when a heading enters the top third of the viewport.
      { rootMargin: "-90px 0px -65% 0px", threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    const el = document.getElementById(slug);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSlug(slug);
    history.replaceState(null, "", `#${slug}`);
  };

  return (
    <aside className="hidden lg:block w-72 shrink-0 print:hidden">
      <nav
        aria-label="Table of contents"
        className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2"
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8c714c] mb-3 px-3">
          What&apos;s inside
        </p>
        <ul className="space-y-0.5">
          {headings.map((h) => {
            const isActive = h.slug === activeSlug;
            return (
              <li key={h.slug}>
                <a
                  href={`#${h.slug}`}
                  onClick={(e) => handleClick(e, h.slug)}
                  className={
                    "block rounded-md px-3 py-1.5 text-[12.5px] leading-snug transition-colors border-l-2 " +
                    (isActive
                      ? "border-[#c5a880] bg-[#c5a880]/10 text-[#0b0a09] font-semibold"
                      : "border-transparent text-[#6b6560] hover:text-[#0b0a09] hover:bg-black/[0.03]")
                  }
                >
                  {h.text}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
