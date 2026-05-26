/**
 * Typed errors used across the AI integration. Every error carries:
 *   - `code`     stable string identifier (safe to switch on / log)
 *   - `status`   HTTP status to bubble back to the client
 *   - `clientMessage` short string safe to render in the UI (no internals)
 *   - `cause`    underlying error / context (server logs only — never serialized)
 *
 * Centralizing this means every route can do:
 *     return errorResponse(err)
 * and clients get a consistent JSON shape: { error: { code, message } }.
 */

export type AiErrorCode =
  | "missing_api_key"
  | "rate_limited"
  | "cost_cap_exceeded"
  | "invalid_input"
  | "upstream_failed"
  | "upstream_timeout"
  | "schema_violation"
  | "internal";

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  readonly clientMessage: string;
  readonly cause?: unknown;

  constructor(args: {
    code: AiErrorCode;
    status: number;
    clientMessage: string;
    message?: string;
    cause?: unknown;
  }) {
    super(args.message ?? args.clientMessage);
    this.code = args.code;
    this.status = args.status;
    this.clientMessage = args.clientMessage;
    this.cause = args.cause;
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AiError) {
    return Response.json(
      { error: { code: err.code, message: err.clientMessage } },
      { status: err.status }
    );
  }
  // Unknown error — log internals, return a generic message.
  console.error("[ai] unexpected error", err);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong on our end. Please try again in a moment." } },
    { status: 500 }
  );
}
