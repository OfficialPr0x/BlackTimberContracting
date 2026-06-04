"use client";

/**
 * Cmd+K command palette for the /admin quote builder.
 *
 * UX:
 *   - Globally listens for Cmd/Ctrl+K. Opens a centered modal with a big
 *     textarea. The user types or pastes a free-form description of the
 *     job and/or attaches screenshots (texts, supplier quotes, etc.).
 *   - We POST to /api/admin/quotes/parse with optional vision images.
 *   - The model returns a partial AdminQuoteParseOutput. We hand it to the
 *     parent's `onApply` callback, which merges it into the form state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  Loader,
  AlertCircle,
  ArrowRight,
  ImagePlus,
  Trash2,
} from "lucide-react";
import type {
  AdminQuoteParseInput,
  AdminQuoteParseOutput,
} from "@/lib/admin/schemas";
import {
  filesToParseAttachments,
  MAX_PARSE_IMAGES,
  type ParseImageAttachment,
} from "@/lib/admin/parse-images";

interface CmdKProps {
  /** Snapshot of the form so the AI can avoid clobbering filled fields. */
  currentForm: AdminQuoteParseInput["currentForm"];
  /** Called when the AI returns; parent merges this into form state. */
  onApply: (parsed: AdminQuoteParseOutput) => void;
}

export default function CmdK({ currentForm, onApply }: CmdKProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [images, setImages] = useState<ParseImageAttachment[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminQuoteParseOutput | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    !pending && (text.trim().length >= 8 || images.length > 0);

  const openPalette = useCallback(() => {
    setError(null);
    setResult(null);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) return false;
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

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      try {
        const added = await filesToParseAttachments(Array.from(files), images.length);
        if (added.length > 0) {
          setImages((prev) => [...prev, ...added].slice(0, MAX_PARSE_IMAGES));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add image.");
      }
    },
    [images.length]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void addFiles(e.target.files);
    e.target.value = "";
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    void addFiles(imageFiles);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/quotes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          images: images.map((img) => ({
            url: img.url,
            caption: img.name,
          })),
          currentForm,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Parse failed (${res.status})`);
      }
      setResult(body as AdminQuoteParseOutput);
      onApply(body as AdminQuoteParseOutput);
      setText("");
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't parse that.");
    } finally {
      setPending(false);
    }
  }, [canSubmit, text, images, currentForm, onApply]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <>
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

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 print:hidden"
          onClick={() => !pending && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl rounded-xl bg-brand-charcoal border border-brand-gold/30 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onPaste={onPaste}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border bg-brand-black/40 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-brand-gold">
                  Talk to AI · text + screenshots
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

            <div className="p-5 overflow-y-auto">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                rows={5}
                placeholder={
                  "Describe the job, or paste context. You can also attach screenshots:\n" +
                  "text threads, supplier quotes, handwritten notes, product labels…"
                }
                className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/40 outline-none rounded-lg px-3.5 py-3 text-sm text-white placeholder:text-brand-gray/60 resize-y min-h-[120px]"
                disabled={pending}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending || images.length >= MAX_PARSE_IMAGES}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border hover:border-brand-gold text-[10px] font-mono uppercase tracking-widest text-brand-gray hover:text-brand-gold disabled:opacity-50"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Add images
                </button>
                <span className="text-[10px] font-mono text-brand-gray">
                  Paste screenshots with Ctrl+V · up to {MAX_PARSE_IMAGES} images
                </span>
              </div>

              {images.length > 0 ? (
                <ul className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.map((img) => (
                    <li
                      key={img.id}
                      className="relative group rounded-lg overflow-hidden border border-brand-border bg-brand-black aspect-square"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${img.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-[8px] font-mono text-white/90 bg-black/60 truncate">
                        {img.name}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex items-center justify-between mt-3 gap-3">
                <p className="text-[10px] font-mono text-brand-gray">
                  Vision reads screenshots for names, sizes, SKUs, and prices.
                </p>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 disabled:cursor-not-allowed text-brand-black text-xs font-mono uppercase tracking-widest font-bold transition-colors shrink-0"
                >
                  {pending ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  {pending ? "Reading…" : "Apply to form"}
                  <kbd className="ml-1 px-1.5 py-0.5 rounded bg-brand-black/15 text-[9px] font-mono">
                    ⌘↵
                  </kbd>
                </button>
              </div>

              {error ? (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-md border border-red-500/40 bg-red-500/10 text-xs text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

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
