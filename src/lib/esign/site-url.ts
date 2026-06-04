import "server-only";

import { getBusinessProfile } from "@/lib/business-config";

/** Canonical origin for sign links in emails (no trailing slash). */
export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  const domain = getBusinessProfile().domain;
  if (domain && !domain.includes("localhost")) {
    return `https://www.${domain.replace(/^www\./, "")}`;
  }

  return "http://localhost:3000";
}

export function signPortalUrl(token: string): string {
  return `${getSiteOrigin()}/sign/${token}`;
}
