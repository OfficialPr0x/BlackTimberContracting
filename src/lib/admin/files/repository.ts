import "server-only";

import { AiError } from "@/lib/openrouter/errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { FileNodeDetail, FileNodeRow } from "./types";

const BUCKET = "btc-admin-files";
const SIGNED_URL_TTL_SEC = 3600;

function requireSb() {
  if (!isSupabaseConfigured()) {
    throw new AiError({
      code: "internal",
      status: 503,
      clientMessage:
        "File vault needs Supabase. Add SUPABASE_SECRET_KEY and run supabase/files-schema.sql.",
      message: "Supabase not configured for files",
    });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new AiError({
      code: "internal",
      status: 503,
      clientMessage: "Database client unavailable.",
      message: "Supabase admin null",
    });
  }
  return sb;
}

export async function listFileNodes(): Promise<FileNodeRow[]> {
  const sb = requireSb();
  const { data, error } = await sb.rpc("list_file_nodes");
  if (error) {
    console.error("[list_file_nodes]", error.message);
    return [];
  }
  const raw = data ?? [];
  return (Array.isArray(raw) ? raw : []) as FileNodeRow[];
}

export async function createFolder(
  name: string,
  parentId: string | null
): Promise<FileNodeRow> {
  const sb = requireSb();
  const trimmed = name.trim();
  if (trimmed.length < 1) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "Folder name is required.",
    });
  }

  const { data, error } = await sb
    .from("file_nodes")
    .insert({ kind: "folder", name: trimmed, parent_id: parentId })
    .select("id, parent_id, kind, name, mime_type, size_bytes, text_content, updated_at")
    .single();

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: error.message.includes("unique") ? "A folder with that name already exists here." : "Could not create folder.",
      message: error.message,
    });
  }

  return rowToSummary(data);
}

export async function uploadFile(params: {
  parentId: string | null;
  name: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<FileNodeRow> {
  const sb = requireSb();
  const name = params.name.trim() || "upload";
  const id = crypto.randomUUID();
  const storagePath = `${id}/${sanitizeStorageName(name)}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, params.bytes, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (upErr) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Upload to storage failed. Check the btc-admin-files bucket exists.",
      message: upErr.message,
    });
  }

  const { data, error } = await sb
    .from("file_nodes")
    .insert({
      id,
      kind: "file",
      name,
      parent_id: params.parentId,
      storage_path: storagePath,
      mime_type: params.mimeType,
      size_bytes: params.bytes.length,
    })
    .select("id, parent_id, kind, name, mime_type, size_bytes, text_content, updated_at")
    .single();

  if (error) {
    await sb.storage.from(BUCKET).remove([storagePath]);
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not save file record.",
      message: error.message,
    });
  }

  return rowToSummary(data);
}

export async function createMarkdownFile(
  name: string,
  parentId: string | null,
  content = ""
): Promise<FileNodeRow> {
  const sb = requireSb();
  const fileName = name.endsWith(".md") ? name : `${name}.md`;
  const { data, error } = await sb
    .from("file_nodes")
    .insert({
      kind: "file",
      name: fileName,
      parent_id: parentId,
      mime_type: "text/markdown",
      text_content: content,
      size_bytes: Buffer.byteLength(content, "utf8"),
    })
    .select("id, parent_id, kind, name, mime_type, size_bytes, text_content, updated_at")
    .single();

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not create note.",
      message: error.message,
    });
  }
  return rowToSummary(data);
}

export async function getFileNode(id: string): Promise<FileNodeDetail | null> {
  const sb = requireSb();
  const { data, error } = await sb
    .from("file_nodes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  let downloadUrl: string | null = null;
  if (data.storage_path) {
    const { data: signed } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(data.storage_path, SIGNED_URL_TTL_SEC);
    downloadUrl = signed?.signedUrl ?? null;
  }

  return {
    ...rowToSummary(data),
    textContent: data.text_content ?? null,
    storagePath: data.storage_path ?? null,
    downloadUrl,
  };
}

export async function updateMarkdownContent(id: string, content: string): Promise<void> {
  const sb = requireSb();
  const { error } = await sb
    .from("file_nodes")
    .update({
      text_content: content,
      size_bytes: Buffer.byteLength(content, "utf8"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("kind", "file");

  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not save file.",
      message: error.message,
    });
  }
}

export async function deleteFileNode(id: string): Promise<void> {
  const sb = requireSb();
  const { data } = await sb.from("file_nodes").select("kind, storage_path").eq("id", id).maybeSingle();
  if (!data) return;

  if (data.kind === "file" && data.storage_path) {
    await sb.storage.from(BUCKET).remove([data.storage_path]);
  }

  const { error } = await sb.from("file_nodes").delete().eq("id", id);
  if (error) {
    throw new AiError({
      code: "internal",
      status: 500,
      clientMessage: "Could not delete.",
      message: error.message,
    });
  }
}

export async function downloadFileBytes(id: string): Promise<Buffer | null> {
  const sb = requireSb();
  const { data } = await sb.from("file_nodes").select("storage_path").eq("id", id).maybeSingle();
  if (!data?.storage_path) return null;

  const { data: blob, error } = await sb.storage.from(BUCKET).download(data.storage_path);
  if (error || !blob) return null;
  return Buffer.from(await blob.arrayBuffer());
}

function sanitizeStorageName(name: string): string {
  return name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
}

function rowToSummary(row: {
  id: string;
  parent_id: string | null;
  kind: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  text_content?: string | null;
  updated_at: string;
}): FileNodeRow {
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind as FileNodeRow["kind"],
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    hasText: row.text_content != null && row.text_content.length > 0,
    updatedAt: row.updated_at,
  };
}
