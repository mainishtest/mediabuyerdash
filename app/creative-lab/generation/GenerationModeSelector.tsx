"use client";

// app/creative-lab/generation/GenerationModeSelector.tsx
// Mode picker for the AI creative generation engine.
// Shows 5 generation modes with labels, descriptions, and output count.
// Responsive: stacked on mobile, horizontal on desktop.

import type { CreativeGenerationMode } from "../../../types/creativeGeneration";
import { GENERATION_MODE_INFO }        from "../../../types/creativeGeneration";

type Props = {
  selected:  CreativeGenerationMode;
  onChange:  (mode: CreativeGenerationMode) => void;
  disabled?: boolean;
};

const MODES: CreativeGenerationMode[] = [
  "copy_variations",
  "headline_variations",
  "angle_variations",
  "image_brief_variations",
  "full_refresh_package",
];

export function GenerationModeSelector({ selected, onChange, disabled = false }: Props) {
  return (
    <div className="space-y-2">
      {MODES.map((mode) => {
        const info       = GENERATION_MODE_INFO[mode];
        const isSelected = selected === mode;

        return (
          <button
            key={mode}
            onClick={() => !disabled && onChange(mode)}
            disabled={disabled}
            className={`w-full rounded-xl border p-3.5 text-left transition-all
              ${isSelected
                ? "border-indigo-600/60 bg-indigo-950/30 ring-1 ring-indigo-600/40"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
              }
              ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
            `}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-snug ${isSelected ? "text-indigo-300" : "text-slate-200"}`}>
                  {info.label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {info.description}
                </p>
              </div>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium
                ${isSelected ? "bg-indigo-900/60 text-indigo-300" : "bg-slate-800 text-slate-500"}`}>
                {info.outputCount} output{info.outputCount !== 1 ? "s" : ""}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
