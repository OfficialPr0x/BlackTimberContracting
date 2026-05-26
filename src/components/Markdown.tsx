"use client";

/**
 * Brand-styled markdown renderer for AI chat output.
 *
 * Built on react-markdown + remark-gfm (tables, strikethrough, autolinks,
 * task lists). All elements are restyled to match the Black Timber dark/gold
 * aesthetic — tight line-height, gold accents on headings and inline code,
 * subtle borders on blockquotes and tables.
 *
 * Safety: react-markdown does NOT render raw HTML by default, which is
 * exactly what we want for untrusted AI output (no XSS risk from a model
 * that decides to inject a <script> tag).
 */

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  // Paragraphs — tight vertical rhythm so streamed chunks don't jump around.
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed text-brand-gray text-xs">{children}</p>
  ),

  // Small headings only — H3 maps to a tiny gold uppercase eyebrow.
  h1: ({ children }) => (
    <div className="text-[10px] font-extrabold uppercase tracking-widest text-brand-gold mb-1.5 mt-3 first:mt-0">
      {children}
    </div>
  ),
  h2: ({ children }) => (
    <div className="text-[10px] font-extrabold uppercase tracking-widest text-brand-gold mb-1.5 mt-3 first:mt-0">
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div className="text-[10px] font-extrabold uppercase tracking-widest text-brand-gold mb-1.5 mt-3 first:mt-0">
      {children}
    </div>
  ),
  h4: ({ children }) => (
    <div className="text-[10px] font-extrabold uppercase tracking-wider text-white mb-1 mt-2 first:mt-0">
      {children}
    </div>
  ),
  h5: ({ children }) => (
    <div className="text-[10px] font-bold uppercase tracking-wider text-white mb-1 mt-2 first:mt-0">
      {children}
    </div>
  ),
  h6: ({ children }) => (
    <div className="text-[10px] font-bold uppercase tracking-wider text-white mb-1 mt-2 first:mt-0">
      {children}
    </div>
  ),

  // Lists — tight, hanging gold bullets.
  ul: ({ children }) => (
    <ul className="mb-2 last:mb-0 space-y-1 text-xs text-brand-gray pl-0 list-none">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 last:mb-0 space-y-1 text-xs text-brand-gray pl-4 list-decimal marker:text-brand-gold marker:font-bold">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    // Task-list items (checkboxes from GFM) render with the default checkbox.
    if ("className" in props && typeof props.className === "string" && props.className.includes("task-list-item")) {
      return <li className="flex items-start gap-2 pl-0 [&>input]:mt-1 [&>input]:accent-brand-gold">{children}</li>;
    }
    return (
      <li className="relative pl-4 leading-relaxed before:content-['—'] before:absolute before:left-0 before:top-0 before:text-brand-gold before:font-bold">
        {children}
      </li>
    );
  },

  // Inline + block code.
  code: ({ className, children, ...props }) => {
    const inline = !className?.startsWith("language-");
    if (inline) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-brand-black/60 text-brand-gold font-mono text-[10.5px]"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`block ${className ?? ""}`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 last:mb-0 p-2.5 rounded-lg bg-brand-black/70 border border-brand-border overflow-x-auto text-[10.5px] leading-snug font-mono text-brand-gray">
      {children}
    </pre>
  ),

  // Quotes — gold left rule.
  blockquote: ({ children }) => (
    <blockquote className="mb-2 last:mb-0 border-l-2 border-brand-gold pl-3 italic text-brand-gray/90 text-xs">
      {children}
    </blockquote>
  ),

  // Strong + em — keep emphasis visible against the muted body color.
  strong: ({ children }) => (
    <strong className="font-bold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-brand-gray/90">{children}</em>,

  // Links — gold, underline on hover, always open externally for safety.
  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="text-brand-gold underline decoration-brand-gold/40 hover:decoration-brand-gold underline-offset-2"
    >
      {children}
    </a>
  ),

  // Horizontal rule — quiet gold divider.
  hr: () => <hr className="my-3 border-t border-brand-border" />,

  // Tables — compact, dark, gold header bottom-border.
  table: ({ children }) => (
    <div className="mb-2 last:mb-0 overflow-x-auto -mx-1">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-brand-border/60 last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left py-1.5 px-2 font-bold uppercase tracking-wider text-[9.5px] text-brand-gold border-b border-brand-gold/40">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="py-1.5 px-2 text-brand-gray align-top">{children}</td>
  ),
};

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
