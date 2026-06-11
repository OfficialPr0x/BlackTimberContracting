"use client";

import React, { useState, useEffect } from "react";
import { X, BookOpen, Download, CheckCircle, Loader, Copy, Check, ExternalLink } from "lucide-react";

export default function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [accessPassword, setAccessPassword] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [guideLoginReady, setGuideLoginReady] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/guide/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          website,
          page: typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        password?: string;
        emailSent?: boolean;
        guideLoginReady?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !body.password) {
        throw new Error(body?.error?.message ?? "Could not save your request.");
      }

      setAccessPassword(body.password);
      setEmailSent(!!body.emailSent);
      setGuideLoginReady(body.guideLoginReady !== false);

      if (body.guideLoginReady !== false) {
        // Auto sign-in so "Open Field Guide" works immediately
        await fetch("/api/guide/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: body.password }),
        });
      }

      setIsSubmitted(true);
      sessionStorage.setItem(POPUP_DISMISSED_KEY, "true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setPending(false);
    }
  };

  const copyPassword = async () => {
    if (!accessPassword) return;
    await navigator.clipboard.writeText(accessPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-border bg-brand-charcoal p-6 text-left shadow-2xl space-y-6">
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
                <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold block">
                  Free Field Guide
                </span>
                <h4 className="font-extrabold text-white text-lg uppercase tracking-tight mt-0.5">
                  Wait – Before You Leave
                </h4>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-white font-semibold uppercase tracking-wide">
                Get the Kootenay Homeowner Project Readiness &amp; Resilience Manual
              </p>
              <p className="text-xs text-brand-gray leading-relaxed font-normal">
                Permits, snow loads, wildfire prep, contractor red flags, rebates, and budgeting — a
                password-protected e-guide built for Fernie, Cranbrook, Nelson, and the whole Kootenay.
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
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                aria-hidden="true"
                className="absolute -left-[9999px] w-1 h-1 opacity-0"
                name="website"
              />
              {error ? <p className="text-[10px] text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full py-3.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-60 text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
              >
                {pending ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Creating access…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Send Me The Field Guide
                  </>
                )}
              </button>
            </form>

            <div className="text-[9px] text-brand-gray text-center font-mono">
              🔒 Password-protected. We email your access code instantly.
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-5 animate-slide-up">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-white uppercase text-sm tracking-wide">You&apos;re in!</h5>
              <p className="text-xs text-brand-gray max-w-sm mx-auto leading-relaxed">
                Thank you, {name}. Save your access password below
                {emailSent ? (
                  <>
                    {" "}
                    — we also emailed it to{" "}
                    <span className="text-brand-gold font-semibold">{email}</span>
                  </>
                ) : (
                  <span className="block mt-1 text-amber-200/90">
                    (Email delivery is pending — use the password on screen.)
                  </span>
                )}
              </p>
            </div>

            {accessPassword ? (
              <div className="bg-brand-black border border-brand-gold/40 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gold">
                  Your field guide password
                </p>
                <p className="text-2xl font-mono font-bold text-white tracking-widest break-all">
                  {accessPassword}
                </p>
                <button
                  type="button"
                  onClick={() => void copyPassword()}
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-brand-gray hover:text-brand-gold"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy password"}
                </button>
              </div>
            ) : null}

            <a
              href="/guide"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl"
            >
              <ExternalLink className="w-4 h-4" />
              Open Field Guide
            </a>

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
