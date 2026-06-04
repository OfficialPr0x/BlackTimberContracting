/**
 * Client-side helpers for Cmd+K image attachments (screenshots, texts, etc.).
 */

export const MAX_PARSE_IMAGES = 6;
export const MAX_PARSE_IMAGE_BYTES = 4_000_000;

export interface ParseImageAttachment {
  id: string;
  name: string;
  url: string;
}

function newId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Resize large photos so JSON payloads stay under OpenRouter limits. */
export async function fileToParseImageDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported.");
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  let { width, height } = bitmap;
  if (width > maxSide || height > maxSide) {
    const scale = maxSide / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process image.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // JPEG keeps screenshots smaller; PNG if already small and PNG source.
  const usePng = file.type === "image/png" && file.size < 900_000;
  let quality = 0.88;
  let dataUrl = usePng
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > MAX_PARSE_IMAGE_BYTES && quality > 0.45 && !usePng) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > MAX_PARSE_IMAGE_BYTES) {
    throw new Error("Image is too large after compression. Try a smaller screenshot.");
  }

  return dataUrl;
}

export async function filesToParseAttachments(
  files: File[],
  existingCount: number
): Promise<ParseImageAttachment[]> {
  const room = MAX_PARSE_IMAGES - existingCount;
  if (room <= 0) return [];

  const out: ParseImageAttachment[] = [];
  for (const file of files.slice(0, room)) {
    const url = await fileToParseImageDataUrl(file);
    out.push({ id: newId(), name: file.name, url });
  }
  return out;
}
