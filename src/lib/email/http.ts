/**
 * Shared JSON error response for email API routes.
 * Mirrors the { error: { code, message } } shape used elsewhere.
 */

import { EmailRepoError } from "./repository";

export function emailErrorResponse(err: unknown): Response {
  if (err instanceof EmailRepoError) {
    return Response.json(
      { error: { code: err.status >= 500 ? "internal" : "invalid_input", message: err.message } },
      { status: err.status }
    );
  }
  if (err instanceof Error && /RESEND_API_KEY|RESEND_WEBHOOK_SECRET/.test(err.message)) {
    return Response.json(
      { error: { code: "missing_api_key", message: err.message } },
      { status: 503 }
    );
  }
  console.error("[email] unexpected error", err);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong handling that email request." } },
    { status: 500 }
  );
}
