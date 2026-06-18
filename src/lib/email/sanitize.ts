/**
 * Conservative HTML sanitizer for rendering inbound email bodies.
 *
 * Defense-in-depth: this strips the obviously dangerous constructs (scripts,
 * event handlers, javascript: URLs, etc.) BUT the primary XSS control is that
 * the UI renders the result inside a `sandbox`ed <iframe srcDoc> with no
 * `allow-scripts`. Never render sanitized email HTML with dangerouslySetInnerHTML
 * directly into the app DOM — always use the sandboxed iframe.
 */

const DANGEROUS_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "noscript",
];

export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html) return "";
  let out = html;

  // Remove dangerous elements and their content where it makes sense.
  for (const tag of DANGEROUS_TAGS) {
    const withContent = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi");
    const selfClosing = new RegExp(`<${tag}\\b[^>]*/?>`, "gi");
    out = out.replace(withContent, "").replace(selfClosing, "");
  }

  // Strip inline event handlers: on*="..." / on*='...' / on*=value
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Neutralize javascript:, vbscript:, and data: (except inline images) URLs.
  out = out.replace(/(href|src|xlink:href)\s*=\s*("|')\s*(javascript|vbscript):[^"']*\2/gi, '$1=$2#$2');
  out = out.replace(
    /(href|src)\s*=\s*("|')\s*data:(?!image\/)[^"']*\2/gi,
    '$1=$2#$2'
  );

  return out;
}

/**
 * Wrap sanitized email HTML in a minimal document for an <iframe srcDoc>.
 * Forces images/links to behave (links open in a new tab) and applies a
 * readable base style.
 */
export function buildEmailDocument(html: string, opts?: { dark?: boolean }): string {
  const safe = sanitizeEmailHtml(html);
  const color = opts?.dark ? "#e7e5e4" : "#1c1917";
  const bg = opts?.dark ? "#1b1a17" : "#ffffff";
  const link = opts?.dark ? "#c5a880" : "#8c714c";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  :root { color-scheme: ${opts?.dark ? "dark" : "light"}; }
  html,body { margin:0; padding:12px; background:${bg}; color:${color};
    font: 14px/1.55 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    word-break: break-word; overflow-wrap: anywhere; }
  img { max-width:100%; height:auto; }
  a { color:${link}; }
  table { max-width:100%; }
  blockquote { border-left:3px solid #88888855; margin:0; padding-left:12px; color:#888; }
  pre { white-space:pre-wrap; }
</style></head><body>${safe}</body></html>`;
}
