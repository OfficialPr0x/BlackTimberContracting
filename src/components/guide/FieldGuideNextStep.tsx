import { Phone, MessageSquare, ClipboardCheck, ArrowRight, MapPin } from "lucide-react";

const PHONE_DISPLAY = "250-910-9071";
const PHONE_TEL = "+12509109071";

const WALKTHROUGH_BENEFITS = [
  "Identify hidden issues before they cost you",
  "Prioritize the repairs that matter most",
  "Build a realistic, honest budget",
  "Understand your permit requirements",
  "Plan your project timeline around Kootenay seasons",
];

export default function FieldGuideNextStep() {
  return (
    <section className="bg-[#0b0a09] text-white print:hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
        <div className="text-center mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-[#c5a880] mb-3">
            Your next step
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight leading-tight">
            Book a Free Black Timber Walkthrough
          </h2>
          <p className="text-sm text-white/65 mt-4 max-w-xl mx-auto leading-relaxed">
            You&apos;ve got the knowledge. Now let&apos;s apply it to your home. A walkthrough is free,
            honest, and zero-pressure — whether you build with us or not.
          </p>
        </div>

        {/* Progression: Guide → AI → Walkthrough → Quote → Job */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 text-[10px] font-mono uppercase tracking-widest">
          {["Field Guide", "Ask our AI", "Walkthrough", "Quote", "Your build"].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span
                className={
                  i === 0
                    ? "px-2.5 py-1 rounded-full border border-[#c5a880]/40 text-[#c5a880]"
                    : "px-2.5 py-1 rounded-full border border-white/15 text-white/60"
                }
              >
                {step}
              </span>
              {i < arr.length - 1 ? <ArrowRight className="w-3 h-3 text-white/30" /> : null}
            </span>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-10">
          {WALKTHROUGH_BENEFITS.map((b) => (
            <div
              key={b}
              className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <ClipboardCheck className="w-4 h-4 text-[#c5a880] shrink-0 mt-0.5" />
              <span className="text-[13px] text-white/85 leading-snug">{b}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 max-w-2xl mx-auto">
          <a
            href={`tel:${PHONE_TEL}`}
            className="flex-1 inline-flex items-center justify-center gap-2 py-4 bg-[#c5a880] hover:bg-[#b39359] text-[#0b0a09] font-extrabold uppercase tracking-widest text-xs rounded-xl transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call {PHONE_DISPLAY}
          </a>
          <a
            href="/#interactive-suite"
            className="flex-1 inline-flex items-center justify-center gap-2 py-4 border border-[#c5a880]/40 hover:border-[#c5a880] text-[#c5a880] font-bold uppercase tracking-widest text-xs rounded-xl transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            Start a free quote
          </a>
        </div>

        <p className="flex items-center justify-center gap-2 text-[11px] text-white/45 mt-6 text-center">
          <MessageSquare className="w-3.5 h-3.5 text-[#c5a880]" />
          Quick question? Tap{" "}
          <span className="text-[#c5a880] font-semibold">Ask Black Timber AI</span> (bottom-right)
          for an instant answer.
        </p>

        <p className="flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/40 mt-8">
          <MapPin className="w-3 h-3 text-[#c5a880]" />
          Fernie · Sparwood · Elkford · Cranbrook · Nelson
        </p>
      </div>
    </section>
  );
}
