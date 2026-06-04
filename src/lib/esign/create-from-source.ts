import "server-only";

import { AiError } from "@/lib/openrouter/errors";
import {
  defaultTitleFromSnapshot,
  snapshotFromQuoteId,
  snapshotFromVaultFileId,
} from "./document-snapshot";
import { createEsignEnvelope } from "./repository";
import { deliverEsignSentNotifications } from "./notify";
import type { CreateEsignInput, EsignEnvelopeDetail } from "./types";

export async function createEsignFromQuote(params: {
  documentId: string;
  signerName?: string;
  signerEmail?: string;
  signerMessage?: string;
  sendNow?: boolean;
}): Promise<{ envelope: EsignEnvelopeDetail; signToken: string; emailErrors: string[] }> {
  const snap = await snapshotFromQuoteId(params.documentId);
  if (!snap || snap.kind !== "quote") {
    throw new AiError({
      code: "invalid_input",
      status: 404,
      clientMessage: `Quote ${params.documentId} not found.`,
    });
  }

  const input: CreateEsignInput = {
    title: defaultTitleFromSnapshot(snap),
    signerName: params.signerName?.trim() || snap.quote.customer.name,
    signerEmail:
      params.signerEmail?.trim() ||
      snap.quote.customer.email?.trim() ||
      "",
    signerMessage: params.signerMessage,
    documentSnapshot: snap,
    sourceType: "quote",
    sourceRef: params.documentId,
    sendNow: false,
  };

  if (!input.signerEmail) {
    throw new AiError({
      code: "invalid_input",
      status: 400,
      clientMessage:
        "Signer email is required — add it on the quote customer or pass signerEmail.",
    });
  }

  const { envelope, signToken } = await createEsignEnvelope(input);
  let emailErrors: string[] = [];

  if (params.sendNow !== false) {
    const { sendEsignEnvelope } = await import("./repository");
    const sent = await sendEsignEnvelope(envelope.id, signToken);
    emailErrors = await deliverEsignSentNotifications(sent, signToken);
    return {
      envelope: { ...sent, signUrl: envelope.signUrl },
      signToken,
      emailErrors,
    };
  }

  return { envelope, signToken, emailErrors };
}

export async function createEsignFromVaultFile(params: {
  fileId: string;
  signerName: string;
  signerEmail: string;
  title?: string;
  sendNow?: boolean;
}): Promise<{ envelope: EsignEnvelopeDetail; signToken: string; emailErrors: string[] }> {
  const snap = await snapshotFromVaultFileId(params.fileId);
  if (!snap) {
    throw new AiError({
      code: "invalid_input",
      status: 404,
      clientMessage: "Vault file not found or has no text content.",
    });
  }

  const input: CreateEsignInput = {
    title: params.title?.trim() || defaultTitleFromSnapshot(snap),
    signerName: params.signerName,
    signerEmail: params.signerEmail,
    documentSnapshot: snap,
    sourceType: "vault_file",
    sourceRef: params.fileId,
    sendNow: false,
  };

  const { envelope, signToken } = await createEsignEnvelope(input);
  let emailErrors: string[] = [];

  if (params.sendNow !== false) {
    const { sendEsignEnvelope } = await import("./repository");
    const sent = await sendEsignEnvelope(envelope.id, signToken);
    emailErrors = await deliverEsignSentNotifications(sent, signToken);
    return { envelope: { ...sent, signUrl: envelope.signUrl }, signToken, emailErrors };
  }

  return { envelope, signToken, emailErrors };
}
