"use client";

import type { DecisionConfidenceLevel } from "../../lib/decisionTrace/types";

interface ConfidenceBadgeProps {
  level:   DecisionConfidenceLevel;
  score?:  number;
  compact?: boolean;  // true = icon only (for tight spaces)
}

const LEVEL_STYLES: Record<DecisionConfidenceLevel, { bg: string; text: string; border: string; dot: string }> = {
  high:   { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-800/40", dot: "bg-emerald-400" },
  medium: { bg: "bg-amber-950/60",   text: "text-amber-400",   border: "border-amber-800/40",   dot: "bg-amber-400"   },
  low:    { bg: "bg-rose-950/60",    text: "text-rose-400",    border: "border-rose-800/40",    dot: "bg-rose-400"    },
};

const LEVEL_LABEL: Record<DecisionConfidenceLevel, string> = {
  high:   "High confidence",
  medium: "Medium confidence",
  low:    "Low confidence",
};

export function ConfidenceBadge({ level, score, compact = false }: ConfidenceBadgeProps) {
  const s = LEVEL_STYLES[level];

  if (compact) {
    return (
      <span
        title={`${LEVEL_LABEL[level]}${score !== undefined ? ` (${score}/100)` : ""}`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium
                    ${s.bg} ${s.text} border ${s.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
                  ${s.bg} ${s.text} border ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {LEVEL_LABEL[level]}
      {score !== undefined && (
        <span className="opacity-60">({score}/100)</span>
      )}
    </span>
  );
}
