/**
 * Tiny structured logger for AI calls + lead events. Console-only for now so
 * it works locally + on Vercel without extra setup. When you're ready to ship
 * logs to Datadog / Logflare / Axiom, replace the `emit()` body with their
 * SDK call — the call sites won't change.
 *
 * Format choice: NDJSON one-line records so they're greppable + ingestable.
 */

type AiTask = "quote" | "intel" | "sketch" | "explain" | "chat" | "fallback" | string;

export interface AiCallLog {
  task: AiTask;
  model: string;
  schemaName?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUSD?: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface LeadLog {
  source: string;
  email: string;
  delivered: { file: boolean; email: boolean; slack: boolean };
  errors?: string[];
}

function emit(level: "info" | "warn" | "error", kind: string, payload: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    kind,
    ...payload,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logAiCall(log: AiCallLog): void {
  emit(log.ok ? "info" : "error", "ai_call", log);
}

export function logLead(log: LeadLog): void {
  const anyFailed = (log.errors?.length ?? 0) > 0;
  emit(anyFailed ? "warn" : "info", "lead", log);
}
