/**
 * Lightweight rules-based classification for inbound mail.
 *
 * Resend does NOT classify mail (no spam/promotions detection), so we do a
 * cheap first-pass here: assign a Gmail-style category tab and optionally route
 * obvious bulk mail to Spam. This is intentionally conservative — it only acts
 * on strong signals. A `email.complained` webhook is the authoritative spam
 * signal and is handled in the webhook route, not here.
 */

import type { EmailCategory, EmailFolder } from "./types";

export interface ClassifyInput {
  fromAddress: string;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  headers?: Record<string, string> | null;
}

export interface Classification {
  category: EmailCategory;
  folder: EmailFolder;
}

const PROMO_SENDERS = [
  "newsletter", "no-reply", "noreply", "donotreply", "do-not-reply",
  "marketing", "promo", "offers", "deals", "sales@", "info@mailchimp",
  "news@", "updates@",
];

const SOCIAL_DOMAINS = [
  "facebookmail.com", "facebook.com", "linkedin.com", "twitter.com",
  "x.com", "instagram.com", "youtube.com", "tiktok.com", "nextdoor.com",
];

const UPDATE_SENDERS = [
  "receipt", "invoice", "billing", "statement", "notification",
  "notifications", "alert", "security", "account", "confirm",
];

const FORUM_HINTS = ["forum", "discourse", "group", "list-", "mailing"];

const PROMO_KEYWORDS = [
  "unsubscribe", "% off", "sale", "limited time", "discount", "coupon",
  "free shipping", "shop now", "deal of",
];

export function classifyInbound(input: ClassifyInput): Classification {
  const from = input.fromAddress.toLowerCase();
  const domain = from.split("@")[1] ?? "";
  const subject = (input.subject ?? "").toLowerCase();
  const body = (input.bodyText ?? "").toLowerCase();
  const headers = input.headers ?? {};

  const hasListUnsub =
    "list-unsubscribe" in headers ||
    Object.keys(headers).some((k) => k.toLowerCase() === "list-unsubscribe");
  const isBulk =
    headers["precedence"]?.toLowerCase() === "bulk" ||
    Object.entries(headers).some(
      ([k, v]) => k.toLowerCase() === "precedence" && v?.toLowerCase() === "bulk"
    );

  // Social networks
  if (SOCIAL_DOMAINS.some((d) => domain.endsWith(d))) {
    return { category: "social", folder: "inbox" };
  }

  // Forums / mailing lists
  if (
    FORUM_HINTS.some((h) => from.includes(h)) ||
    Object.keys(headers).some((k) => k.toLowerCase() === "list-id")
  ) {
    return { category: "forums", folder: "inbox" };
  }

  // Promotions — strong bulk + marketing signals
  const promoSender = PROMO_SENDERS.some((p) => from.includes(p));
  const promoKeyword = PROMO_KEYWORDS.some(
    (k) => subject.includes(k) || body.includes(k)
  );
  if ((hasListUnsub || isBulk) && (promoSender || promoKeyword)) {
    return { category: "promotions", folder: "inbox" };
  }
  if (promoSender && promoKeyword) {
    return { category: "promotions", folder: "inbox" };
  }

  // Transactional updates (receipts, security alerts, etc.)
  if (UPDATE_SENDERS.some((u) => from.includes(u))) {
    return { category: "updates", folder: "inbox" };
  }

  return { category: "primary", folder: "inbox" };
}
