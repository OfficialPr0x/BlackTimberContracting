"use client";

/**
 * Full-page admin chat — bookkeeper or concierge with optional Whisper voice.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader, Mic, Square, Sparkles } from "lucide-react";
import Markdown from "@/components/Markdown";

export interface AdminChatProps {
  apiPath: "/api/admin/bookkeeper" | "/api/admin/concierge";
  title: string;
  subtitle: string;
  openingLines: string[];
  /** Enable mic → /api/admin/transcribe */
  voice?: boolean;
  placeholder?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AdminChat({
  apiPath,
  title,
  subtitle,
  openingLines,
  voice = false,
  placeholder = "Ask anything…",
}: AdminChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, transcribing]);

  const streamReply = useCallback(
    async (convo: Message[]) => {
      setPending(true);
      setError(null);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: convo }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accum = "";
        let primed = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!primed) {
            accum += chunk.replace(/^\s+/, "");
            primed = true;
          } else {
            accum += chunk;
          }
          if (accum.length > 0) {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: accum };
              return next;
            });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setPending(false);
      }
    },
    [apiPath]
  );

  const sendText = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || pending || transcribing) return;
      setInput("");
      const convo: Message[] = [...messages, { role: "user", content: t }];
      setMessages(convo);
      await streamReply(convo);
    },
    [messages, pending, transcribing, streamReply]
  );

  const startRecording = async () => {
    if (!voice || recording || pending) return;
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
          if (!res.ok) {
            throw new Error(body?.error?.message ?? "Transcription failed");
          }
          const text = body.text as string;
          setInput((prev) => (prev ? `${prev} ${text}` : text));
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
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
    setRecording(false);
  };

  return (
    <div className="flex flex-col min-h-[calc(100dvh-8rem)] lg:min-h-[calc(100dvh-4rem)] -mx-4 lg:-mx-0">
      <div className="px-4 lg:px-0 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-gold" />
          <h1 className="text-lg font-medium text-white tracking-tight">{title}</h1>
        </div>
        <p className="text-xs text-brand-gray mt-1 max-w-xl">{subtitle}</p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-brand-border bg-brand-charcoal/40 px-4 py-4 space-y-4 min-h-[240px] max-h-[min(58dvh,520px)] lg:max-h-[calc(100dvh-16rem)]"
      >
        {messages.length === 0 ? (
          <div className="space-y-2 text-sm text-brand-gray">
            {openingLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-gold/20 text-white border border-brand-gold/30"
                  : "bg-brand-panel text-brand-gray border border-brand-border"
              }`}
            >
              {m.role === "assistant" && m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : m.role === "assistant" && pending ? (
                <span className="inline-flex items-center gap-2 text-brand-gray font-mono text-xs">
                  <Loader className="w-3.5 h-3.5 animate-spin" /> Thinking…
                </span>
              ) : (
                <span className="text-white whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-xs text-red-300 px-1">{error}</p>
      ) : null}

      <div className="mt-4 sticky bottom-20 lg:bottom-0 bg-brand-black/80 backdrop-blur-sm pt-2 pb-1 lg:pb-0">
        <div className="flex gap-2 items-end">
          {voice ? (
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
          ) : null}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={transcribing ? "Transcribing…" : placeholder}
            disabled={pending || recording || transcribing}
            className="flex-1 resize-none bg-brand-panel border border-brand-border focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-brand-gray/60 min-h-[48px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText(input);
              }
            }}
          />
          <button
            type="button"
            onClick={() => void sendText(input)}
            disabled={pending || !input.trim() || recording || transcribing}
            className="shrink-0 p-3 rounded-xl bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-50 text-brand-black"
            aria-label="Send"
          >
            {pending ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        {voice ? (
          <p className="text-[10px] font-mono text-brand-gray mt-2 px-1">
            Tap mic to dictate · OpenAI Whisper · Enter to send
          </p>
        ) : null}
      </div>
    </div>
  );
}
