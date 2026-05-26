"use client";

/**
 * Floating "Black Timber Concierge" chat — bottom-right of every page.
 *
 * Streams responses from /api/ai/concierge. Conversation lives in component
 * state (no persistence) so refreshing clears the chat. If we want history
 * later, swap to localStorage or a server-side session store.
 */

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Send, Loader, Phone } from "lucide-react";
import Markdown from "@/components/Markdown";

const LOGO_SRC = "/black-timber-logo.png";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const OPENING = [
  "Hey — I'm the Black Timber Concierge.",
  "Ask me anything about decks, pergolas, garages, additions, or your site. I can also point you at the right tool on the page if you tell me what you're trying to figure out.",
];

export default function ConciergeChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on every new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  // Focus the input when the panel opens
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || pending) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setPending(true);

    // Snapshot the conversation we want to send (excluding the empty placeholder we just added)
    const convoForApi: Message[] = [...messages, { role: "user", content: text }];

    try {
      const res = await fetch("/api/ai/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: convoForApi }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message ?? `Chat failed (${res.status})`);
      }

      // Read the streamed text and append to the last assistant message.
      // The server emits a leading space "primer" to flush proxy buffers —
      // we strip it on the first non-empty chunk.
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
        // Only update state if we actually have visible content yet —
        // otherwise the placeholder/"thinking" indicator keeps showing.
        if (accum.length > 0) {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: accum };
            return next;
          });
        }
      }

      if (!open) setUnread(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      // Remove the empty assistant placeholder
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {/* Floating action button (closed state) */}
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setUnread(false);
          }}
          aria-label="Open Black Timber Concierge chat"
          className="fixed bottom-5 right-5 z-40 group flex items-center gap-2 pl-1.5 pr-4 py-1.5 bg-brand-gold text-brand-black rounded-full shadow-2xl hover:scale-105 transition-transform"
        >
          <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-black overflow-hidden ring-1 ring-brand-black">
            <Image
              src={LOGO_SRC}
              alt="Black Timber Contracting"
              width={36}
              height={36}
              className="object-cover scale-110"
              priority
            />
            {unread && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-brand-gold" />
            )}
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-widest">Ask Black Timber AI</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-96 max-w-md bg-brand-charcoal border border-brand-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-black border-b border-brand-border">
            <div className="flex items-center gap-2.5">
              <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-black overflow-hidden ring-1 ring-brand-gold/30">
                <Image
                  src={LOGO_SRC}
                  alt="Black Timber Contracting"
                  width={36}
                  height={36}
                  className="object-cover scale-110"
                  priority
                />
                <span className="absolute -bottom-0 -right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-brand-black" />
              </span>
              <div className="leading-tight">
                <div className="text-xs font-bold text-white uppercase tracking-wider">Black Timber Concierge</div>
                <div className="text-[9px] text-brand-gray uppercase tracking-widest">Live · Powered by AI</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="p-1 rounded-full text-brand-gray hover:text-white hover:bg-brand-border transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="space-y-3">
                {OPENING.map((line, i) => (
                  <div
                    key={i}
                    className="max-w-[90%] bg-brand-panel border border-brand-border rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-brand-gray leading-relaxed"
                  >
                    {line}
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "How much for a 20x16 cedar deck?",
                    "What permits do I need in Fernie?",
                    "When can you start?",
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setInput(s);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-brand-border text-brand-gold hover:border-brand-gold/40 hover:bg-brand-gold/5 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isLastAssistant =
                m.role === "assistant" && i === messages.length - 1 && pending;
              return (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-black overflow-hidden ring-1 ring-brand-gold/20">
                      <Image
                        src={LOGO_SRC}
                        alt=""
                        width={24}
                        height={24}
                        className="object-cover scale-110"
                      />
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-brand-gold text-brand-black rounded-2xl rounded-tr-sm font-medium whitespace-pre-wrap"
                        : "bg-brand-panel border border-brand-border text-brand-gray rounded-2xl rounded-tl-sm"
                    }`}
                  >
                    {m.content ? (
                      m.role === "user" ? (
                        m.content
                      ) : (
                        <div className="relative">
                          <Markdown>{m.content}</Markdown>
                          {isLastAssistant && (
                            <span
                              aria-hidden
                              className="inline-block w-[6px] h-[12px] -mb-[1px] ml-0.5 bg-brand-gold animate-pulse align-middle"
                            />
                          )}
                        </div>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-brand-gray">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" />
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-brand-gold/70">Thinking</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {error && (
              <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                {error}
              </div>
            )}
          </div>

          {/* Footer: input */}
          <div className="border-t border-brand-border p-3 bg-brand-black space-y-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask anything…"
                disabled={pending}
                className="flex-1 resize-none bg-brand-charcoal border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2 text-xs text-white placeholder:text-brand-gray max-h-32 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || pending}
                aria-label="Send message"
                className="p-2.5 rounded-lg bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-brand-black transition-all"
              >
                {pending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex justify-between items-center text-[9px] uppercase tracking-widest">
              <span className="text-brand-gray">AI · may make mistakes</span>
              <a
                href="tel:2509198476"
                className="text-brand-gold hover:underline flex items-center gap-1"
              >
                <Phone className="w-2.5 h-2.5" /> 250-919-8476
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
