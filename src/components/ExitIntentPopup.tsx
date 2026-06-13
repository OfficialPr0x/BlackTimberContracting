"use client";

import React, { useState, useEffect } from "react";
import { X, BookOpen, ArrowRight } from "lucide-react";
import FieldGuideSubscribeForm from "@/components/guide/FieldGuideSubscribeForm";

export default function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const POPUP_DISMISSED_KEY = "field_guide_popup_dismissed";

  useEffect(() => {
    const isDismissed = sessionStorage.getItem(POPUP_DISMISSED_KEY);
    if (isDismissed) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setIsVisible(true);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem(POPUP_DISMISSED_KEY, "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-border bg-brand-charcoal p-6 text-left shadow-2xl space-y-5">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-brand-border text-brand-gray hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 pr-8">
          <div className="p-2.5 bg-brand-gold/10 text-brand-gold rounded-xl border border-brand-gold/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold block">
              Free Field Guide
            </span>
            <h4 className="font-extrabold text-white text-lg uppercase tracking-tight mt-0.5">
              Wait – Before You Leave
            </h4>
          </div>
        </div>

        <p className="text-xs text-brand-gray leading-relaxed">
          The Kootenay Homeowner Project Readiness &amp; Resilience Manual — permits, snow loads,
          wildfire prep, and contractor red flags. Free instant access.
        </p>

        <FieldGuideSubscribeForm variant="compact" pagePath="/" />

        <a
          href="/field-guide"
          className="flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-gold hover:text-white"
        >
          See everything inside the guide
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
