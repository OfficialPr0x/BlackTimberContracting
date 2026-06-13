"use client";

import { useState } from "react";
import {
  BookOpen,
  CheckCircle,
  Copy,
  Check,
  Download,
  ExternalLink,
  Loader,
} from "lucide-react";

type Variant = "compact" | "card" | "hero";

export default function FieldGuideSubscribeForm({
  variant = "card",
  pagePath = "/field-guide",
  submitLabel = "Send Me The Free Guide",
  className,
}: {
  variant?: Variant;
  pagePath?: string;
  submitLabel?: string;
  className?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [accessPassword, setAccessPassword] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/guide/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, website, page: pagePath }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        password?: string;
        emailSent?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !body.password) {
        throw new Error(body?.error?.message ?? "Could not save your request.");
      }

      setAccessPassword(body.password);
      setEmailSent(!!body.emailSent);

      await fetch("/api/guide/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: body.password }),
      });

      setSubmitted(true);
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

  const shellClass =
    variant === "hero"
      ? "rounded-2xl border border-brand-gold/35 bg-brand-charcoal/95 backdrop-blur-md p-6 sm:p-7 shadow-2xl shadow-black/50"
      : variant === "card"
        ? "rounded-2xl border border-brand-border bg-brand-charcoal p-6 shadow-xl"
        : "";

  if (submitted) {
    return (
      <div className={`${shellClass} ${className ?? ""} text-center space-y-5 animate-slide-up`}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
          <CheckCircle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white uppercase text-sm tracking-wide">You&apos;re in, {name}!</h3>
          <p className="text-xs text-brand-gray leading-relaxed max-w-sm mx-auto">
            {emailSent ? (
              <>
                Your access password is below — we also emailed it to{" "}
                <span className="text-brand-gold font-semibold">{email}</span>.
              </>
            ) : (
              <>Save the password below — it unlocks the full guide right now.</>
            )}
          </p>
        </div>
        {accessPassword ? (
          <div className="bg-brand-black border border-brand-gold/40 rounded-xl p-4 space-y-3 text-left">
            <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gold">
              Your field guide password
            </p>
            <p className="text-2xl font-mono font-bold text-white tracking-widest break-all text-center">
              {accessPassword}
            </p>
            <button
              type="button"
              onClick={() => void copyPassword()}
              className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-brand-gray hover:text-brand-gold mx-auto"
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
          Open Field Guide Now
        </a>
      </div>
    );
  }

  return (
    <div className={`${shellClass} ${className ?? ""}`}>
      {variant !== "compact" ? (
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-brand-gold/10 text-brand-gold rounded-xl border border-brand-gold/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-brand-gold uppercase tracking-widest font-bold">
              Free · Instant access
            </p>
            <p className="text-sm font-bold text-white uppercase tracking-tight">
              Get the full manual
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Your name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none p-3 text-sm text-white rounded-lg placeholder:text-brand-gray"
        />
        <input
          type="email"
          placeholder="Email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none p-3 text-sm text-white rounded-lg placeholder:text-brand-gray"
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
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-3.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-60 text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Creating your access…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {submitLabel}
            </>
          )}
        </button>
      </form>

      <p className="text-[10px] text-brand-gray text-center font-mono mt-4 leading-relaxed">
        Password-protected e-guide · No spam · Unsubscribe anytime
      </p>
    </div>
  );
}
