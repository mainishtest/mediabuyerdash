"use client";

import type { ConfidenceScore } from "../../../lib/agentFramework/types";

const STYLES = {
  high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-red-500/20 text-red-400 border-red-500/30",
} as const;

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceScore }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[confidence.level]}`}
      title={confidence.reasoning}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {confidence.level} confidence
    </span>
  );
}
