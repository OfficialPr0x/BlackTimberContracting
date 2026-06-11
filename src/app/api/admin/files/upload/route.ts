import { errorResponse, AiError } from "@/lib/openrouter/errors";
import { requireAdminRoute } from "@/lib/admin/session";
import { uploadFile } from "@/lib/admin/files/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export async function POST(req: Request) {
  try {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const form = await req.formData();
    const file = form.get("file");
    const parentRaw = form.get("parentId");
    const parentId =
      typeof parentRaw === "string" && parentRaw.length > 0 ? parentRaw : null;

    if (!(file instanceof File)) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Choose a file to upload.",
      });
    }

    if (file.size > MAX_BYTES) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "File must be under 15 MB.",
      });
    }

    const mime = file.type || "application/octet-stream";
    if (!ALLOWED.has(mime) && !mime.startsWith("image/")) {
      throw new AiError({
        code: "invalid_input",
        status: 400,
        clientMessage: "Unsupported file type. Use images, PDF, markdown, CSV, or Excel.",
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const node = await uploadFile({
      parentId,
      name: file.name,
      mimeType: mime,
      bytes,
    });

    return Response.json(node);
  } catch (err) {
    return errorResponse(err);
  }
}
