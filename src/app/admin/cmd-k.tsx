"use client";

/**
 * Cmd+K command palette for the /admin quote builder.
 *
 * UX:
 *   - Globally listens for Cmd/Ctrl+K. Opens a centered modal with a big
 *     textarea. The user types or pastes a free-form description of the
 *     job and hits Submit (or Cmd+Enter).
 *   - We POST the text to /api/admin/quotes/parse with a snapshot of the
 *     fields the user has already filled (so the AI doesn't clobber them).
 *   - The model returns a partial AdminQuoteParseOutput. We hand it to the
 *     parent's `onApply` callback, which merges it into the form state.
 *
 * Why a separate component (not inlined in QuoteBuilder):
 *   - Keeps the giant builder file from getting any longer.
 *   - The keyboard listener and modal state are self-contained — the
 *     parent just plumbs in `currentForm` and `onApply`.
 *
 * The "applied summary" toast is rendered inside the modal then auto-
 * dismisses; if you want a global toast system later, swap it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X, Loader, AlertCircle, ArrowRight } from "lucide-react";
import type {
  AdminQuoteParseInput,
  AdminQuoteParseOutput,
} from "@/lib/admin/schemas";

interface CmdKProps {
  /** Snapshot of the form so the AI can avoid clobbering filled fields. */
  currentForm: AdminQuoteParseInput["currentForm"];
  /** Called when the AI returns; parent merges this into form state. */
  onApply: (parsed: AdminQuoteParseOutput) => void;
}

export default function CmdK({ currentForm, onApply }: CmdKProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminQuoteParseOutput | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper: open the palette while resetting any toast state from a previous
  // session. Centralizing this keeps the open-state transitions out of an
  // effect (where setState would cascade-render), per react-hooks rules.
  const openPalette = useCallback(() => {
    setError(null);
    setResult(null);
    setOpen(true);
  }, []);

  // Global Cmd/Ctrl+K listener. Also Esc to close while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) return false;
          // Opening: also clear stale toasts. Cheap to call inside the
          // updater since these setters are stable and won't re-trigger.
          setError(null);
          setResult(null);
          return true;
        });
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Autofocus the textarea when the modal opens. Pure DOM side-effect,
  // safe to keep in an effect.
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const submit = useCallback(async () => {
    const t = text.trim();
    if (t.length < 8 || pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/quotes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, currentForm }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Parse failed (${res.status})`);
      }
      setResult(body as AdminQuoteParseOutput);
      // Apply immediately — user can still see the summary in the modal.
      onApply(body as AdminQuoteParseOutput);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't parse that.");
    } finally {
      setPending(false);
    }
  }, [text, pending, currentForm, onApply]);

  // Cmd/Ctrl+Enter inside the textarea submits.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      {/* Floating launcher button so users without keyboard discoverability */}
      {/* still find the feature. Hidden on print. */}
      <button
        type="button"
        onClick={openPalette}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-brand-gold hover:bg-brand-gold-hover text-brand-black text-[10px] font-mono uppercase tracking-widest font-bold shadow-2xl transition-colors print:hidden"
        aria-label="Open AI command palette"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Talk to AI
        <kbd className="ml-1 px-1.5 py-0.5 rounded bg-brand-black/15 text-[9px] font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Modal */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 print:hidden"
          onClick={() => !pending && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl rounded-xl bg-brand-charcoal border border-brand-gold/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border bg-brand-black/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-brand-gold">
                  Talk to AI · fills the form
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded text-brand-gray hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Textarea */}
            <div className="p-5">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                rows={6}
                placeholder={
                  "Describe what you're doing in plain English. e.g.,\n" +
                  '"Quoting flooring for John Smith at 250 Mountain View Rd, Fernie. ' +
                  "1200 sqft luxury vinyl plank installed, plus 14 lf of bullnose stair " +
                  "treads. Existing carpet to be removed.\""
                }
                className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/40 outline-none rounded-lg px-3.5 py-3 text-sm text-white placeholder:text-brand-gray/60 resize-y min-h-[140px]"
                disabled={pending}
              />

              <div className="flex items-center justify-between mt-3 gap-3">
                <p className="text-[10px] font-mono text-brand-gray">
                  Grounded in your supplier primer. Won&apos;t overwrite fields you&apos;ve already filled.
                </p>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || text.trim().length < 8}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 disabled:cursor-not-allowed text-brand-black text-xs font-mono uppercase tracking-widest font-bold transition-colors"
                >
                  {pending ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  {pending ? "Thinking..." : "Apply to form"}
                  <kbd className="ml-1 px-1.5 py-0.5 rounded bg-brand-black/15 text-[9px] font-mono">
                    ⌘↵
                  </kbd>
                </button>
              </div>

              {/* Error */}
              {error ? (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-md border border-red-500/40 bg-red-500/10 text-xs text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {/* Applied summary + uncertainties */}
              {result ? (
                <div className="mt-4 rounded-md border border-brand-gold/30 bg-brand-gold/5 p-3.5 space-y-2">
                  <p className="text-xs text-white font-medium">
                    <span className="text-brand-gold">Applied: </span>
                    {result.appliedSummary}
                  </p>
                  {result.uncertainties && result.uncertainties.length > 0 ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-brand-gold mt-2 mb-1 font-mono">
                        Things to double-check
                      </p>
                      <ul className="space-y-0.5 text-[11px] text-brand-gray font-mono">
                        {result.uncertainties.map((u, i) => (
                          <li key={i}>· {u}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
