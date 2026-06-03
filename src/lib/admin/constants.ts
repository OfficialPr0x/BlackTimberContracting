/**
 * Tiny constants module for the admin area.
 *
 * Lives separately from `session.ts` because `session.ts` is `server-only`
 * (it depends on `next/headers` and `node:crypto`), and we want both the
 * server-only modules AND `src/proxy.ts` to share these constants without
 * dragging the heavier session module into the proxy bundle.
 */

/** Name of the HMAC-signed admin session cookie. */
export const SESSION_COOKIE_NAME = "bt_admin_session";
