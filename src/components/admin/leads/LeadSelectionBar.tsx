"use client";

import { useEffect, useState } from "react";
import { Loader, Trash2 } from "lucide-react";

export function LeadCheckbox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      className="h-3.5 w-3.5 rounded border-brand-border bg-brand-black text-brand-gold focus:ring-brand-gold/40 focus:ring-offset-0"
    />
  );
}

export function LeadSelectionBar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleAll,
  onDelete,
  deleting,
}: {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-border bg-brand-panel/60 px-3 py-2">
      <label className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-brand-gray cursor-pointer">
        <LeadCheckbox
          checked={allSelected}
          onChange={() => onToggleAll()}
          ariaLabel="Select all leads"
        />
        Select all
      </label>
      {selectedCount > 0 ? (
        <>
          <span className="text-[10px] font-mono text-brand-gray">
            {selectedCount} selected
          </span>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void onDelete()}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-[10px] font-mono uppercase tracking-wider text-red-300 hover:bg-red-500/20 disabled:opacity-40"
          >
            {deleting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete selected
          </button>
        </>
      ) : null}
    </div>
  );
}

export function useLeadSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (ids.includes(id)) next.add(id);
      }
      return next;
    });
  }, [ids]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === ids.length) return new Set();
      return new Set(ids);
    });
  };

  const clear = () => setSelected(new Set());

  return {
    selected,
    selectedCount: selected.size,
    allSelected: ids.length > 0 && selected.size === ids.length,
    toggle,
    toggleAll,
    clear,
  };
}
