"use client";

import type { OptimizationAssistantSuggestion } from "../../../lib/optimizationAssistant/types";

interface SuggestedPromptsProps {
  suggestions: OptimizationAssistantSuggestion[];
  onSelect: (text: string) => void;
  label?: string;
}

export function SuggestedPrompts({ suggestions, onSelect, label = "Suggested questions" }: SuggestedPromptsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide px-1">{label}</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => onSelect(s.text)}
            className="px-3 py-2 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg
                       hover:bg-slate-700 hover:border-emerald-600 hover:text-white
                       active:scale-95 transition-all duration-150 text-left leading-snug"
          >
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}
