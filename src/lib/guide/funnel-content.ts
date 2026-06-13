import { GUIDE_IMAGES } from "./images";

export const GUIDE_FUNNEL_TITLE =
  "Black Timber Field Guide: The Kootenay Homeowner Project Readiness & Resilience Manual";

export const GUIDE_HERO_IMAGE = GUIDE_IMAGES[0];

export const TRUST_STRIP = [
  { label: "140+ Kootenay builds", detail: "Real jobs, not stock photos" },
  { label: "18 expert chapters", detail: "Permits to wildfire to budgeting" },
  { label: "100% free", detail: "No credit card · no sales call required" },
  { label: "Built by a licensed crew", detail: "Education first — not a bait-and-switch" },
] as const;

export const WHY_PILLARS = [
  {
    title: "We hate surprise bills as much as you do",
    body: "Most renovation pain starts before the first hammer swing — vague scopes, skipped permits, and contractors who vanish after the deposit. This guide front-loads the decisions that protect your budget.",
  },
  {
    title: "Written for Kootenay reality",
    body: "Snow loads, RDEK/RDCK permits, FireSmart zones, radon in basements, and bear-smart yards aren't generic advice — they're local survival skills for mountain homeowners.",
  },
  {
    title: "No fluff. No funnel trap.",
    body: "You get the full manual instantly with a private access password. We don't drip half a PDF and hard-sell a consultation. Read it, use the checklists, hire whoever earns your trust.",
  },
] as const;

export const GUIDE_CHAPTERS = [
  { n: 1, title: "Project readiness checklist", teaser: "Scope, budget, timeline, and access before you call anyone." },
  { n: 2, title: "Contractor red flags", teaser: "Cash-only quotes, permit dodging, and pressure tactics to avoid." },
  { n: 3, title: "Building permits & RDEK/RDCK", teaser: "When you need a permit, inspections, and snow-load rules." },
  { n: 4, title: "BC Building Code & Step Code", teaser: "Climate design for freeze-thaw, wind, and heavy roof loads." },
  { n: 5, title: "Energy efficiency & rebates", teaser: "CleanBC, heat pumps, and Step Code compliance tips." },
  { n: 6, title: "Durable materials", teaser: "Timber, metal roofing, and assemblies that last in the Kootenays." },
  { n: 7, title: "Wildfire & FireSmart", teaser: "Defensible space zones and ember-resistant details." },
  { n: 8, title: "Flood & drainage", teaser: "Downspouts, grading, and spring freshet prep." },
  { n: 9, title: "Landslide & slope stability", teaser: "Steep-lot warning signs and smart site planning." },
  { n: 10, title: "Radon & indoor air", teaser: "Testing, mitigation, and ventilation basics." },
  { n: 11, title: "Winter maintenance", teaser: "Snow loads, frozen pipes, and seasonal checklists." },
  { n: 12, title: "Pests & bear-smart yards", teaser: "Carpenter ants, attractants, and wildlife safety." },
  { n: 13, title: "Emergency preparedness", teaser: "Grab-and-go kits and evacuation stages." },
  { n: 14, title: "Budgeting & financing", teaser: "Quote comparison worksheet and cost control." },
  { n: 15, title: "Insurance & risk", teaser: "Flood, wildfire, and landslide coverage gaps." },
  { n: 16, title: "Homeownership insights", teaser: "Kootenay market due diligence when buying." },
  { n: 17, title: "Local resources", teaser: "RDEK, RDCK, rebates, and emergency contacts." },
  { n: 18, title: "Next steps", teaser: "Checklists, walkthroughs, and when to call a pro." },
] as const;

/** Curated preview images for the funnel (recommended 12-set). */
export const FUNNEL_PREVIEW_IMAGES = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15].map(
  (id) => GUIDE_IMAGES.find((img) => img.id === id)!
);

export const FUNNEL_FAQ = [
  {
    q: "Is this actually free?",
    a: "Yes. The full manual is free. We built it because educated homeowners make better clients — and better neighbours. No credit card, no mandatory phone call.",
  },
  {
    q: "Why password-protected?",
    a: "It's a living document we update as codes and rebates change. Your access code lets you return anytime and keeps download links from getting scraped by spam bots.",
  },
  {
    q: "Will you spam me?",
    a: "You'll get your access password by email. We may send occasional Kootenay project tips — unsubscribe anytime. We don't sell your email.",
  },
  {
    q: "I'm not hiring Black Timber. Can I still use it?",
    a: "Absolutely. Use the checklists with any contractor. We wrote this for Kootenay homeowners, not as a hidden sales brochure.",
  },
] as const;
