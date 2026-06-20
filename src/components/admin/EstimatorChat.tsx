"use client";

/**
 * Onsite AI estimator chat — vision (job-site photos), session memory, and
 * backend actions (creates real estimates/quotes/invoices, sends e-sign).
 *
 * Talks to POST /api/admin/concierge which returns JSON:
 *   { reply, draft, draftTotals, created, actionErrors }
 *
 * The whole `messages` array is the session memory — it's sent back every turn
 * so "this pic is for that estimate" works across the conversation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  Loader,
  Mic,
  Square,
  Sparkles,
  Camera,
  ImagePlus,
  X,
  FileText,
  PenLine,
  ExternalLink,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import CameraCapture from "@/components/admin/CameraCapture";

// --- Lightweight client mirrors of the server estimator shapes -------------

interface DraftLine {
  description: string;
  quantity: number;
  uom: string;
  unitPriceCAD: number;
  source: string;
  leadTimeDays?: number;
  notes?: string;
}

interface Draft {
  id?: string;
  documentType: "quote" | "estimate" | "invoice";
  customer: { name?: string; email?: string; phone?: string; jobSiteAddress?: string };
  project: { type: string; scopeSummary?: string; material?: string };
  lines: DraftLine[];
  taxMode: string;
  freightCAD: number;
}

interface Totals {
  subtotalCAD: number;
  freightCAD: number;
  gstCAD: number;
  pstCAD: number;
  grandTotalCAD: number;
  maxLeadTimeDays: number;
}

interface Created {
  type: "create_document" | "create_esign";
  documentType?: string;
  id: string;
  name: string;
  grandTotalCAD?: number;
  previewUrl?: string;
  signUrl?: string;
}

interface Attachment {
  id: string;
  dataUrl: string;
  name: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  draft?: Draft | null;
  draftTotals?: Totals | null;
  created?: Created[];
}

const MAX_IMAGES = 4;
const MAX_DIMENSION = 1600;

const money = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

/** Downscale + re-encode a photo to a sane data URL before upload. */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = bitmapUrl;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export default function EstimatorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, transcribing]);

  // The most recent draft the agent is working on — drives the sticky bar.
  const latestDraft = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.draft && m.draft.lines.length > 0) {
        return { draft: m.draft, totals: m.draftTotals ?? null };
      }
    }
    return null;
  })();

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      const room = MAX_IMAGES - attachments.length;
      const slice = Array.from(files).slice(0, Math.max(0, room));
      if (slice.length === 0) {
        setError(`Up to ${MAX_IMAGES} photos per message.`);
        return;
      }
      const next: Attachment[] = [];
      for (const file of slice) {
        try {
          const dataUrl = await fileToDataUrl(file);
          next.push({ id: crypto.randomUUID(), dataUrl, name: file.name });
        } catch {
          setError("One photo couldn't be read. Try another.");
        }
      }
      setAttachments((prev) => [...prev, ...next]);
    },
    [attachments.length]
  );

  // Captured frames from the live camera are already downscaled JPEG data URLs.
  const addDataUrls = useCallback(
    (urls: string[]) => {
      if (urls.length === 0) return;
      setError(null);
      setAttachments((prev) => {
        const room = MAX_IMAGES - prev.length;
        const next = urls.slice(0, Math.max(0, room)).map((dataUrl, i) => ({
          id: crypto.randomUUID(),
          dataUrl,
          name: `photo-${prev.length + i + 1}.jpg`,
        }));
        return [...prev, ...next];
      });
    },
    []
  );

  const openCamera = useCallback(() => {
    if (attachments.length >= MAX_IMAGES) {
      setError(`Up to ${MAX_IMAGES} photos per message.`);
      return;
    }
    // Prefer the in-app live camera; fall back to the OS picker if unsupported.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
    ) {
      setShowCamera(true);
    } else {
      cameraRef.current?.click();
    }
  }, [attachments.length]);

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if ((!text && attachments.length === 0) || pending || transcribing) return;

      const images = attachments.map((a) => a.dataUrl);
      const userMsg: Message = {
        role: "user",
        content: text,
        images: images.length ? images : undefined,
      };
      const convo = [...messages, userMsg];
      setMessages(convo);
      setInput("");
      setAttachments([]);
      setPending(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/concierge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: convo.map((m) => ({ role: m.role, content: m.content })),
            images: attachments.map((a) => ({ url: a.dataUrl })),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: body.reply ?? "",
            draft: body.draft ?? null,
            draftTotals: body.draftTotals ?? null,
            created: body.created ?? [],
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setMessages((prev) => prev.slice(0, -1));
        setAttachments(attachments);
        setInput(text);
      } finally {
        setPending(false);
      }
    },
    [attachments, messages, pending, transcribing]
  );

  // --- Voice (OpenAI Whisper, same flow as the old concierge) --------------
  const startRecording = async () => {
    if (recording || pending) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 500) {
          setError("Recording too short. Hold the mic a bit longer.");
          setTranscribing(false);
          return;
        }
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, `voice.${mime.includes("webm") ? "webm" : "m4a"}`);
          const res = await fetch("/api/admin/transcribe", { method: "POST", body: fd });
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error?.message ?? "Transcription failed");
          setInput((prev) => (prev ? `${prev} ${body.text}` : body.text));
          inputRef.current?.focus();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Voice failed");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied. Allow mic in browser settings or type instead.");
    }
  };

  const stopRecording = () => {
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mx-auto w-full max-w-3xl flex flex-col h-full min-h-0 px-3 sm:px-4 lg:px-6">
      <div className="pt-3 sm:pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-gold" />
          <h1 className="text-lg font-medium text-white tracking-tight">Onsite Estimator</h1>
        </div>
        <p className="text-xs text-brand-gray mt-1 max-w-2xl hidden sm:block">
          Your AI pro quoter. Snap job-site photos, talk through the scope, and I&apos;ll build a
          transparent estimate — then create the real estimate, quote, or invoice on command.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-brand-border bg-brand-charcoal/40 px-3 sm:px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="space-y-2 text-sm text-brand-gray">
            <p>Walk me through the job. For example:</p>
            <ul className="list-disc pl-5 space-y-1 text-brand-gray/80">
              <li>Add photos of the deck + say &ldquo;rebuild this 12x16 deck, PT framing, cedar boards.&rdquo;</li>
              <li>&ldquo;Customer is Dave Smith, dave@email.com, job site in Fernie.&rdquo;</li>
              <li>When it looks right: &ldquo;create the estimate&rdquo; — I&apos;ll save it and give you a PDF link.</li>
              <li>&ldquo;Send it to Dave for signature.&rdquo;</li>
            </ul>
            <p className="text-brand-gray/70">
              Final pricing is always subject to a Black Timber site confirmation / Fernie HH desk check.
            </p>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] sm:max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-gold/20 text-white border border-brand-gold/30"
                  : "bg-brand-panel text-brand-gray border border-brand-border"
              }`}
            >
              {m.images && m.images.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-2">
                  {m.images.map((src, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={k}
                      src={src}
                      alt="Job site"
                      className="h-20 w-20 object-cover rounded-lg border border-brand-border"
                    />
                  ))}
                </div>
              ) : null}

              {m.role === "assistant" && m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : m.content ? (
                <span className="whitespace-pre-wrap">{m.content}</span>
              ) : m.role === "user" ? (
                <span className="text-white/60 italic">Photo(s) attached</span>
              ) : null}

              {m.role === "assistant" && m.draft && m.draft.lines.length > 0 ? (
                <DraftCard draft={m.draft} totals={m.draftTotals ?? null} />
              ) : null}

              {m.created && m.created.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {m.created.map((c, k) => (
                    <CreatedCard key={k} created={c} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {pending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3.5 py-2.5 bg-brand-panel border border-brand-border">
              <span className="inline-flex items-center gap-2 text-brand-gray font-mono text-xs">
                <Loader className="w-3.5 h-3.5 animate-spin" /> Working the numbers…
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-red-300 px-1">{error}</p> : null}

      {/* Running draft summary */}
      {latestDraft ? (
        <div className="mt-3 rounded-xl border border-brand-gold/30 bg-brand-gold/5 px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-brand-gold/80">
              Current {latestDraft.draft.documentType}
              {latestDraft.draft.customer.name ? ` · ${latestDraft.draft.customer.name}` : ""}
            </p>
            <p className="text-sm text-white font-medium truncate">
              {latestDraft.totals ? money(latestDraft.totals.grandTotalCAD) : "—"}
              <span className="text-brand-gray font-normal">
                {" "}· {latestDraft.draft.lines.length} line
                {latestDraft.draft.lines.length === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void send(`Create this ${latestDraft.draft.documentType} now.`)}
              disabled={pending}
              className="px-3 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 text-brand-black text-xs font-semibold"
            >
              Create {latestDraft.draft.documentType}
            </button>
          </div>
        </div>
      ) : null}

      {/* Attachment tray */}
      {attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.dataUrl}
                alt={a.name}
                className="h-16 w-16 object-cover rounded-lg border border-brand-border"
              />
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="absolute -top-2 -right-2 bg-brand-black border border-brand-border rounded-full p-0.5 text-brand-gray hover:text-white"
                aria-label="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 shrink-0 pb-3">
        <div className="flex gap-2 items-end">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={openCamera}
            disabled={pending || attachments.length >= MAX_IMAGES}
            className="shrink-0 p-3 rounded-xl border border-brand-border text-brand-gold hover:border-brand-gold disabled:opacity-40"
            aria-label="Open camera"
            title="Open camera"
          >
            <Camera className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={pending || attachments.length >= MAX_IMAGES}
            className="shrink-0 p-3 rounded-xl border border-brand-border text-brand-gold hover:border-brand-gold disabled:opacity-40"
            aria-label="Add photos"
            title="Add photos"
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={pending || transcribing}
            className={`shrink-0 p-3 rounded-xl border transition-colors ${
              recording
                ? "bg-red-500/20 border-red-400/50 text-red-200 animate-pulse"
                : "border-brand-border text-brand-gold hover:border-brand-gold"
            }`}
            aria-label={recording ? "Stop recording" : "Record voice"}
          >
            {recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={transcribing ? "Transcribing…" : "Describe the job, or attach photos…"}
            disabled={pending || recording || transcribing}
            className="flex-1 resize-none bg-brand-panel border border-brand-border focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-brand-gray/60 min-h-[48px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={pending || recording || transcribing || (!input.trim() && attachments.length === 0)}
            className="shrink-0 p-3 rounded-xl bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 text-brand-black"
            aria-label="Send"
          >
            {pending ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-[10px] font-mono text-brand-gray mt-2 px-1 hidden sm:block">
          Live camera · photos · voice (Whisper) · creates real Q/E/I docs · Enter to send
        </p>
      </div>
      </div>

      {showCamera ? (
        <CameraCapture
          remaining={MAX_IMAGES - attachments.length}
          onCapture={addDataUrls}
          onClose={() => setShowCamera(false)}
          onUseSystemCamera={() => cameraRef.current?.click()}
        />
      ) : null}
    </div>
  );
}

// --- Sub-components ---------------------------------------------------------

function DraftCard({ draft, totals }: { draft: Draft; totals: Totals | null }) {
  return (
    <div className="mt-3 rounded-xl border border-brand-border bg-brand-black/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-brand-border flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-brand-gold" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-brand-gold">
          Draft {draft.documentType}
        </span>
        {draft.customer.name ? (
          <span className="text-xs text-brand-gray truncate">· {draft.customer.name}</span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-brand-gray/70 text-left">
              <th className="px-3 py-1.5 font-medium">Item</th>
              <th className="px-2 py-1.5 font-medium text-right">Qty</th>
              <th className="px-2 py-1.5 font-medium text-right">Unit</th>
              <th className="px-3 py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((l, i) => (
              <tr key={i} className="border-t border-brand-border/50 align-top">
                <td className="px-3 py-1.5 text-white">
                  {l.description}
                  {l.notes ? <span className="block text-brand-gray/60">{l.notes}</span> : null}
                </td>
                <td className="px-2 py-1.5 text-right text-brand-gray whitespace-nowrap">
                  {l.quantity} {l.uom}
                </td>
                <td className="px-2 py-1.5 text-right text-brand-gray whitespace-nowrap">
                  {money(l.unitPriceCAD)}
                </td>
                <td className="px-3 py-1.5 text-right text-white whitespace-nowrap">
                  {money(l.quantity * l.unitPriceCAD)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totals ? (
        <div className="px-3 py-2 border-t border-brand-border text-xs space-y-0.5">
          <Row label="Subtotal" value={money(totals.subtotalCAD)} />
          {totals.freightCAD > 0 ? <Row label="Freight" value={money(totals.freightCAD)} /> : null}
          <Row label="GST (5%)" value={money(totals.gstCAD)} />
          {totals.pstCAD > 0 ? <Row label="PST (7%)" value={money(totals.pstCAD)} /> : null}
          <div className="flex justify-between pt-1 mt-1 border-t border-brand-border/60">
            <span className="text-white font-semibold">Grand total</span>
            <span className="text-brand-gold font-semibold">{money(totals.grandTotalCAD)}</span>
          </div>
          <p className="text-[10px] text-brand-gray/60 pt-1">
            Not saved yet — say &ldquo;create it&rdquo; to issue a real document.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-brand-gray">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CreatedCard({ created }: { created: Created }) {
  const isEsign = created.type === "create_esign";
  return (
    <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-white font-medium flex items-center gap-1.5">
          {isEsign ? <PenLine className="w-3.5 h-3.5 text-brand-gold" /> : <FileText className="w-3.5 h-3.5 text-brand-gold" />}
          {isEsign ? "Sent for signature" : `${created.documentType ?? "Document"} ${created.id}`}
        </p>
        <p className="text-[11px] text-brand-gray truncate">
          {created.name}
          {created.grandTotalCAD != null ? ` · ${money(created.grandTotalCAD)}` : ""}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        {created.previewUrl ? (
          <a
            href={created.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-brand-gold hover:text-brand-gold-hover"
          >
            PDF <ExternalLink className="w-3 h-3" />
          </a>
        ) : null}
        {created.signUrl ? (
          <a
            href={created.signUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-brand-gold hover:text-brand-gold-hover"
          >
            Portal <ExternalLink className="w-3 h-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
