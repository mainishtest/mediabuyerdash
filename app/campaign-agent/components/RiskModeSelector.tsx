"use client";

import type { RiskMode } from "../../../lib/agentFramework/types";

const MODES: { value: RiskMode; label: string; description: string }[] = [
  { value: "conservative", label: "Conservative", description: "Low budget, proven creatives only" },
  { value: "balanced", label: "Balanced", description: "Account average, top performers" },
  { value: "aggressive", label: "Aggressive", description: "Higher budget, broader reach" },
];

export function RiskModeSelector({
  value,
  onChange,
}: {
  value: RiskMode;
  onChange: (mode: RiskMode) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onChange(mode.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === mode.value
              ? "bg-slate-700 text-white"
              : "text-slate-500 hover:text-slate-300"
          }`}
          title={mode.description}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
