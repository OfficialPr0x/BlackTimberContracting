import "server-only";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return !!key && !key.includes("xxxx");
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

/**
 * Direct Google Gemini API — used for portfolio vision brief (optional).
 * Set GEMINI_API_KEY from https://aistudio.google.com/apikey
 */
export async function geminiGenerate(params: {
  systemInstruction: string;
  userText: string;
  imageBase64?: Array<{ mimeType: string; data: string }>;
  temperature?: number;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const parts: GeminiPart[] = [{ text: params.userText }];
  for (const img of params.imageBase64 ?? []) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  }

  const url = `${GEMINI_BASE}/models/${geminiModel()}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.systemInstruction }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text?.trim()) throw new Error("Gemini returned empty response");
  return text.trim();
}
