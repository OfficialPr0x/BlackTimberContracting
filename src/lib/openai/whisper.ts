/**
 * OpenAI Whisper transcription (admin voice input).
 * Requires OPENAI_API_KEY — separate from OpenRouter.
 */

import { AiError } from "@/lib/openrouter/errors";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_BYTES = 12 * 1024 * 1024;

export async function transcribeAudio(file: File): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new AiError({
      code: "missing_api_key",
      status: 503,
      clientMessage:
        "Voice input needs OPENAI_API_KEY in Vercel / .env.local (OpenAI Whisper).",
      message: "OPENAI_API_KEY not set",
    });
  }

  if (file.size > MAX_BYTES) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "Recording is too large. Keep it under about 2 minutes.",
      message: `Audio ${file.size} bytes exceeds cap`,
    });
  }

  const body = new FormData();
  body.append("file", file, file.name || "recording.webm");
  body.append("model", "whisper-1");
  body.append("language", "en");

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };

  if (!res.ok) {
    throw new AiError({
      code: "upstream_failed",
      status: 502,
      clientMessage: json.error?.message ?? "Could not transcribe audio. Try typing instead.",
      message: `Whisper ${res.status}: ${json.error?.message ?? "unknown"}`,
    });
  }

  const text = json.text?.trim() ?? "";
  if (text.length < 1) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage: "Couldn't hear anything. Try again closer to the mic.",
      message: "Empty transcription",
    });
  }

  return text;
}
