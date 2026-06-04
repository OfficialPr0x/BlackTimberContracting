"use client";

import BrandedDocument from "@/components/admin/BrandedDocument";
import Markdown from "@/components/Markdown";
import type { BusinessProfile } from "@/lib/business-config";
import type { EsignDocumentSnapshot } from "@/lib/esign/types";

export default function SignDocumentBody({
  snapshot,
  business,
}: {
  snapshot: EsignDocumentSnapshot;
  business: BusinessProfile;
}) {
  if (snapshot.kind === "quote") {
    return (
      <div className="rounded-lg overflow-hidden shadow-lg">
        <BrandedDocument quote={snapshot.quote} business={business} />
      </div>
    );
  }
  if (snapshot.kind === "markdown") {
    return (
      <article className="rounded-lg bg-white text-[#1a1816] p-6 sm:p-8 prose max-w-none">
        <h1 className="text-lg font-semibold mb-4">{snapshot.title}</h1>
        <Markdown>{snapshot.content}</Markdown>
      </article>
    );
  }
  return (
    <article
      className="rounded-lg bg-white text-[#1a1816] p-6 prose max-w-none"
      dangerouslySetInnerHTML={{ __html: snapshot.html }}
    />
  );
}
