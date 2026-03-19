"use client";

import { INTENT_LABEL } from "../../../lib/optimizationAssistant/intentClassifier";
import { EvidencePanel }    from "./EvidencePanel";
import { ActionLinksPanel } from "./ActionLinksPanel";
import { SuggestedPrompts } from "./SuggestedPrompts";
import type { OptimizationAssistantResponse } from "../../../lib/optimizationAssistant/types";

interface ResponseCardProps {
  response: OptimizationAssistantResponse;
  onFollowUp: (text: string) => void;
}

export function ResponseCard({ response, onFollowUp }: ResponseCardProps) {
  return (
    <div className="space-y-4">
      {/* Intent badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                         bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 font-medium">
          ◈ {INTENT_LABEL[response.intent]}
        </span>
        {response.dataWarnings.length > 0 && (
          <span className="text-xs text-amber-500">⚠ {response.dataWarnings.length} data warning{response.dataWarnings.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Main response text */}
      <p className="text-slate-100 leading-relaxed">{response.summary}</p>

      {/* Data warnings */}
      {response.dataWarnings.length > 0 && (
        <div className="px-3 py-2 bg-amber-950/30 border border-amber-900/40 rounded-lg space-y-1">
          {response.dataWarnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">{w}</p>
          ))}
        </div>
      )}

      {/* Evidence */}
      <EvidencePanel evidence={response.evidence} entities={response.entities} />

      {/* Action links */}
      <ActionLinksPanel links={response.actionLinks} />

      {/* Follow-up suggestions */}
      {response.suggestions.length > 0 && (
        <SuggestedPrompts
          suggestions={response.suggestions}
          onSelect={onFollowUp}
          label="Follow-up questions"
        />
      )}
    </div>
  );
}
