"use client";

import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Send,
  X,
  Loader2,
  Sparkles,
  Wand2,
  Scissors,
  StretchHorizontal,
  Briefcase,
  Smile,
  SpellCheck,
} from "lucide-react";
import {
  sendMessage,
  generateEmailDraft,
  type SendInput,
  type AiDraftTone,
  type AiDraftRefine,
} from "./api";
import type { Mailbox } from "@/lib/email/types";

const TONES: { value: AiDraftTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "warm", label: "Warm" },
  { value: "concise", label: "Concise" },
  { value: "formal", label: "Formal" },
  { value: "apologetic", label: "Apologetic" },
  { value: "persuasive", label: "Persuasive" },
];

const REFINEMENTS: { value: AiDraftRefine; label: string; icon: typeof Wand2 }[] = [
  { value: "improve", label: "Improve", icon: Wand2 },
  { value: "shorten", label: "Shorten", icon: Scissors },
  { value: "expand", label: "Expand", icon: StretchHorizontal },
  { value: "more_formal", label: "Formal", icon: Briefcase },
  { value: "more_casual", label: "Casual", icon: Smile },
  { value: "fix_grammar", label: "Fix grammar", icon: SpellCheck },
];

export interface ComposePrefill {
  to?: string[];
  cc?: string[];
  subject?: string;
  html?: string;
  inReplyToMessageId?: string;
  forwardMessageId?: string;
}

interface ComposeDialogProps {
  mailbox: Mailbox;
  prefill?: ComposePrefill;
  onClose: () => void;
  onSent: () => void;
}

interface PendingAttachment {
  filename: string;
  content: string;
  contentType: string;
  size: number;
}

const MAX_TOTAL = 30 * 1024 * 1024; // keep well under Resend's 40MB encoded cap

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ComposeDialog({ mailbox, prefill, onClose, onSent }: ComposeDialogProps) {
  const [to, setTo] = useState((prefill?.to ?? []).join(", "));
  const [cc, setCc] = useState((prefill?.cc ?? []).join(", "));
  const [showCc, setShowCc] = useState((prefill?.cc?.length ?? 0) > 0);
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const aiMode: "compose" | "reply" | "forward" = prefill?.inReplyToMessageId
    ? "reply"
    : prefill?.forwardMessageId
      ? "forward"
      : "compose";
  const threadMessageId = prefill?.inReplyToMessageId ?? prefill?.forwardMessageId;

  const [showAi, setShowAi] = useState(true);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiTone, setAiTone] = useState<AiDraftTone>("professional");
  const [aiBusy, setAiBusy] = useState<null | "draft" | AiDraftRefine>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runAiDraft() {
    setAiBusy("draft");
    setAiError(null);
    try {
      const res = await generateEmailDraft({
        mailboxId: mailbox.id,
        mode: aiMode,
        threadMessageId,
        instruction: aiInstruction.trim() || undefined,
        tone: aiTone,
        currentDraft: body.trim() || undefined,
        to: splitAddresses(to),
        subject: subject.trim() || undefined,
      });
      setBody(res.bodyText);
      if (!subject.trim() && res.subject) setSubject(res.subject);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI draft failed.");
    } finally {
      setAiBusy(null);
    }
  }

  async function runAiRefine(refine: AiDraftRefine) {
    if (!body.trim()) {
      setAiError("Write or generate a draft first, then refine it.");
      return;
    }
    setAiBusy(refine);
    setAiError(null);
    try {
      const res = await generateEmailDraft({
        mailboxId: mailbox.id,
        mode: aiMode,
        threadMessageId,
        tone: aiTone,
        currentDraft: body,
        refine,
        to: splitAddresses(to),
        subject: subject.trim() || undefined,
      });
      setBody(res.bodyText);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI refine failed.");
    } finally {
      setAiBusy(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: PendingAttachment[] = [...attachments];
    let total = next.reduce((sum, a) => sum + a.size, 0);
    for (const file of Array.from(files)) {
      total += file.size;
      if (total > MAX_TOTAL) {
        setError("Attachments exceed the 30 MB limit.");
        break;
      }
      const buf = await file.arrayBuffer();
      next.push({
        filename: file.name,
        content: arrayBufferToBase64(buf),
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
    }
    setAttachments(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSend() {
    const toList = splitAddresses(to);
    if (toList.length === 0) {
      setError("Add at least one recipient.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const html = textToHtml(body) + (prefill?.html ? `<br><br>${prefill.html}` : "");
      const payload: SendInput = {
        mailboxId: mailbox.id,
        to: toList,
        cc: showCc ? splitAddresses(cc) : undefined,
        subject,
        html,
        inReplyToMessageId: prefill?.inReplyToMessageId,
        forwardMessageId: prefill?.forwardMessageId,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      };
      await sendMessage(payload);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-brand-charcoal border border-brand-border sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <h2 className="text-sm font-medium text-white">
            {prefill?.inReplyToMessageId
              ? "Reply"
              : prefill?.forwardMessageId
                ? "Forward"
                : "New message"}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAi((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showAi
                  ? "bg-brand-gold/15 text-brand-gold"
                  : "text-brand-gray hover:text-brand-gold hover:bg-brand-panel"
              }`}
              aria-pressed={showAi}
            >
              <Sparkles className="w-3.5 h-3.5" /> AI
            </button>
            <button onClick={onClose} className="p-1.5 text-brand-gray hover:text-white" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-brand-gray">
            From: {mailbox.displayName} &lt;{mailbox.address}&gt;
          </div>

          <Field label="To">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@example.com, …"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-brand-gray/60"
            />
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="text-[11px] text-brand-gray hover:text-brand-gold"
              >
                Cc
              </button>
            )}
          </Field>

          {showCc && (
            <Field label="Cc">
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-brand-gray/60"
              />
            </Field>
          )}

          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-brand-gray/60"
            />
          </Field>

          {showAi && (
            <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/[0.04] p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-brand-gold">
                <Sparkles className="w-3.5 h-3.5" />
                {aiMode === "reply"
                  ? "AI reply — knows the whole thread"
                  : aiMode === "forward"
                    ? "AI forward note"
                    : "AI compose"}
              </div>

              <div className="flex items-start gap-2">
                <textarea
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (!aiBusy) void runAiDraft();
                    }
                  }}
                  placeholder={
                    aiMode === "reply"
                      ? "Optional: what should the reply say? (leave blank to let AI decide)"
                      : "Tell the AI what to write… e.g. 'Confirm the deck quote and propose starting next Monday.'"
                  }
                  className="flex-1 bg-brand-panel/50 border border-brand-border rounded-lg p-2.5 text-sm text-white placeholder:text-brand-gray/60 outline-none focus:border-brand-gold/40 resize-y"
                />
                <button
                  onClick={runAiDraft}
                  disabled={!!aiBusy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-gold text-brand-black text-xs font-semibold hover:bg-brand-gold-hover disabled:opacity-60 shrink-0 self-stretch"
                >
                  {aiBusy === "draft" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  {body.trim() ? "Redraft" : "Draft"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-brand-gray mr-0.5">Tone</span>
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setAiTone(t.value)}
                    className={`px-2 py-0.5 rounded-full text-[11px] transition-colors ${
                      aiTone === t.value
                        ? "bg-brand-gold/20 text-brand-gold border border-brand-gold/40"
                        : "text-brand-gray border border-brand-border hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {body.trim() && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-brand-gray mr-0.5">Refine</span>
                  {REFINEMENTS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => runAiRefine(value)}
                      disabled={!!aiBusy}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-brand-gray border border-brand-border hover:text-white hover:border-brand-gold/40 disabled:opacity-50"
                    >
                      {aiBusy === value ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Icon className="w-3 h-3" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {aiError && <p className="text-xs text-red-400">{aiError}</p>}
            </div>
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Write your message…"
            className="w-full bg-brand-panel/50 border border-brand-border rounded-lg p-3 text-sm text-white placeholder:text-brand-gray/60 outline-none focus:border-brand-gold/40 resize-y"
          />

          {prefill?.html && (
            <p className="text-[11px] text-brand-gray italic">
              The original message will be quoted below your reply.
            </p>
          )}

          {attachments.length > 0 && (
            <ul className="space-y-1">
              {attachments.map((a, i) => (
                <li
                  key={`${a.filename}-${i}`}
                  className="flex items-center justify-between text-xs bg-brand-panel/50 border border-brand-border rounded-lg px-3 py-1.5"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                    <span className="truncate text-brand-gray">{a.filename}</span>
                    <span className="text-brand-gray/60 shrink-0">{formatBytes(a.size)}</span>
                  </span>
                  <button
                    onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                    className="text-brand-gray hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-lg text-brand-gray hover:text-brand-gold hover:bg-brand-panel"
              aria-label="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-sm font-medium hover:bg-brand-gold-hover disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-brand-border/60 pb-1.5">
      <span className="text-[11px] font-mono uppercase tracking-wider text-brand-gray w-14 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
