/**
 * Project spotlights + recurring CTAs injected into the field guide.
 *
 * Spotlights use REAL Black Timber before/after photography (same assets as the
 * homepage "Holy Sh*t Wall"). Spotlight 3 (fence) is a representative Elk Valley
 * build — swap the photo + specifics with your own fence project anytime.
 */

const PHONE_DISPLAY = "250-910-9071";
const PHONE_TEL = "+12509109071";
const WEBSITE = "blacktimber.ca";
const SERVICE_AREA = "Fernie • Sparwood • Elkford • Cranbrook • Nelson";

export interface ProjectSpotlight {
  id: number;
  title: string;
  city: string;
  /** Before/after pair. Omit for a single representative image (see `image`). */
  before?: string;
  after?: string;
  /** Single representative image (used when before/after are not provided). */
  image?: string;
  challenge: string;
  solution: string;
  timeline: string;
  budget: string;
  result: string;
}

export const PROJECT_SPOTLIGHTS: ProjectSpotlight[] = [
  {
    id: 1,
    title: "Worn Hardwood → Luxury Vinyl Plank",
    city: "Cranbrook, BC",
    before:
      "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781150018/ChatGPT_Image_Jun_10_2026_09_53_06_PM_ke8pd8.png",
    after:
      "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781150032/721200883_122110655181344068_1934277439020490146_n_rpsegv.jpg",
    challenge:
      "Scratched, cupping narrow-plank hardwood that had soaked up years of mountain moisture and foot traffic.",
    solution:
      "Full tear-out, subfloor leveling and moisture check, then waterproof wide-plank luxury vinyl with fresh trim and paint.",
    timeline: "4 days",
    budget: "$1,200",
    result:
      "A warm, scratch- and water-resistant floor built for Kootenay winters — no refinishing, no swelling, easy to clean.",
  },
  {
    id: 2,
    title: "Rotted Entry Stairs & Deck → Custom Cedar",
    city: "Sparwood, BC",
    before:
      "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781150065/715331074_122107253661344068_6031837467438663351_n_zopkfk.jpg",
    after:
      "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781150065/715291967_122107253691344068_2084676794567852693_n_bha1ot.jpg",
    challenge:
      "Spongy, rotted entry stairs and deck framing — a safety hazard headed for a winter failure.",
    solution:
      "Rebuilt on a proper concrete pad with new cedar stairs, railing, and correctly drained, snow-load-rated framing.",
    timeline: "1 week",
    budget: "$2,200",
    result:
      "A safe, square, code-aware entry that sheds water and handles Elk Valley snow loads for years to come.",
  },
  {
    id: 3,
    // TODO: swap with a real fence project photo + specifics when ready.
    title: "Cedar Privacy Fence Build",
    city: "Elk Valley, BC",
    image:
      "https://res.cloudinary.com/dkc1pmbma/image/upload/q_auto/f_auto/v1781160198/ChatGPT_Image_Jun_11_2026_12_42_46_AM_mbavef.png",
    challenge:
      "An exposed yard with no privacy or wind break, on ground that heaves hard through freeze-thaw season.",
    solution:
      "Frost-depth concrete-set posts, pressure-treated structure, and cedar boards detailed to breathe and resist rot.",
    timeline: "3–5 days",
    budget: "From $3,500",
    result:
      "A straight, wind-rated privacy fence that stays plumb through Kootenay frost cycles — built to outlast the cheap-bid alternative.",
  },
];

const spotlightById = new Map(PROJECT_SPOTLIGHTS.map((s) => [s.id, s]));

function spotlightMediaHtml(s: ProjectSpotlight): string {
  if (s.before && s.after) {
    return `<div class="guide-spotlight__media">
    <figure>
      <img src="${s.before}" alt="Before — ${s.title}" loading="lazy" />
      <figcaption>Before</figcaption>
    </figure>
    <figure>
      <img src="${s.after}" alt="After — ${s.title}" loading="lazy" />
      <figcaption>After</figcaption>
    </figure>
  </div>`;
  }
  if (s.image) {
    return `<div class="guide-spotlight__media guide-spotlight__media--single">
    <figure>
      <img src="${s.image}" alt="${s.title}" loading="lazy" />
    </figure>
  </div>`;
  }
  return "";
}

function spotlightHtml(s: ProjectSpotlight): string {
  return `
<div class="guide-spotlight">
  <p class="guide-spotlight__eyebrow">Black Timber Project Spotlight · ${s.city}</p>
  <h3 class="guide-spotlight__title">${s.title}</h3>
  ${spotlightMediaHtml(s)}
  <dl class="guide-spotlight__facts">
    <div><dt>Challenge</dt><dd>${s.challenge}</dd></div>
    <div><dt>Our solution</dt><dd>${s.solution}</dd></div>
    <div><dt>Timeline</dt><dd>${s.timeline}</dd></div>
    <div><dt>Investment</dt><dd>${s.budget}</dd></div>
    <div><dt>Result</dt><dd>${s.result}</dd></div>
  </dl>
  <a class="guide-spotlight__cta" href="tel:${PHONE_TEL}">Want results like this? Call ${PHONE_DISPLAY}</a>
</div>
`.trim();
}

function ctaHtml(): string {
  return `
<div class="guide-cta">
  <p class="guide-cta__eyebrow">Next step — free &amp; no pressure</p>
  <p class="guide-cta__headline">Thinking about a project? Book a free Black Timber Project Walkthrough.</p>
  <p class="guide-cta__body">We'll help you spot hidden issues, prioritize repairs, and build a realistic budget before you spend a dollar.</p>
  <div class="guide-cta__actions">
    <a class="guide-cta__phone" href="tel:${PHONE_TEL}">📞 ${PHONE_DISPLAY}</a>
    <a class="guide-cta__link" href="https://${WEBSITE}">${WEBSITE}</a>
  </div>
  <p class="guide-cta__area">Serving ${SERVICE_AREA}</p>
</div>
`.trim();
}

/** Replace {{SPOTLIGHT:n}} and {{CTA}} tokens with branded HTML blocks. */
export function injectGuideFunnelBlocks(markdown: string): string {
  return markdown
    .replace(/\{\{SPOTLIGHT:(\d+)\}\}/g, (_, raw) => {
      const s = spotlightById.get(Number(raw));
      return s ? spotlightHtml(s) : "";
    })
    .replace(/\{\{CTA\}\}/g, () => ctaHtml());
}
