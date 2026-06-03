/**
 * Edge proxy (Next.js 16 — formerly known as middleware).
 *
 * The ONE job of this file is an optimistic redirect: if a request hits
 * `/admin/*` without a session cookie, send the browser to `/admin/login`.
 *
 * What this is NOT:
 *   - This is NOT the authorization gate. The Next.js auth guide explicitly
 *     warns that proxy logic is "optimistic only" and can be bypassed if
 *     callers reach the underlying route a different way (server functions,
 *     direct route handler hits, etc.). Every admin route handler and
 *     server page in this app re-verifies the cookie via `getAdminSession()`
 *     before doing anything sensitive.
 *   - This file does NOT verify the cookie's signature. We can't safely call
 *     `node:crypto` HMAC verification here without making the proxy heavier
 *     than it needs to be, and a forged cookie would still be rejected by
 *     `getAdminSession()` downstream — so the worst case is the user reaches
 *     a "Sign in first" 401 instead of being redirected.
 *
 * Excluded paths:
 *   - `/admin/login` is left open so unauthenticated users can actually
 *     reach the login form.
 *   - The matcher only runs on `/admin/*`, so /api routes are unaffected;
 *     each admin API route handles its own 401 response.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/admin/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Don't intercept the login page itself, or its sub-routes (none today,
  // but leaving the door open for /admin/login/forgot etc.).
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  // Optimistic check: if no session cookie at all, redirect to /admin/login.
  // We deliberately skip cryptographic verification here — see header comment.
  const hasCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    // Preserve where they were headed so login can bounce them back.
    if (pathname !== "/admin") {
      url.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run only on /admin and below. /api/admin/* re-verifies inside each handler.
  matcher: ["/admin/:path*"],
};
