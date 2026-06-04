"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderPlus,
  Upload,
  FilePlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Save,
  Loader,
  RefreshCw,
  Folder,
  FileText,
  Image as ImageIcon,
  PanelLeft,
  MessageSquare,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import SpreadsheetViewer from "./SpreadsheetViewer";
import type { FileNodeDetail, FileNodeRow, FileTreeNode } from "@/lib/admin/files/types";
import { guessViewer } from "@/lib/admin/files/types";

type MobilePane = "files" | "editor" | "chat";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

function TreeRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggle,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string, kind: FileTreeNode["kind"]) => void;
}) {
  const isFolder = node.kind === "folder";
  const open = expanded.has(node.id);
  const active = selectedId === node.id;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isFolder) onToggle(node.id);
          onSelect(node.id, node.kind);
        }}
        className={`w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-md text-left text-xs transition-colors ${
          active ? "bg-brand-gold/15 text-brand-gold" : "text-brand-gray hover:text-white hover:bg-brand-panel/80"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (
          open ? (
            <ChevronDown className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" />
          )
        ) : (
          <span className="w-3" />
        )}
        {isFolder ? (
          <Folder className="w-3.5 h-3.5 shrink-0 text-brand-gold/80" />
        ) : node.mimeType?.startsWith("image/") ? (
          <ImageIcon className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <FileText className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && open
        ? node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}

export default function BookkeeperWorkspace() {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [file, setFile] = useState<FileNodeDetail | null>(null);
  const [mdDraft, setMdDraft] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("files");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const refreshTree = useCallback(async () => {
    const res = await fetch("/api/admin/files");
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Could not load files");
    setTree(body.tree as FileTreeNode[]);
    return body.nodes as FileNodeRow[];
  }, []);

  /** Mirror Q-/E-/I- from documents table into vault folder Quotes & Invoices */
  const syncQuotesToVault = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/files/sync-quotes", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Sync failed (${res.status})`);
      }
      if (body.tree) setTree(body.tree as FileTreeNode[]);
      const folderId = body.sync?.quotesFolderId as string | null | undefined;
      if (folderId) {
        setExpanded((prev) => new Set(prev).add(folderId));
      }
      const sync = body.sync as {
        created?: number;
        updated?: number;
        totalDocuments?: number;
        errors?: string[];
      };
      if (sync?.errors?.length) {
        setError(`Vault sync: ${sync.errors.slice(0, 3).join("; ")}`);
      }
      return sync;
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await syncQuotesToVault();
      } catch (e) {
        if (!cancelled) {
          try {
            await refreshTree();
          } catch {
            /* refresh also failed */
          }
          const msg = e instanceof Error ? e.message : "Load failed";
          if (!msg.includes("503") && !msg.toLowerCase().includes("not configured")) {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTree, syncQuotesToVault]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, chatPending]);

  const loadFile = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/files/${id}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Could not open file");
    const detail = body as FileNodeDetail;
    setFile(detail);
    setMdDraft(detail.textContent ?? "");
    setMobilePane("editor");
  }, []);

  const onSelectNode = (id: string, kind: FileTreeNode["kind"]) => {
    setSelectedId(id);
    if (kind === "folder") {
      setSelectedFolderId(id);
      setFile(null);
    } else {
      void loadFile(id).catch((e) => setError(e instanceof Error ? e.message : "Open failed"));
    }
  };

  const toggleFolder = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const viewer = useMemo(() => {
    if (!file) return null;
    return guessViewer(file.mimeType, file.name);
  }, [file]);

  const handleUpload = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", list[0]!);
    if (selectedFolderId) fd.append("parentId", selectedFolderId);
    const res = await fetch("/api/admin/files/upload", { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
    await refreshTree();
    await loadFile(body.id as string);
  };

  const saveMarkdown = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/files/${file.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: mdDraft }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Save failed");
      setFile(body as FileNodeDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const aiEditMarkdown = async () => {
    if (!file) return;
    const instruction = window.prompt("What should the AI change in this note?");
    if (!instruction?.trim()) return;
    setAiPending(true);
    try {
      const res = await fetch(`/api/admin/files/${file.id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "AI edit failed");
      setMdDraft(body.content as string);
      await saveMarkdown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI edit failed");
    } finally {
      setAiPending(false);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatPending) return;
    setChatInput("");
    const convo: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(convo);
    setChatPending(true);
    setError(null);

    try {
      const contextFileIds = file?.kind === "file" ? [file.id] : [];
      const res = await fetch("/api/admin/bookkeeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: convo,
          contextFileIds,
          selectedFolderId: selectedFolderId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Chat failed (${res.status})`);
      }

      const reply = body.reply as string;
      setMessages([...convo, { role: "assistant", content: reply }]);

      const created = body.created as Array<{ type: string; id: string; name: string }> | undefined;
      if (created?.length) {
        await syncQuotesToVault().catch(() => refreshTree());
        const md = created.find(
          (c) => c.type === "create_markdown" || c.type === "archive_document"
        );
        if (md) await loadFile(md.id);
        else {
          const folder = created.find((c) => c.type === "create_folder");
          if (folder) {
            setSelectedFolderId(folder.id);
            setSelectedId(folder.id);
            setExpanded((prev) => new Set(prev).add(folder.id));
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
      setMessages(convo);
    } finally {
      setChatPending(false);
    }
  };

  const panelShell = "flex flex-col h-full min-h-0 border border-brand-border rounded-xl bg-brand-charcoal/50 overflow-hidden";

  const fileTreePanel = (
    <div className={panelShell}>
      <div className="flex items-center gap-1 p-2 border-b border-brand-border flex-wrap">
        <button
          type="button"
          title="New folder"
          onClick={async () => {
            const name = window.prompt("Folder name");
            if (!name) return;
            await fetch("/api/admin/files", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "folder",
                name,
                parentId: selectedFolderId,
              }),
            });
            await refreshTree();
          }}
          className="p-2 rounded-lg border border-brand-border hover:border-brand-gold text-brand-gray hover:text-brand-gold"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="New markdown note"
          onClick={async () => {
            const name = window.prompt("Note name");
            if (!name) return;
            const res = await fetch("/api/admin/files", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "markdown",
                name,
                parentId: selectedFolderId,
              }),
            });
            const body = await res.json();
            if (res.ok) {
              await refreshTree();
              await loadFile(body.id);
            }
          }}
          className="p-2 rounded-lg border border-brand-border hover:border-brand-gold text-brand-gray hover:text-brand-gold"
        >
          <FilePlus className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Sync quotes & invoices from database into Quotes & Invoices folder"
          disabled={syncing || loading}
          onClick={() => void syncQuotesToVault().catch((e) => setError(e instanceof Error ? e.message : "Sync failed"))}
          className="p-2 rounded-lg border border-brand-border hover:border-brand-gold text-brand-gray hover:text-brand-gold disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          title="Upload receipt / file"
          onClick={() => uploadRef.current?.click()}
          className="p-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.md,.csv,.xlsx,.xls,.txt"
          onChange={(e) => void handleUpload(e.target.files).catch((err) => setError(String(err)))}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="text-xs text-brand-gray font-mono p-2">Loading vault…</p>
        ) : tree.length === 0 ? (
          <p className="text-xs text-brand-gray p-2">Run supabase/files-schema.sql to seed folders.</p>
        ) : (
          tree.map((n) => (
            <TreeRow
              key={n.id}
              node={n}
              depth={0}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={toggleFolder}
              onSelect={onSelectNode}
            />
          ))
        )}
      </div>
    </div>
  );

  const editorPanel = (
    <div className={`${panelShell} bg-brand-charcoal/40`}>
      {!file ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-brand-gray">
          Select a file from the tree, or upload a receipt / photo.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-brand-border">
            <span className="text-xs font-mono text-brand-gold truncate">{file.name}</span>
            <div className="flex gap-1 shrink-0">
              {viewer === "markdown" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void aiEditMarkdown()}
                    disabled={aiPending}
                    className="p-1.5 rounded border border-brand-border hover:border-brand-gold text-brand-gold"
                    title="AI edit"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveMarkdown()}
                    disabled={saving}
                    className="p-1.5 rounded border border-brand-border hover:border-brand-gold"
                    title="Save"
                  >
                    {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Delete this item?")) return;
                  await fetch(`/api/admin/files/${file.id}`, { method: "DELETE" });
                  setFile(null);
                  await refreshTree();
                }}
                className="p-1.5 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {viewer === "markdown" ? (
              <div className="grid lg:grid-cols-2 h-full min-h-[280px]">
                <textarea
                  value={mdDraft}
                  onChange={(e) => setMdDraft(e.target.value)}
                  className="w-full h-full min-h-[240px] bg-brand-black border-0 border-r border-brand-border p-3 text-sm text-white font-mono resize-none focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
                  spellCheck
                />
                <div className="overflow-y-auto p-3 prose-invert text-sm hidden lg:block">
                  <Markdown>{mdDraft || "*Preview*"}</Markdown>
                </div>
              </div>
            ) : viewer === "pdf" && file.downloadUrl ? (
              <iframe
                title={file.name}
                src={file.downloadUrl}
                className="w-full h-[min(58dvh,520px)] bg-white"
              />
            ) : viewer === "image" && file.downloadUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.downloadUrl}
                alt={file.name}
                className="max-w-full max-h-[min(58dvh,520px)] object-contain mx-auto p-4"
              />
            ) : viewer === "spreadsheet" && file.downloadUrl ? (
              <SpreadsheetViewer url={file.downloadUrl} />
            ) : file.downloadUrl ? (
              <a
                href={file.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="block p-6 text-brand-gold text-sm font-mono"
              >
                Download / open file →
              </a>
            ) : (
              <p className="p-4 text-sm text-brand-gray">No preview available.</p>
            )}
          </div>
        </>
      )}
    </div>
  );

  const chatPanel = (
    <div className={panelShell}>
      <div className="shrink-0 px-3 py-2 border-b border-brand-border">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-gold">AI Bookkeeper</p>
        <p className="text-[10px] text-brand-gray mt-0.5">
          {file ? `Context: ${file.name}` : "Synced with quotes · invoices · vault"}
        </p>
      </div>
      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-brand-gray">
            Ask about open invoices, match deposits, or say &quot;archive I-20260604-AB3C to
            Quotes &amp; Invoices&quot; — I see your live quote register and can file vault notes.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed rounded-lg px-2.5 py-2 ${
                m.role === "user"
                  ? "bg-brand-gold/15 text-white ml-2 sm:ml-4"
                  : "bg-brand-panel text-brand-gray mr-2 sm:mr-4"
              }`}
            >
              {m.role === "assistant" && m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : m.role === "user" ? (
                <span className="text-white whitespace-pre-wrap">{m.content}</span>
              ) : (
                <span className="inline-flex items-center gap-2 text-brand-gray">
                  <Loader className="w-3 h-3 animate-spin" /> Thinking…
                </span>
              )}
            </div>
          ))
        )}
      </div>
      <div className="shrink-0 p-2 border-t border-brand-border flex gap-2 bg-brand-charcoal/80">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void sendChat()}
          placeholder="Ask the bookkeeper…"
          className="flex-1 bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-sm text-white focus:border-brand-gold outline-none"
        />
        <button
          type="button"
          onClick={() => void sendChat()}
          disabled={chatPending}
          className="px-3 py-2 rounded-lg bg-brand-gold text-brand-black text-xs font-mono uppercase font-bold disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full px-4 py-4 lg:px-6 lg:py-5">
      <header className="shrink-0 mb-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-gold">
          Bookkeeper IDE
        </p>
        <h1 className="text-lg sm:text-xl font-medium text-white mt-0.5">
          Files · Notes · Receipts
        </h1>
        <p className="text-[10px] sm:text-xs text-brand-gray mt-0.5">
          Live Q-/E-/I- register · vault filing · receipt vision
        </p>
      </header>

      {error ? (
        <p className="shrink-0 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-2">
          {error}
        </p>
      ) : null}

      {/* Mobile tabs */}
      <div className="shrink-0 lg:hidden flex gap-1 p-1 rounded-xl bg-brand-panel border border-brand-border mb-2">
        {(
          [
            ["files", PanelLeft, "Files"],
            ["editor", FileText, "Editor"],
            ["chat", MessageSquare, "AI"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobilePane(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider ${
              mobilePane === id ? "bg-brand-gold text-brand-black" : "text-brand-gray"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="hidden lg:grid lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        <div className="lg:col-span-3 min-h-0 flex flex-col">{fileTreePanel}</div>
        <div className="lg:col-span-5 min-h-0 flex flex-col">{editorPanel}</div>
        <div className="lg:col-span-4 min-h-0 flex flex-col">{chatPanel}</div>
      </div>

      <div className="lg:hidden flex-1 min-h-0 overflow-hidden">
        {mobilePane === "files" ? fileTreePanel : null}
        {mobilePane === "editor" ? editorPanel : null}
        {mobilePane === "chat" ? chatPanel : null}
      </div>
    </div>
  );
}
