"use client";

// ResponsePanel — Displays the AI response with evidence, entities, and action links.
// Decision-first layout: answer first, then evidence, then actions.

import Link from "next/link";
import type { OptimizationAssistantResponse } from "../../../lib/optimizationAssistant/types";
import { INTENT_LABEL } from "../../../lib/optimizationAssistant/intentClassifier";

function EvidenceItem({ e }: { e: OptimizationAssistantResponse["evidence"][0] }) {
  const dirColor = e.direction === "positive" ? "text-emerald-400"
    : e.direction === "negative" ? "text-rose-400" : "text-slate-400";
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
        e.direction === "positive" ? "bg-emerald-400" : e.direction === "negative" ? "bg-rose-400" : "bg-slate-500"
      }`} />
      <div className="min-w-0">
        <span className="font-medium text-slate-300">{e.label}:</span>{" "}
        <span className={dirColor}>{e.value}</span>
        <span className="ml-1.5 text-[10px] text-slate-600">{e.source}</span>
      </div>
    </div>
  );
}

export function ResponsePanel({
  response,
  onFollowUp,
}: {
  response: OptimizationAssistantResponse;
  onFollowUp: (text: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      {/* Intent badge */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          {INTENT_LABEL[response.intent] ?? response.intent}
        </span>
        {response.dataWarnings.length > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
            {response.dataWarnings.length} caveat{response.dataWarnings.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Summary answer */}
      <p className="text-sm leading-relaxed text-slate-200">{response.summary}</p>

      {/* Data warnings */}
      {response.dataWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-800/30 bg-amber-950/20 px-3 py-2">
          {response.dataWarnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-400">{w}</p>
          ))}
        </div>
      )}

      {/* Evidence */}
      {response.evidence.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">Evidence</p>
          <div className="space-y-1.5">
            {response.evidence.map((e, i) => <EvidenceItem key={i} e={e} />)}
          </div>
        </div>
      )}

      {/* Entities */}
      {response.entities.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">Referenced</p>
          <div className="flex flex-wrap gap-1.5">
            {response.entities.map((e) => (
              <Link key={e.id} href={e.href}
                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">
                {e.type} · {e.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Action links */}
      {response.actionLinks.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">Actions</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {response.actionLinks.map((a) => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40
                           px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white">
                <span className="text-slate-500">{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.label}</p>
                  <p className="text-[10px] text-slate-500">{a.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up suggestions */}
      {response.suggestions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">Ask next</p>
          <div className="flex flex-wrap gap-1.5">
            {response.suggestions.map((s) => (
              <button key={s.text} onClick={() => onFollowUp(s.text)}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-400
                           transition-colors hover:border-emerald-700 hover:text-emerald-300">
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
