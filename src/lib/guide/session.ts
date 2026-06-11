import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { GUIDE_COOKIE_NAME, GUIDE_SESSION_TTL_SECONDS } from "./constants";

export interface GuideSessionPayload {
  sub: "guide";
  email: string;
  subscriberId: string;
  guideSlug: string;
  iat: number;
  exp: number;
}

const DEV_SESSION_SECRET = "black-timber-guide-dev-only-secret";

function resolveSessionSecret(): string {
  const configured =
    process.env.GUIDE_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? "";
  if (configured.length >= 16) return configured;
  if (process.env.NODE_ENV === "development") return DEV_SESSION_SECRET;
  return "";
}

function getSecret(): Buffer {
  const secret = resolveSessionSecret();
  if (secret.length < 16) {
    throw new Error("GUIDE_SESSION_SECRET or ADMIN_SESSION_SECRET (16+ chars) required.");
  }
  return Buffer.from(secret, "utf8");
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

function sign(payload: GuideSessionPayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = base64url(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

function verify(token: string): GuideSessionPayload | null {
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
  let payload: GuideSessionPayload;
  try {
    payload = JSON.parse(fromBase64url(body).toString("utf8")) as GuideSessionPayload;
  } catch {
    return null;
  }
  if (payload.sub !== "guide") return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  return payload;
}

export async function createGuideSession(input: {
  email: string;
  subscriberId: string;
  guideSlug: string;
}): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const payload: GuideSessionPayload = {
    sub: "guide",
    email: input.email.toLowerCase(),
    subscriberId: input.subscriberId,
    guideSlug: input.guideSlug,
    iat: now,
    exp: now + GUIDE_SESSION_TTL_SECONDS,
  };
  const jar = await cookies();
  jar.set(GUIDE_COOKIE_NAME, sign(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/guide",
    maxAge: GUIDE_SESSION_TTL_SECONDS,
  });
}

export async function getGuideSession(): Promise<GuideSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(GUIDE_COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

export async function clearGuideSession(): Promise<void> {
  const jar = await cookies();
  jar.set(GUIDE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/guide",
    maxAge: 0,
  });
}

export function isGuideSessionConfigured(): boolean {
  return resolveSessionSecret().length >= 16;
}
