"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  PenSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  createMailbox,
  fetchMailboxes,
  fetchMessages,
  fetchThread,
  patchMessage,
  type MessagesResponse,
} from "./api";
import ComposeDialog, { type ComposePrefill } from "./ComposeDialog";
import ThreadView from "./ThreadView";
import type {
  EmailCategory,
  EmailFolder,
  FolderCounts,
  Mailbox,
  MessageDetail,
  MessageListItem,
} from "@/lib/email/types";

type FolderKey = EmailFolder | "starred";

const FOLDER_DEFS: { key: FolderKey; label: string; icon: typeof InboxIcon }[] = [
  { key: "inbox", label: "Inbox", icon: InboxIcon },
  { key: "starred", label: "Starred", icon: Star },
  { key: "sent", label: "Sent", icon: Send },
  { key: "archive", label: "Archive", icon: Archive },
  { key: "spam", label: "Spam", icon: TriangleAlert },
  { key: "trash", label: "Trash", icon: Trash2 },
];

const CATEGORY_TABS: { key: EmailCategory; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "promotions", label: "Promotions" },
  { key: "social", label: "Social" },
  { key: "updates", label: "Updates" },
];

interface InboxWorkspaceProps {
  initialMailboxes: Mailbox[];
  supabaseReady: boolean;
  resendReady: boolean;
  loadError: string | null;
}

export default function InboxWorkspace({
  initialMailboxes,
  supabaseReady,
  resendReady,
  loadError,
}: InboxWorkspaceProps) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>(initialMailboxes.filter((m) => m.active));
  const [mailboxId, setMailboxId] = useState<string | null>(
    initialMailboxes.find((m) => m.active)?.id ?? null
  );
  const [folder, setFolder] = useState<FolderKey>("inbox");
  const [category, setCategory] = useState<EmailCategory | null>(null);
  const [search, setSearch] = useState("");

  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [counts, setCounts] = useState<FolderCounts>({});
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<MessageDetail[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [compose, setCompose] = useState<{ prefill?: ComposePrefill } | null>(null);
  const [showNewMailbox, setShowNewMailbox] = useState(false);

  const selectedMailbox = useMemo(
    () => mailboxes.find((m) => m.id === mailboxId) ?? null,
    [mailboxes, mailboxId]
  );

  // ---- Loaders -------------------------------------------------------------
  const loadMessages = useCallback(async () => {
    if (!mailboxId) return;
    setListLoading(true);
    setListError(null);
    try {
      const res: MessagesResponse = await fetchMessages({
        mailboxId,
        folder,
        category: folder === "inbox" && category ? category : undefined,
        search: search.trim() || undefined,
      });
      setMessages(res.messages);
      setCounts(res.counts);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setListLoading(false);
    }
  }, [mailboxId, folder, category, search]);

  const refreshMailboxes = useCallback(async () => {
    try {
      const res = await fetchMailboxes();
      setMailboxes(res.mailboxes.filter((m) => m.active));
    } catch {
      /* keep existing */
    }
  }, []);

  // Debounced message reload on filter/search changes.
  useEffect(() => {
    const t = setTimeout(loadMessages, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadMessages, search]);

  // Open the selected thread.
  const openMessage = useCallback(async (id: string) => {
    setSelectedId(id);
    setThreadLoading(true);
    try {
      const res = await fetchThread(id, true);
      setThread(res.messages);
      // Optimistically clear unread in the list.
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
    } catch {
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // ---- Realtime (SSE) + polling fallback -----------------------------------
  useEffect(() => {
    if (!mailboxId || !supabaseReady) return;
    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void loadMessages();
      }, 400);
    };
    try {
      es = new EventSource(`/api/admin/email/stream?mailboxId=${mailboxId}`);
      es.addEventListener("message", scheduleReload);
    } catch {
      /* EventSource unsupported — polling covers it */
    }
    const poll = setInterval(() => void loadMessages(), 30_000);
    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(poll);
      es?.close();
    };
  }, [mailboxId, supabaseReady, loadMessages]);

  // ---- Actions -------------------------------------------------------------
  async function act(
    id: string,
    patch: Parameters<typeof patchMessage>[1],
    closeThread = false
  ) {
    await patchMessage(id, patch);
    if (closeThread && selectedId === id) {
      setSelectedId(null);
      setThread([]);
    }
    await loadMessages();
  }

  function startReply(msg: MessageDetail, all = false) {
    if (!selectedMailbox) return;
    const to = [msg.fromAddress];
    const cc = all ? msg.ccAddresses.filter((a) => a !== selectedMailbox.address) : undefined;
    setCompose({
      prefill: {
        to,
        cc,
        subject: msg.subject,
        inReplyToMessageId: msg.id,
        html: quoteBlock(msg),
      },
    });
  }

  function startForward(msg: MessageDetail) {
    setCompose({
      prefill: {
        subject: msg.subject,
        forwardMessageId: msg.id,
        html: quoteBlock(msg),
      },
    });
  }

  // ---- Config / empty states ----------------------------------------------
  if (!supabaseReady) {
    return (
      <SetupNotice
        title="Connect Supabase to use the inbox"
        body="Run supabase/email-inbox.sql in your Supabase SQL editor and set SUPABASE_SECRET_KEY. Then reload this page."
      />
    );
  }
  if (loadError) {
    return <SetupNotice title="Couldn't load mailboxes" body={loadError} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {!resendReady && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs">
          RESEND_API_KEY is not set — sending and receiving are disabled until you add it.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Folder rail */}
        <div className="hidden md:flex w-56 shrink-0 flex-col border-r border-brand-border bg-brand-charcoal/60">
          <div className="p-3">
            <button
              onClick={() => setCompose({})}
              disabled={!selectedMailbox || !resendReady}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-gold text-brand-black text-sm font-medium hover:bg-brand-gold-hover disabled:opacity-50"
            >
              <PenSquare className="w-4 h-4" /> Compose
            </button>
          </div>

          <MailboxSwitcher
            mailboxes={mailboxes}
            value={mailboxId}
            onChange={(id) => {
              setMailboxId(id);
              setSelectedId(null);
              setThread([]);
            }}
            onAdd={() => setShowNewMailbox(true)}
          />

          <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {FOLDER_DEFS.map(({ key, label, icon: Icon }) => {
              const c = key === "starred" ? undefined : counts[key as EmailFolder];
              const active = folder === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setFolder(key);
                    setCategory(null);
                    setSelectedId(null);
                    setThread([]);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-brand-gold/15 text-brand-gold"
                      : "text-brand-gray hover:text-white hover:bg-brand-panel"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" /> {label}
                  </span>
                  {c?.unread ? (
                    <span className="text-[10px] font-semibold bg-brand-gold/20 text-brand-gold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {c.unread}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* List + reading area */}
        <div className="flex-1 flex min-w-0">
          {/* Message list */}
          <div
            className={`flex flex-col min-w-0 border-r border-brand-border ${
              selectedId ? "hidden lg:flex lg:w-[22rem] xl:w-[26rem] shrink-0" : "flex-1"
            }`}
          >
            <ListToolbar
              folder={folder}
              mailbox={selectedMailbox}
              mailboxes={mailboxes}
              onMailboxChange={(id) => {
                setMailboxId(id);
                setSelectedId(null);
                setThread([]);
              }}
              onAddMailbox={() => setShowNewMailbox(true)}
              onCompose={() => setCompose({})}
              resendReady={resendReady}
              search={search}
              onSearch={setSearch}
              onRefresh={loadMessages}
              loading={listLoading}
            />

            {folder === "inbox" && (
              <div className="flex gap-1 px-3 py-2 border-b border-brand-border overflow-x-auto">
                <CategoryChip label="All" active={!category} onClick={() => setCategory(null)} />
                {CATEGORY_TABS.map((t) => (
                  <CategoryChip
                    key={t.key}
                    label={t.label}
                    active={category === t.key}
                    onClick={() => setCategory(t.key)}
                  />
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {listError ? (
                <p className="p-4 text-sm text-red-400">{listError}</p>
              ) : messages.length === 0 && !listLoading ? (
                <EmptyList folder={folder} hasMailbox={!!selectedMailbox} />
              ) : (
                <ul>
                  {messages.map((m) => (
                    <MessageRow
                      key={m.id}
                      message={m}
                      active={selectedId === m.id}
                      onOpen={() => openMessage(m.id)}
                      onToggleStar={() => act(m.id, { starred: !m.starred })}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Reading pane */}
          {selectedId && (
            <div className="flex-1 min-w-0 flex flex-col">
              <ThreadView
                messages={thread}
                loading={threadLoading}
                mailbox={selectedMailbox}
                onClose={() => {
                  setSelectedId(null);
                  setThread([]);
                }}
                onReply={(m) => startReply(m)}
                onReplyAll={(m) => startReply(m, true)}
                onForward={startForward}
                onArchive={(m) => act(m.id, { folder: "archive" }, true)}
                onTrash={(m) => act(m.id, { folder: "trash" }, true)}
                onSpam={(m) => act(m.id, { folder: "spam" }, true)}
                onToggleStar={(m) => act(m.id, { starred: !m.starred })}
                onMarkUnread={(m) => act(m.id, { unread: true, scope: "thread" }, true)}
              />
            </div>
          )}
        </div>
      </div>

      {compose && selectedMailbox && (
        <ComposeDialog
          mailbox={selectedMailbox}
          prefill={compose.prefill}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null);
            void loadMessages();
          }}
        />
      )}

      {showNewMailbox && (
        <NewMailboxDialog
          onClose={() => setShowNewMailbox(false)}
          onCreated={(mb) => {
            setShowNewMailbox(false);
            setMailboxId(mb.id);
            void refreshMailboxes();
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function MailboxSwitcher({
  mailboxes,
  value,
  onChange,
  onAdd,
}: {
  mailboxes: Mailbox[];
  value: string | null;
  onChange: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="px-3 pb-2 border-b border-brand-border">
      <label className="text-[10px] font-mono uppercase tracking-wider text-brand-gray">
        Mailbox
      </label>
      <div className="flex gap-1.5 mt-1">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-brand-panel border border-brand-border rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-gold/40"
        >
          {mailboxes.length === 0 && <option value="">No mailboxes yet</option>}
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.address}
            </option>
          ))}
        </select>
        <button
          onClick={onAdd}
          className="p-1.5 rounded-lg border border-brand-border text-brand-gray hover:text-brand-gold hover:border-brand-gold/40"
          aria-label="New address"
          title="Create a new address"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ListToolbar({
  folder,
  mailbox,
  mailboxes,
  onMailboxChange,
  onAddMailbox,
  onCompose,
  resendReady,
  search,
  onSearch,
  onRefresh,
  loading,
}: {
  folder: FolderKey;
  mailbox: Mailbox | null;
  mailboxes: Mailbox[];
  onMailboxChange: (id: string) => void;
  onAddMailbox: () => void;
  onCompose: () => void;
  resendReady: boolean;
  search: string;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="border-b border-brand-border">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h1 className="text-sm font-semibold text-white capitalize flex-1 truncate">{folder}</h1>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-brand-gray hover:text-white hover:bg-brand-panel"
          aria-label="Refresh"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
        <button
          onClick={onCompose}
          disabled={!mailbox || !resendReady}
          className="md:hidden p-1.5 rounded-lg text-brand-gold hover:bg-brand-panel disabled:opacity-40"
          aria-label="Compose"
        >
          <PenSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile mailbox picker */}
      <div className="md:hidden flex gap-1.5 px-3 pb-2">
        <select
          value={mailbox?.id ?? ""}
          onChange={(e) => onMailboxChange(e.target.value)}
          className="flex-1 bg-brand-panel border border-brand-border rounded-lg px-2 py-1.5 text-xs text-white"
        >
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.address}
            </option>
          ))}
        </select>
        <button
          onClick={onAddMailbox}
          className="p-1.5 rounded-lg border border-brand-border text-brand-gray"
          aria-label="New address"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pb-2.5">
        <div className="flex items-center gap-2 bg-brand-panel border border-brand-border rounded-lg px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-brand-gray shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search mail"
            className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-brand-gray/60"
          />
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
        active
          ? "bg-brand-gold/15 text-brand-gold border border-brand-gold/30"
          : "text-brand-gray hover:text-white border border-transparent"
      }`}
    >
      {label}
    </button>
  );
}

function MessageRow({
  message,
  active,
  onOpen,
  onToggleStar,
}: {
  message: MessageListItem;
  active: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
}) {
  const who =
    message.direction === "outbound"
      ? `To: ${message.toAddresses[0] ?? ""}`
      : message.fromName || message.fromAddress;
  return (
    <li
      onClick={onOpen}
      className={`flex gap-2 px-3 py-2.5 border-b border-brand-border/60 cursor-pointer transition-colors ${
        active ? "bg-brand-panel" : "hover:bg-brand-panel/50"
      } ${message.unread ? "bg-brand-charcoal" : ""}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        className="mt-0.5 shrink-0"
        aria-label={message.starred ? "Unstar" : "Star"}
      >
        <Star
          className={`w-4 h-4 ${
            message.starred ? "fill-brand-gold text-brand-gold" : "text-brand-gray/50 hover:text-brand-gray"
          }`}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm truncate flex-1 ${
              message.unread ? "text-white font-semibold" : "text-brand-gray"
            }`}
          >
            {who}
          </span>
          <span className="text-[10px] text-brand-gray/70 shrink-0">{shortDate(message.emailDate)}</span>
        </div>
        <div className={`text-xs truncate ${message.unread ? "text-white/90" : "text-brand-gray"}`}>
          {message.subject || "(no subject)"}
        </div>
        <div className="text-[11px] text-brand-gray/70 truncate flex items-center gap-1.5">
          {message.hasAttachments && <Tag className="w-3 h-3 shrink-0" />}
          {message.snippet}
        </div>
      </div>
    </li>
  );
}

function EmptyList({ folder, hasMailbox }: { folder: FolderKey; hasMailbox: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 text-brand-gray">
      <Mail className="w-10 h-10 mb-3 opacity-40" />
      <p className="text-sm">
        {!hasMailbox ? "Create a mailbox to get started." : `No messages in ${folder}.`}
      </p>
    </div>
  );
}

function SetupNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <Mail className="w-12 h-12 mx-auto mb-4 text-brand-gold/60" />
      <h1 className="text-lg font-semibold text-white mb-2">{title}</h1>
      <p className="text-sm text-brand-gray">{body}</p>
    </div>
  );
}

function NewMailboxDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (mb: Mailbox) => void;
}) {
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<"personal" | "shared">("personal");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const domain = (process.env.NEXT_PUBLIC_EMAIL_DOMAIN || "blacktimber.ca").toLowerCase();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const address = localPart.includes("@") ? localPart : `${localPart}@${domain}`;
      const { mailbox } = await createMailbox({
        address: address.toLowerCase().trim(),
        displayName: displayName.trim() || address,
        kind,
        signatureHtml: signature.trim() || undefined,
      });
      onCreated(mailbox);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create address");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-brand-charcoal border border-brand-border rounded-2xl shadow-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Create a new address</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-brand-gray">
              Address
            </label>
            <div className="flex items-center mt-1 bg-brand-panel border border-brand-border rounded-lg overflow-hidden">
              <input
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                placeholder="jaryd"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
              />
              {!localPart.includes("@") && (
                <span className="px-3 text-xs text-brand-gray border-l border-brand-border py-2">
                  @{domain}
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-brand-gray">
              Display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jaryd — Black Timber"
              className="w-full mt-1 bg-brand-panel border border-brand-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-gold/40"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-brand-gray">
              Type
            </label>
            <div className="flex gap-2 mt-1">
              {(["personal", "shared"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs capitalize border ${
                    kind === k
                      ? "bg-brand-gold/15 text-brand-gold border-brand-gold/30"
                      : "text-brand-gray border-brand-border hover:text-white"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-brand-gray">
              Signature (optional, HTML)
            </label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={3}
              placeholder="— Jaryd, Black Timber Contracting"
              className="w-full mt-1 bg-brand-panel border border-brand-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-gold/40 resize-y"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-brand-gray hover:text-white">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !localPart.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-sm font-medium hover:bg-brand-gold-hover disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function quoteBlock(msg: MessageDetail): string {
  const when = new Date(msg.emailDate).toLocaleString();
  const who = msg.fromName ? `${msg.fromName} <${msg.fromAddress}>` : msg.fromAddress;
  const inner = msg.bodyHtml || (msg.bodyText ? msg.bodyText.replace(/\n/g, "<br>") : "");
  return `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#666">On ${when}, ${who} wrote:<br>${inner}</blockquote>`;
}
