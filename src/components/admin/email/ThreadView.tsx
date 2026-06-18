"use client";

import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  Loader2,
  MailOpen,
  Paperclip,
  ReplyAll,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { buildEmailDocument } from "@/lib/email/sanitize";
import type { Mailbox, MessageDetail } from "@/lib/email/types";

interface ThreadViewProps {
  messages: MessageDetail[];
  loading: boolean;
  mailbox: Mailbox | null;
  onClose: () => void;
  onReply: (m: MessageDetail) => void;
  onReplyAll: (m: MessageDetail) => void;
  onForward: (m: MessageDetail) => void;
  onArchive: (m: MessageDetail) => void;
  onTrash: (m: MessageDetail) => void;
  onSpam: (m: MessageDetail) => void;
  onToggleStar: (m: MessageDetail) => void;
  onMarkUnread: (m: MessageDetail) => void;
}

export default function ThreadView(props: ThreadViewProps) {
  const { messages, loading } = props;
  const latest = messages[messages.length - 1];

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-brand-gray">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!latest) {
    return <div className="flex items-center justify-center h-full text-brand-gray text-sm">Message not found.</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-brand-border bg-brand-charcoal/60">
        <button
          onClick={props.onClose}
          className="lg:hidden p-1.5 rounded-lg text-brand-gray hover:text-white hover:bg-brand-panel"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <ToolbarButton label="Reply" icon={CornerUpLeft} onClick={() => props.onReply(latest)} />
        <ToolbarButton label="Reply all" icon={ReplyAll} onClick={() => props.onReplyAll(latest)} />
        <ToolbarButton label="Forward" icon={CornerUpRight} onClick={() => props.onForward(latest)} />
        <div className="flex-1" />
        <ToolbarButton label="Star" icon={Star} onClick={() => props.onToggleStar(latest)} active={latest.starred} />
        <ToolbarButton label="Mark unread" icon={MailOpen} onClick={() => props.onMarkUnread(latest)} />
        <ToolbarButton label="Archive" icon={Archive} onClick={() => props.onArchive(latest)} />
        <ToolbarButton label="Spam" icon={TriangleAlert} onClick={() => props.onSpam(latest)} />
        <ToolbarButton label="Trash" icon={Trash2} onClick={() => props.onTrash(latest)} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-brand-border">
          <h2 className="text-base font-semibold text-white">{latest.subject || "(no subject)"}</h2>
        </div>
        {messages.map((m, i) => (
          <MessageBlock key={m.id} message={m} defaultOpen={i === messages.length - 1} />
        ))}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  icon: typeof Star;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-2 rounded-lg hover:bg-brand-panel ${
        active ? "text-brand-gold" : "text-brand-gray hover:text-white"
      }`}
    >
      <Icon className={`w-4 h-4 ${active && label === "Star" ? "fill-brand-gold" : ""}`} />
    </button>
  );
}

function MessageBlock({ message, defaultOpen }: { message: MessageDetail; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const srcDoc = buildEmailDocument(
    message.bodyHtml || (message.bodyText ? `<pre>${escapeHtml(message.bodyText)}</pre>` : "<p>(empty message)</p>"),
    { dark: true }
  );

  return (
    <div className="border-b border-brand-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-brand-panel/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-white truncate">
              {message.fromName || message.fromAddress}
            </span>
            <span className="text-[11px] text-brand-gray truncate">&lt;{message.fromAddress}&gt;</span>
          </div>
          <div className="text-[11px] text-brand-gray truncate">
            to {message.toAddresses.join(", ") || "—"}
            {message.ccAddresses.length > 0 && ` · cc ${message.ccAddresses.join(", ")}`}
          </div>
        </div>
        <span className="text-[11px] text-brand-gray shrink-0">
          {new Date(message.emailDate).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </button>

      {open && (
        <div className="px-2 pb-4">
          {message.direction === "outbound" && (
            <div className="px-2 pb-2">
              <StatusPill status={message.status} />
            </div>
          )}
          <iframe
            title={`message-${message.id}`}
            srcDoc={srcDoc}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="w-full min-h-[200px] bg-brand-panel rounded-lg border border-brand-border"
            style={{ height: "min(70vh, 800px)" }}
          />
          {message.attachments.length > 0 && (
            <div className="px-2 pt-3">
              <p className="text-[11px] font-mono uppercase tracking-wider text-brand-gray mb-2">
                {message.attachments.length} attachment{message.attachments.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {message.attachments
                  .filter((a) => a.contentDisposition !== "inline")
                  .map((a) => (
                    <a
                      key={a.id}
                      href={`/api/admin/email/attachments/${a.id}/raw?download=1`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-panel border border-brand-border text-xs text-brand-gray hover:text-white hover:border-brand-gold/40"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-brand-gold" />
                      <span className="truncate max-w-[180px]">{a.filename || "attachment"}</span>
                    </a>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const danger = ["bounced", "complained", "failed", "suppressed"].includes(status);
  return (
    <span
      className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
        danger
          ? "bg-red-500/15 text-red-300"
          : "bg-brand-gold/15 text-brand-gold"
      }`}
    >
      {status}
    </span>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
