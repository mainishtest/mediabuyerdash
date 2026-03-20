"use client";

import { useState } from "react";
import type {
  OptimizationAssistantEvidence,
  OptimizationAssistantEntityReference,
} from "../../../lib/optimizationAssistant/types";

interface EvidencePanelProps {
  evidence: OptimizationAssistantEvidence[];
  entities: OptimizationAssistantEntityReference[];
}

function directionColor(d?: "positive" | "negative" | "neutral") {
  if (d === "positive") return "text-emerald-400";
  if (d === "negative") return "text-rose-400";
  return "text-slate-400";
}

function directionArrow(d?: "positive" | "negative" | "neutral") {
  if (d === "positive") return "↑";
  if (d === "negative") return "↓";
  return "–";
}

function entityIcon(type: OptimizationAssistantEntityReference["type"]) {
  const map: Record<string, string> = {
    client: "◎", campaign: "◈", experiment: "⊡", creative: "◇",
    approval: "✓", alert: "⚠", pacing: "◐",
  };
  return map[type] ?? "○";
}

export function EvidencePanel({ evidence, entities }: EvidencePanelProps) {
  const [open, setOpen] = useState(false);

  if (evidence.length === 0 && entities.length === 0) return null;

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-400
                   hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-medium">
          Supporting evidence
          {evidence.length > 0 && (
            <span className="ml-2 text-xs text-slate-500">({evidence.length} data point{evidence.length !== 1 ? "s" : ""})</span>
          )}
        </span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-4">
          {/* Evidence items */}
          {evidence.length > 0 && (
            <div className="space-y-2">
              {evidence.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className={`font-mono text-xs ${directionColor(e.direction)}`}>
                      {directionArrow(e.direction)}
                    </span>
                    <span className="ml-2 text-slate-300">{e.label}</span>
                    <span className="ml-1 text-slate-500 text-xs">— {e.source}</span>
                  </div>
                  <span className="text-slate-200 font-medium text-right shrink-0">{e.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Entity references */}
          {entities.length > 0 && (
            <div className="pt-2 border-t border-slate-800/60 space-y-1">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Referenced entities</p>
              {entities.map((e) => (
                <a
                  key={e.id}
                  href={e.href}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors py-1"
                >
                  <span className="text-slate-600">{entityIcon(e.type)}</span>
                  <span className="truncate">{e.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
