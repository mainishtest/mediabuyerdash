"use client";

import { useState } from "react";
import type { LearningMemoryEntry } from "../../../../lib/learningMemory/types";
import {
  CONFIDENCE_BADGE,
  SOURCE_BADGE,
  SOURCE_LABEL,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
} from "../../../../lib/learningMemory/patterns";

export function LearningCard({ entry }: { entry: LearningMemoryEntry }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const hasEvidence = entry.evidence.length > 0 || entry.relatedEntities.length > 0;

  const confBadge   = CONFIDENCE_BADGE[entry.confidence];
  const srcBadge    = SOURCE_BADGE[entry.sourceType]    ?? "border-slate-700 bg-slate-800 text-slate-400";
  const catAccent   = CATEGORY_ACCENT[entry.category]   ?? "text-slate-300";
  const srcLabel    = SOURCE_LABEL[entry.sourceType]     ?? entry.sourceType;
  const catLabel    = CATEGORY_LABEL[entry.category]     ?? entry.category;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${confBadge}`}>
          {entry.confidence.charAt(0).toUpperCase() + entry.confidence.slice(1)} confidence
        </span>
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${srcBadge}`}>
          {srcLabel}
        </span>
        <span className={`text-xs font-medium ${catAccent}`}>{catLabel}</span>
      </div>

      {/* Client / campaign */}
      <p className="mt-1.5 text-xs text-slate-500">
        {entry.clientName}
        {entry.campaignName ? ` · ${entry.campaignName}` : ""}
      </p>

      {/* Insight text */}
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{entry.insightText}</p>

      {/* Pattern label */}
      {entry.pattern && (
        <p className="mt-1.5 rounded-md bg-slate-800/60 px-2 py-1 font-mono text-xs text-slate-500">
          {entry.pattern}
        </p>
      )}

      {/* Brief tag */}
      {entry.usableForBriefs && (
        <p className="mt-1.5 text-xs text-sky-400">◈ Usable for creative briefs</p>
      )}

      {/* Evidence expand */}
      {hasEvidence && (
        <div className="mt-3">
          <button
            onClick={() => setShowEvidence((v) => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            <span>{showEvidence ? "▲" : "▼"}</span>
            <span>{showEvidence ? "Hide evidence" : "Show evidence"}</span>
          </button>

          {showEvidence && (
            <div className="mt-2 space-y-2">
              {/* Signal table */}
              {entry.evidence.length > 0 && (
                <div className="space-y-1">
                  {entry.evidence.map((sig, i) => {
                    const dirCls =
                      sig.direction === "positive" ? "text-emerald-400" :
                      sig.direction === "negative" ? "text-rose-400"    :
                      "text-slate-400";
                    return (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">{sig.label}</span>
                        <span className={`text-xs font-medium ${dirCls}`}>{sig.value}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Related entities */}
              {entry.relatedEntities.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {entry.relatedEntities.map((en) => (
                    <span
                      key={en.id}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
                    >
                      <span className="text-slate-600">{en.type}</span>
                      <span>{en.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Period */}
              {(entry.periodFrom || entry.periodTo) && (
                <p className="text-xs text-slate-600">
                  Period: {entry.periodFrom ?? "?"} — {entry.periodTo ?? "?"}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
