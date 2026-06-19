import "server-only";

import {
  notifyOwnerSent,
  notifyOwnerSigned,
  notifyOwnerViewed,
  notifySignerToSign,
} from "./emails";
import { insertEsignEmailEvent } from "./repository";
import type { EsignEnvelopeRow } from "./types";

export async function deliverEsignSentNotifications(
  envelope: EsignEnvelopeRow,
  slug: string
): Promise<string[]> {
  const errors: string[] = [];
  try {
    await notifySignerToSign(envelope, slug);
  } catch (e) {
    errors.push(`signer: ${(e as Error).message}`);
    await insertEsignEmailEvent(envelope.id, "email_failed", {
      target: "signer",
      error: (e as Error).message,
    });
  }
  try {
    await notifyOwnerSent(envelope);
  } catch (e) {
    errors.push(`owner: ${(e as Error).message}`);
  }
  return errors;
}

export async function deliverEsignViewedNotification(
  envelope: EsignEnvelopeRow
): Promise<void> {
  try {
    await notifyOwnerViewed(envelope);
  } catch (e) {
    console.error("[esign viewed email]", (e as Error).message);
  }
}

export async function deliverEsignSignedNotifications(
  envelope: EsignEnvelopeRow
): Promise<void> {
  try {
    await notifyOwnerSigned(envelope);
  } catch (e) {
    console.error("[esign signed email]", (e as Error).message);
  }
}
