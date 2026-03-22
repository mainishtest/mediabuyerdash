"use client";

// QuickActions — One-tap question buttons for the most common operator needs.

import type { OptimizationAssistantSuggestion } from "../../../lib/optimizationAssistant/types";

type Props = {
  suggestions: OptimizationAssistantSuggestion[];
  onSelect:    (text: string) => void;
  compact?:    boolean;
};

export function QuickActions({ suggestions, onSelect, compact }: Props) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "gap-2"}`}>
      {suggestions.map((s) => (
        <button
          key={s.text}
          onClick={() => onSelect(s.text)}
          className={`rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300
                     transition-colors hover:border-emerald-700 hover:bg-emerald-900/20 hover:text-emerald-300
                     ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
        >
          {s.text}
        </button>
      ))}
    </div>
  );
}
