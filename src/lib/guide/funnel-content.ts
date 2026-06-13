import { GUIDE_IMAGES } from "./images";

export const GUIDE_FUNNEL_TITLE =
  "Black Timber Field Guide: The Kootenay Homeowner Project Readiness & Resilience Manual";

/** Cinematic funnel hero — workspace, valley, and mountain home at golden hour. */
export const GUIDE_HERO_IMAGE = {
  url: "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781334067/ChatGPT_Image_Jun_13_2026_01_00_46_AM_shldpc.png",
  alt: "Black Timber field guide hero — plans, tape measure, and coffee on a timber ledge overlooking a Kootenay valley and mountain home at golden hour",
};

/** Hero trust bullets — field-tested, not marketing fluff. */
export const HERO_BULLETS = [
  "Built for Fernie, Sparwood, Elkford, Cranbrook & Nelson",
  "18 practical chapters — permits to wildfire to budgeting",
  "No sales pitch. Just field-tested homeowner knowledge.",
  "Created by a licensed local contracting crew",
] as const;

/** Authority strip — reads like field data, not SaaS metrics. */
export const AUTHORITY_STRIP = [
  { stat: "18", label: "Chapters", detail: "Full resilience manual" },
  { stat: "5", label: "Kootenay Towns", detail: "Written for local homes" },
  { stat: "RDEK / RDCK", label: "Permit + Hazard", detail: "Real code & rules" },
  { stat: "Red Flags", label: "Contractor Vetting", detail: "Hire with confidence" },
] as const;

export const WHY_PILLARS = [
  {
    title: "Stop Surprise Bills Before They Start",
    body: "Most renovation pain shows up before the first board is cut — vague scopes, skipped permits, and crews that vanish after the deposit. This manual front-loads the decisions that protect your budget so the quote you sign is the price you pay.",
  },
  {
    title: "Written For Kootenay Reality",
    body: "Snow loads, freeze-thaw heave, FireSmart zones, spring freshet flooding, basement radon, and bear-smart yards aren't generic checklist filler — they're the conditions your home actually faces in this valley.",
  },
  {
    title: "Built Before The Quote",
    body: "The best time to get organized is before you call anyone. Walk in with your scope, your priorities, and the right questions — and you'll spot a sloppy contractor in the first ten minutes.",
  },
] as const;

export const GUIDE_CHAPTERS = [
  { n: 1, title: "Project Readiness Checklist", teaser: "Scope, budget, timeline & access before you call anyone." },
  { n: 2, title: "Contractor Red Flags", teaser: "Cash-only quotes, permit dodging & pressure tactics to avoid." },
  { n: 3, title: "Permits & RDEK/RDCK", teaser: "When you need a permit, inspections & snow-load rules." },
  { n: 4, title: "BC Building & Step Code", teaser: "Climate design for freeze-thaw, wind & heavy roof loads." },
  { n: 5, title: "Energy Efficiency & Rebates", teaser: "CleanBC, heat pumps & Step Code compliance tips." },
  { n: 6, title: "Durable Materials", teaser: "Timber, metal roofing & assemblies that last up here." },
  { n: 7, title: "Wildfire & FireSmart", teaser: "Defensible-space zones & ember-resistant detailing." },
  { n: 8, title: "Flood & Drainage", teaser: "Downspouts, grading & spring freshet protection." },
  { n: 9, title: "Landslide & Slope Stability", teaser: "Steep-lot warning signs & smart site planning." },
  { n: 10, title: "Radon & Indoor Air", teaser: "Testing, mitigation & ventilation basics." },
  { n: 11, title: "Winter Maintenance", teaser: "Snow loads, frozen pipes & seasonal checklists." },
  { n: 12, title: "Pests & Bear-Smart Yards", teaser: "Carpenter ants, attractants & wildlife safety." },
  { n: 13, title: "Emergency Preparedness", teaser: "Grab-and-go kits & evacuation stages." },
  { n: 14, title: "Budgeting & Financing", teaser: "Quote comparison worksheet & cost control." },
  { n: 15, title: "Insurance & Risk", teaser: "Flood, wildfire & landslide coverage gaps." },
  { n: 16, title: "Homeownership Insights", teaser: "Kootenay market due diligence when buying." },
  { n: 17, title: "Local Resources", teaser: "RDEK, RDCK, rebates & emergency contacts." },
  { n: 18, title: "Next Steps", teaser: "Checklists, walkthroughs & when to call a pro." },
] as const;

/** Six large "inside the manual" preview cards. */
function img(id: number) {
  return GUIDE_IMAGES.find((g) => g.id === id)!;
}

export const VISUAL_PROOF = [
  { label: "Ch. 01 · Introduction", caption: "Why Kootenay homes demand a different standard.", image: img(1) },
  { label: "Ch. 01 · Project Readiness", caption: "Plan the scope and budget before the first call.", image: img(2) },
  { label: "Ch. 01 · Documentation", caption: "Capture existing conditions to kill surprise costs.", image: img(3) },
  { label: "Ch. 06 · Snow Load", caption: "Roofs and structures rated for real winter weight.", image: img(6) },
  { label: "Ch. 07 · FireSmart", caption: "Defensible space and ember-resistant details.", image: img(9) },
  { label: "Ch. 14 · Budgeting", caption: "Compare quotes and protect your investment.", image: img(16) },
] as const;

/** Right-column checklist for the trust split section. */
export const TRUST_CHECKLIST = [
  "Project readiness & scoping",
  "Permit planning (RDEK / RDCK)",
  "Contractor hiring & red flags",
  "FireSmart & wildfire prep",
  "Flood & drainage protection",
  "Snow load & winter maintenance",
  "Budget & insurance planning",
] as const;

/** Curated preview images (kept for back-compat with other callers). */
export const FUNNEL_PREVIEW_IMAGES = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15].map((id) =>
  GUIDE_IMAGES.find((image) => image.id === id)!,
);

export const FUNNEL_FAQ = [
  {
    q: "Is the guide actually free?",
    a: "Yes — completely. The full 18-chapter manual is free. We built it because organized, informed homeowners make better clients and better neighbours. No credit card, no mandatory phone call.",
  },
  {
    q: "Is this just a sales funnel?",
    a: "It's a genuine field manual first. You get the whole thing instantly with a private access password — we don't drip half a PDF and hard-sell you. Read it, use the checklists, and decide what you want to do next on your terms.",
  },
  {
    q: "Do I have to hire Black Timber?",
    a: "No. Use these checklists with any contractor in the valley. We wrote this for Kootenay homeowners, not as a hidden brochure. If it helps you hire someone else and avoid a bad job, we still did our part.",
  },
  {
    q: "What towns is this written for?",
    a: "Fernie, Sparwood, Elkford, Cranbrook, and Nelson — plus the wider RDEK and RDCK. The permit rules, snow-load values, FireSmart zones, and hazard advice are all specific to this region.",
  },
  {
    q: "Can I use this before getting quotes?",
    a: "That's exactly when it's most valuable. Work through the readiness and budgeting chapters first, and you'll walk into every quote conversation knowing what to ask and what a fair scope looks like.",
  },
  {
    q: "Is this useful for older homes?",
    a: "Very. Older Kootenay homes carry the biggest hidden risks — dated wiring, moisture, insulation gaps, radon, and undersized structure. The documentation and inspection chapters help you find problems before they find you.",
  },
] as const;

/** Kept for back-compat — some callers still import TRUST_STRIP. */
export const TRUST_STRIP = AUTHORITY_STRIP.map((a) => ({
  label: `${a.stat} ${a.label}`,
  detail: a.detail,
}));
