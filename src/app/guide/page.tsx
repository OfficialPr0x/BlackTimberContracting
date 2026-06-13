import { getGuideSession } from "@/lib/guide/session";
import { loadGuideMarkdown } from "@/lib/guide/load-content";
import { getGuideHeadings } from "@/lib/guide/toc";
import GuideLoginForm from "@/components/guide/GuideLoginForm";
import FieldGuideView from "@/components/guide/FieldGuideView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kootenay Field Guide | Black Timber Contracting",
  robots: { index: false, follow: false },
};

export default async function GuidePage() {
  const session = await getGuideSession();

  if (!session) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center p-6">
        <GuideLoginForm />
      </div>
    );
  }

  const markdown = await loadGuideMarkdown();
  const headings = getGuideHeadings(markdown);

  return (
    <FieldGuideView
      markdown={markdown}
      subscriberEmail={session.email}
      headings={headings}
    />
  );
}
