import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { GUIDE_SLUG } from "./constants";
import type { CreateGuideSubscriberResult, GuideSubscriberRow } from "./types";
import { verifyGuidePassword } from "./password";

const FILE_PATH = process.env.GUIDE_SUBSCRIBERS_FILE ?? "./.data/guide-subscribers.json";

interface StoredSubscriber {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  guideSlug: string;
  leadId: string | null;
  welcomeEmailSent: boolean;
  welcomeEmailError: string | null;
  createdAt: string;
  updatedAt: string;
}

type StoreFile = Record<string, StoredSubscriber>;

function storeKey(email: string, guideSlug: string): string {
  return `${guideSlug}:${email.trim().toLowerCase()}`;
}

async function readStore(): Promise<StoreFile> {
  const abs = path.resolve(/* turbopackIgnore: true */ process.cwd(), FILE_PATH);
  try {
    const raw = await fs.readFile(abs, "utf8");
    return JSON.parse(raw) as StoreFile;
  } catch {
    return {};
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  const abs = path.resolve(/* turbopackIgnore: true */ process.cwd(), FILE_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(store, null, 2), "utf8");
}

function toRow(stored: StoredSubscriber): GuideSubscriberRow {
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    passwordHash: stored.passwordHash,
    guideSlug: stored.guideSlug,
    leadId: stored.leadId,
    welcomeEmailSent: stored.welcomeEmailSent,
    welcomeEmailError: stored.welcomeEmailError,
    createdAt: stored.createdAt,
  };
}

export async function fileUpsertGuideSubscriber(input: {
  name: string;
  email: string;
  leadId?: string | null;
  password: string;
  passwordHash: string;
}): Promise<CreateGuideSubscriberResult> {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const store = await readStore();
  const key = storeKey(email, GUIDE_SLUG);
  const existing = store[key];
  const isNew = !existing;

  store[key] = {
    id: existing?.id ?? randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash: input.passwordHash,
    guideSlug: GUIDE_SLUG,
    leadId: input.leadId ?? null,
    welcomeEmailSent: false,
    welcomeEmailError: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeStore(store);

  return {
    subscriberId: store[key].id,
    password: input.password,
    email,
    name: store[key].name,
    isNew,
  };
}

export async function fileVerifyGuideSubscriber(
  email: string,
  password: string
): Promise<GuideSubscriberRow | null> {
  const store = await readStore();
  const stored = store[storeKey(email, GUIDE_SLUG)];
  if (!stored) return null;
  if (!verifyGuidePassword(password, stored.passwordHash)) return null;
  return toRow(stored);
}

export async function fileMarkWelcomeEmailSent(
  subscriberId: string,
  ok: boolean,
  errMsg?: string
): Promise<void> {
  const store = await readStore();
  const entry = Object.entries(store).find(([, s]) => s.id === subscriberId);
  if (!entry) return;
  const [key, stored] = entry;
  store[key] = {
    ...stored,
    welcomeEmailSent: ok,
    welcomeEmailError: ok ? null : (errMsg ?? "send failed"),
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
}

export async function fileListGuideSubscribers(limit = 200): Promise<GuideSubscriberRow[]> {
  const store = await readStore();
  return Object.values(store)
    .filter((s) => s.guideSlug === GUIDE_SLUG)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(toRow);
}
