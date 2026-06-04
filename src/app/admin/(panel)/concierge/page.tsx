import type { Metadata } from "next";
import AdminChat from "@/components/admin/AdminChat";

export const metadata: Metadata = {
  title: "Concierge · Black Timber Admin",
  robots: { index: false, follow: false },
};

export default function AdminConciergePage() {
  return (
    <AdminChat
      apiPath="/api/admin/concierge"
      title="Ops Concierge"
      subtitle="Your internal assistant — type or use the mic (OpenAI Whisper). Quotes, suppliers, scheduling, customer drafts."
      openingLines={[
        "Ask how to run the business day-to-day, draft a follow-up text, or think through a job.",
        "Hold the mic button to dictate — I'll transcribe with Whisper, then reply.",
        "For line items on a quote, use Quotes → Talk to AI (⌘K) with screenshots.",
      ]}
      voice
      placeholder="Type or dictate your question…"
    />
  );
}
