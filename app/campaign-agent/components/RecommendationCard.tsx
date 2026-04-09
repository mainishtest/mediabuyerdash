"use client";

import type { AgentRecommendation } from "../../../lib/agentFramework/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { useState } from "react";

const IMPACT_STYLES = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-500",
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  budget_increase: "Scale Budget",
  budget_decrease: "Reduce Budget",
  creative_swap: "Swap Creative",
  creative_fatigue: "Creative Fatigue",
  pause_underperformer: "Pause",
  audience_adjustment: "Audience",
  naming_issue: "Naming",
  missing_goal: "Missing Goal",
  missing_pixel: "Missing Pixel",
  targeting_overlap: "Overlap",
  zero_conversions: "No Conversions",
  spend_imbalance: "Imbalance",
  pacing_anomaly: "Pacing",
  configuration_issue: "Config",
  general: "General",
};

export function RecommendationCard({ rec }: { rec: AgentRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border border-slate-800 border-l-2 ${IMPACT_STYLES[rec.impact]} bg-slate-900/50 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
              {CATEGORY_LABELS[rec.category] ?? rec.category}
            </span>
            <ConfidenceBadge confidence={rec.confidence} />
          </div>
          <h4 className="text-sm font-semibold text-white">{rec.title}</h4>
          <p className="mt-1 text-xs text-slate-400">{rec.description}</p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
            rec.impact === "high"
              ? "bg-red-500/20 text-red-400"
              : rec.impact === "medium"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-slate-800 text-slate-400"
          }`}
        >
          {rec.impact}
        </span>
      </div>

      {/* Suggested action */}
      <div className="mt-3 rounded-md bg-slate-800/50 px-3 py-2">
        <p className="text-xs text-slate-300">
          <span className="font-medium text-emerald-400">Suggested: </span>
          {rec.suggestedAction}
        </p>
      </div>

      {/* Expandable details */}
      {(rec.assumptions.length > 0 || Object.keys(rec.supportingData).length > 0) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
          {rec.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">Assumptions</p>
              <ul className="mt-1 space-y-0.5">
                {rec.assumptions.map((a, i) => (
                  <li key={i} className="text-xs text-slate-400">
                    - {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Object.keys(rec.supportingData).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">Supporting Data</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {Object.entries(rec.supportingData).map(([key, val]) => (
                  <span key={key} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    {key}: {typeof val === "number" ? val.toFixed(2) : String(val)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
