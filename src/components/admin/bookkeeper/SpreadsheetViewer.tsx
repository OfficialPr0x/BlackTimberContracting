"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

export default function SpreadsheetViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not load spreadsheet");
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]!];
        if (!sheet) throw new Error("Empty workbook");
        const table = XLSX.utils.sheet_to_html(sheet, { id: "btc-sheet" });
        if (!cancelled) setHtml(table);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return <p className="text-sm text-red-300 p-4">{error}</p>;
  }
  if (!html) {
    return (
      <p className="text-xs font-mono text-brand-gray p-4 uppercase tracking-widest">
        Loading spreadsheet…
      </p>
    );
  }

  return (
    <div
      className="overflow-auto max-h-[min(60dvh,560px)] p-2 text-xs [&_table]:w-full [&_td]:border [&_td]:border-brand-border [&_td]:px-2 [&_td]:py-1 [&_th]:bg-brand-panel [&_th]:text-brand-gold"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
