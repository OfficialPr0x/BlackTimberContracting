import FieldGuideFunnel from "@/components/guide/FieldGuideFunnel";
import { fieldGuideJsonLd, fieldGuideMetadata } from "@/lib/guide/funnel-seo";

export const metadata = fieldGuideMetadata();

export default function FieldGuideLandingPage() {
  const jsonLd = fieldGuideJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FieldGuideFunnel />
    </>
  );
}
