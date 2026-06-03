/**
 * Admin session — single-user, password-gated, HMAC-signed cookie.
 *
 * Why HMAC + cookie (not a real auth provider, not JWT lib):
 *   - Black Timber is a one-person business. NextAuth / Clerk would be
 *     overkill, and adding a JWT dependency just to sign 200 bytes is silly.
 *   - HMAC-SHA256 over a JSON payload is well-understood, audit-friendly, and
 *     uses only `node:crypto`. No new packages.
 *   - Cookie is HttpOnly, Secure, SameSite=Lax, with a server-side expiry
 *     embedded in the payload AND on the cookie itself (defense in depth —
 *     if the cookie expiry is tampered with client-side, the payload expiry
 *     still rejects).
 *
 * IMPORTANT (per the Next.js 16 auth guide): the proxy.ts redirect is
 * "optimistic only". Every admin route handler and server page MUST also
 * call `getSession()` to verify the cookie cryptographically before
 * trusting the request.
 *
 * Required env vars (admin is disabled if either is missing):
 *   ADMIN_PASSWORD          plaintext password for /admin/login.
 *   ADMIN_SESSION_SECRET    32+ char random string used as the HMAC key.
 *                           Rotate to immediately invalidate every session.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "./constants";

export { SESSION_COOKIE_NAME };

/** Default lifetime: 12h. Quote-builder sessions are short by design — */
/** no "stay logged in for a month" — because the cookie carries write power. */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionPayload {
  /** Subject — always "admin" today; reserved for future multi-user. */
  sub: "admin";
  /** Issued-at unix seconds. */
  iat: number;
  /** Expires-at unix seconds. */
  exp: number;
}

export interface AdminConfigStatus {
  configured: boolean;
  /** True iff ADMIN_PASSWORD is missing. */
  missingPassword: boolean;
  /** True iff ADMIN_SESSION_SECRET is missing or shorter than 16 chars. */
  missingSecret: boolean;
}

// -----------------------------------------------------------------------------
// Configuration check
// -----------------------------------------------------------------------------

/**
 * Returns whether ADMIN_PASSWORD and ADMIN_SESSION_SECRET are both set
 * sufficiently. Routes / pages should refuse to authenticate when this is
 * false rather than silently using a weak default.
 */
export function getAdminConfigStatus(): AdminConfigStatus {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const missingPassword = password.length === 0;
  const missingSecret = secret.length < 16;
  return {
    configured: !missingPassword && !missingSecret,
    missingPassword,
    missingSecret,
  };
}

function getSecret(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (secret.length < 16) {
    // Hard error — every caller that reaches here has already verified
    // configuration, so this means the env was changed mid-flight.
    throw new Error(
      "ADMIN_SESSION_SECRET must be at least 16 characters. Refusing to sign or verify."
    );
  }
  return Buffer.from(secret, "utf8");
}

// -----------------------------------------------------------------------------
// Password verification
// -----------------------------------------------------------------------------

/**
 * Constant-time compare of submitted password against ADMIN_PASSWORD. Returns
 * false if the env var is missing or the lengths differ — `timingSafeEqual`
 * requires equal-length buffers, so we do the length check up front and still
 * burn the same CPU on the comparison either way.
 */
export function verifyAdminPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (expected.length === 0) return false;
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Still do a dummy compare so timing leaks don't reveal length info.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

// -----------------------------------------------------------------------------
// Sign / verify token
// -----------------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

function sign(payload: SessionPayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = base64url(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Verify token shape, signature, and expiry. Returns the payload on success
 * or `null` on any failure. Never throws on bad input.
 */
function verify(token: string): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expectedSig: Buffer;
  try {
    expectedSig = createHmac("sha256", getSecret()).update(body).digest();
  } catch {
    return null;
  }
  const providedSig = fromBase64url(sig);
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromBase64url(body).toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
  if (payload.sub !== "admin") return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (typeof payload.iat !== "number" || payload.iat > now + 60) return null;
  return payload;
}

// -----------------------------------------------------------------------------
// Cookie helpers (server-only — call from server actions / route handlers /
// server components, NOT from proxy.ts)
// -----------------------------------------------------------------------------

/**
 * Mint a fresh session cookie. Caller is expected to be in a server action or
 * route handler that has already verified the password.
 */
export async function createAdminSession(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: "admin",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const token = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(payload.exp * 1000),
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Read + verify the current session. Returns null when no cookie, bad
 * signature, expired, or admin not configured. NEVER throws.
 *
 * This is the function every admin route/page should call before doing
 * anything sensitive. The proxy.ts redirect is just UX, not authorization.
 */
export async function getAdminSession(): Promise<SessionPayload | null> {
  if (!getAdminConfigStatus().configured) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

/**
 * Throwing variant for use inside route handlers. Returns the payload on
 * success or builds a 401 Response (which the caller can return directly).
 */
export async function requireAdminRoute(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: Response }
> {
  const status = getAdminConfigStatus();
  if (!status.configured) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            code: "admin_not_configured",
            message:
              "Admin is disabled. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET (16+ chars) in .env.local and restart the server.",
          },
        },
        { status: 503 }
      ),
    };
  }
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: { code: "unauthorized", message: "Sign in at /admin/login first." } },
        { status: 401 }
      ),
    };
  }
  return { ok: true, session };
}
