"use client";

import { useState } from "react";
import { INTENT_LABEL } from "../../../lib/optimizationAssistant/intentClassifier";
import { EvidencePanel }    from "./EvidencePanel";
import { ActionLinksPanel } from "./ActionLinksPanel";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ConfidenceBadge }  from "../../../components/ui/ConfidenceBadge";
import { TraceDrawer }      from "../../../components/ui/TraceDrawer";
import { buildAssistantResponseTrace } from "../../../lib/decisionTrace/traceBuilder";
import type { OptimizationAssistantResponse } from "../../../lib/optimizationAssistant/types";

interface ResponseCardProps {
  responseId: string;
  response:   OptimizationAssistantResponse;
  onFollowUp: (text: string) => void;
}

export function ResponseCard({ responseId, response, onFollowUp }: ResponseCardProps) {
  const [traceOpen, setTraceOpen] = useState(false);

  // Build confidence from response data (client-side, pure)
  const traceInput = {
    responseId,
    intent:        response.intent,
    summary:       response.summary,
    isGrounded:    response.isGrounded,
    evidenceItems: response.evidence,
    entityCount:   response.entities.length,
    dataWarnings:  response.dataWarnings,
    learningCount: 0,
    generatedAt:   response.generatedAt,
  };
  const trace = buildAssistantResponseTrace(traceInput);

  return (
    <div className="space-y-4">
      {/* Header row: intent badge + confidence + trace button */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                         bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 font-medium">
          ◈ {INTENT_LABEL[response.intent]}
        </span>
        <ConfidenceBadge level={trace.confidence.level} score={trace.confidence.score} />
        <button
          onClick={() => setTraceOpen(true)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          View reasoning
        </button>
        {response.dataWarnings.length > 0 && (
          <span className="text-xs text-amber-500">
            ⚠ {response.dataWarnings.length} data warning{response.dataWarnings.length !== 1 ? "s" : ""}
          </span>
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

      {/* Trace drawer */}
      <TraceDrawer trace={trace} open={traceOpen} onClose={() => setTraceOpen(false)} />
    </div>
  );
}
