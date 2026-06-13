import GithubSlugger from "github-slugger";

export interface GuideHeading {
  text: string;
  slug: string;
}

/**
 * Extracts the level-2 (`##`) section headings with github-slugger slugs that
 * match the ids rehype-slug generates on the rendered headings. The
 * Introduction is excluded (it sits at the very top of the guide).
 */
export function getGuideHeadings(markdown: string): GuideHeading[] {
  const slugger = new GithubSlugger();
  const headings: GuideHeading[] = [];

  for (const line of markdown.split("\n")) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      const text = match[1].trim();
      // Slug every heading so ids stay in sync with rehype-slug ordering.
      const slug = slugger.slug(text);
      if (text.toLowerCase() === "introduction") continue;
      headings.push({ text, slug });
    }
  }

  return headings;
}

/**
 * Builds a table-of-contents card from the level-2 (`##`) headings and
 * replaces the `{{TOC}}` token. Used for the inline (mobile/print) TOC.
 */
export function injectTableOfContents(markdown: string): string {
  if (!markdown.includes("{{TOC}}")) return markdown;

  const headings = getGuideHeadings(markdown);
  if (headings.length === 0) {
    return markdown.replace(/\{\{TOC\}\}/g, "");
  }

  const items = headings
    .map((h) => `    <li><a href="#${h.slug}">${escapeHtml(h.text)}</a></li>`)
    .join("\n");

  const toc = `
<nav class="guide-toc" aria-label="Table of contents">
  <p class="guide-toc__title">What's inside</p>
  <ol class="guide-toc__list">
${items}
  </ol>
</nav>
`.trim();

  return markdown.replace(/\{\{TOC\}\}/g, toc);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
