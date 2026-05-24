"use client";

import React, { useState, useEffect } from "react";
import { X, BookOpen, Download, CheckCircle } from "lucide-react";

export default function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    // Check if user already dismissed or submitted
    const isDismissed = sessionStorage.getItem("deck_guide_popup_dismissed");
    if (isDismissed) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger when mouse moves above the viewport (e.g. to address bar or other tabs)
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
    sessionStorage.setItem("deck_guide_popup_dismissed", "true");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    sessionStorage.setItem("deck_guide_popup_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-border bg-brand-charcoal p-6 text-left shadow-2xl space-y-6">
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-brand-border text-brand-gray hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSubmitted ? (
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-brand-gold/10 text-brand-gold rounded-xl border border-brand-gold/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold block">Exclusive Guide</span>
                <h4 className="font-extrabold text-white text-lg uppercase tracking-tight mt-0.5">
                  Wait – Before You Leave
                </h4>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-white font-semibold uppercase tracking-wide">
                Get our Free 2026 Kootenay Deck Pricing Guide
              </p>
              <p className="text-xs text-brand-gray leading-relaxed font-normal">
                A 30-page workbook loaded with structural prints, material comparisons (Cedar vs Composite), East Kootenay snow-load specifications, and critical permit pitfalls to avoid.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none p-3 text-xs text-white rounded-lg placeholder:text-brand-gray"
              />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none p-3 text-xs text-white rounded-lg placeholder:text-brand-gray"
              />
              <button
                type="submit"
                className="w-full py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Send Me The Pricing Guide
              </button>
            </form>

            <div className="text-[9px] text-brand-gray text-center font-mono">
              🔒 100% Free. No spam. Unsubscribe anytime.
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4 animate-slide-up">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <h5 className="font-bold text-white uppercase text-sm tracking-wide">Pricing Guide Sent!</h5>
              <p className="text-xs text-brand-gray max-w-xs mx-auto leading-relaxed">
                Thank you, {name}. The <strong>2026 Kootenay Deck Pricing Guide PDF</strong> is heading to <span className="text-brand-gold font-semibold">{email}</span> right now.
              </p>
            </div>

            <button
              onClick={handleClose}
              className="px-6 py-2 bg-brand-border text-white text-[10px] font-bold rounded-lg hover:bg-brand-border/80 uppercase tracking-widest transition-all"
            >
              Continue Browsing
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
