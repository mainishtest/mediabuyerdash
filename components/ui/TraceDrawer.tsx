"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { DecisionTrace, DecisionLimitation, DecisionInfluence, DecisionEvidence, DecisionTraceStep } from "../../lib/decisionTrace/types";

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, open, onToggle }: { title: string; count?: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2.5 text-sm text-slate-400
                 hover:text-slate-200 transition-colors"
    >
      <span className="font-medium text-slate-300">
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-2 text-xs text-slate-500">({count})</span>
        )}
      </span>
      <span className="text-xs">{open ? "▲" : "▼"}</span>
    </button>
  );
}

function StepsSection({ steps }: { steps: DecisionTraceStep[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-slate-800 pb-2">
      <SectionHeader title="Decision steps" count={steps.length} open={open} onToggle={() => setOpen(v => !v)} />
      {open && (
        <ol className="space-y-2 pb-1">
          {steps.map((step) => (
            <li key={step.order} className="flex gap-3 text-sm">
              <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono
                               ${step.passed ? "bg-emerald-900/60 text-emerald-400" : step.isBlocking ? "bg-rose-900/60 text-rose-400" : "bg-amber-900/60 text-amber-400"}`}>
                {step.passed ? "✓" : step.isBlocking ? "✗" : "!"}
              </div>
              <div>
                <div className="text-slate-300 font-medium leading-tight">{step.label}</div>
                <div className="text-slate-500 text-xs leading-snug mt-0.5">{step.description}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EvidenceSection({ evidence }: { evidence: DecisionEvidence[] }) {
  const [open, setOpen] = useState(true);
  const sourceOfTruth = evidence.filter(e => e.isSourceOfTruth);
  return (
    <div className="border-b border-slate-800 pb-2">
      <SectionHeader title="Evidence" count={evidence.length} open={open} onToggle={() => setOpen(v => !v)} />
      {open && (
        <div className="space-y-2 pb-1">
          {sourceOfTruth.length > 0 && (
            <p className="text-xs text-slate-500">
              {sourceOfTruth.length} CRM source-of-truth metric{sourceOfTruth.length !== 1 ? "s" : ""}
            </p>
          )}
          {evidence.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className={`text-xs font-mono ${e.direction === "positive" ? "text-emerald-400" : e.direction === "negative" ? "text-rose-400" : "text-slate-500"}`}>
                  {e.direction === "positive" ? "↑" : e.direction === "negative" ? "↓" : "–"}
                </span>
                <span className="ml-1.5 text-slate-300">{e.label}</span>
                {e.isSourceOfTruth && (
                  <span className="ml-1 text-xs text-emerald-600" title="CRM source of truth">★</span>
                )}
                <span className="block text-xs text-slate-600 pl-4">{e.source}</span>
              </div>
              <span className="text-slate-200 font-medium text-right shrink-0">{e.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfluencesSection({ influences }: { influences: DecisionInfluence[] }) {
  const [open, setOpen] = useState(false);
  const primary = influences.filter(i => i.weight === "primary");
  return (
    <div className="border-b border-slate-800 pb-2">
      <SectionHeader title="Rules & influences" count={influences.length} open={open} onToggle={() => setOpen(v => !v)} />
      {open && (
        <div className="space-y-2.5 pb-1">
          {influences.map((inf, i) => (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                  ${inf.weight === "primary" ? "bg-emerald-950/60 text-emerald-500" :
                    inf.weight === "secondary" ? "bg-slate-800 text-slate-400" :
                    "bg-slate-900 text-slate-500"}`}>
                  {inf.weight}
                </span>
                <span className="text-slate-300">{inf.label}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-snug pl-1">{inf.description}</p>
            </div>
          ))}
          {primary.length === 0 && <p className="text-xs text-slate-500">No primary influences captured.</p>}
        </div>
      )}
    </div>
  );
}

function LimitationsSection({ limitations }: { limitations: DecisionLimitation[] }) {
  const [open, setOpen] = useState(true);
  const blocking = limitations.filter(l => l.severity === "blocking");
  const warnings  = limitations.filter(l => l.severity === "warning");

  const headerColor = blocking.length > 0 ? "text-rose-400" : warnings.length > 0 ? "text-amber-400" : "text-slate-400";

  return (
    <div className="border-b border-slate-800 pb-2">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between py-2.5 text-sm ${headerColor} hover:opacity-80 transition-opacity`}
      >
        <span className="font-medium">
          Limitations
          <span className="ml-2 text-xs opacity-60">({limitations.length})</span>
        </span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-2.5 pb-1">
          {limitations.map((lim, i) => (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium
                  ${lim.severity === "blocking" ? "text-rose-400" :
                    lim.severity === "warning"  ? "text-amber-400" :
                    "text-slate-500"}`}>
                  {lim.severity === "blocking" ? "⊘ Blocking" : lim.severity === "warning" ? "⚠ Warning" : "ℹ Info"}
                </span>
                <span className="text-slate-300">{lim.label}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-snug pl-1">{lim.description}</p>
            </div>
          ))}
          {limitations.length === 0 && (
            <p className="text-xs text-slate-500">No limitations detected.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main TraceDrawer ──────────────────────────────────────────────────────────

interface TraceDrawerProps {
  trace:   DecisionTrace;
  open:    boolean;
  onClose: () => void;
}

export function TraceDrawer({ trace, open, onClose }: TraceDrawerProps) {
  // Lock body scroll when open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const blockingLimitations = trace.limitations.filter(l => l.severity === "blocking");
  const warningLimitations  = trace.limitations.filter(l => l.severity === "warning");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — mobile: bottom sheet; desktop: right panel */}
      <div
        className="fixed z-50 bg-slate-950 border-slate-800
                   /* Mobile: bottom sheet */
                   bottom-0 left-0 right-0 rounded-t-2xl border-t max-h-[92vh]
                   /* Desktop: right panel */
                   sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:w-[420px]
                   sm:rounded-none sm:border-t-0 sm:border-l sm:max-h-full
                   flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Decision trace: ${trace.outputLabel}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-4 border-b border-slate-800 shrink-0">
          <div className="space-y-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                {trace.outputType.replace(/_/g, " ")}
              </span>
              <ConfidenceBadge level={trace.confidence.level} score={trace.confidence.score} />
            </div>
            <h2 className="text-base font-semibold text-slate-100 leading-tight">{trace.outputLabel}</h2>
            <p className="text-xs text-slate-400 leading-snug">{trace.summary}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close trace"
          >
            ✕
          </button>
        </div>

        {/* Blocking alert */}
        {blockingLimitations.length > 0 && (
          <div className="px-4 py-2.5 bg-rose-950/40 border-b border-rose-900/40 shrink-0">
            <p className="text-xs text-rose-400 font-medium">
              ⊘ {blockingLimitations.length} blocking issue{blockingLimitations.length !== 1 ? "s" : ""} — see Limitations
            </p>
          </div>
        )}

        {/* Warning alert */}
        {blockingLimitations.length === 0 && warningLimitations.length > 0 && (
          <div className="px-4 py-2.5 bg-amber-950/30 border-b border-amber-900/30 shrink-0">
            <p className="text-xs text-amber-400">
              ⚠ {warningLimitations.length} data warning{warningLimitations.length !== 1 ? "s" : ""} — review before acting
            </p>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0 divide-y divide-slate-800/0">
          <StepsSection steps={trace.steps} />
          {trace.evidence.length > 0 && <EvidenceSection evidence={trace.evidence} />}
          {trace.influences.length > 0 && <InfluencesSection influences={trace.influences} />}
          <LimitationsSection limitations={trace.limitations} />

          {/* Confidence detail */}
          <div className="py-3 space-y-1.5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Confidence factors</p>
            {trace.confidence.reasons.map((r, i) => (
              <p key={i} className="text-xs text-emerald-500 flex items-start gap-1.5">
                <span>✓</span><span>{r}</span>
              </p>
            ))}
            {trace.confidence.limitations.map((l, i) => (
              <p key={i} className="text-xs text-amber-500 flex items-start gap-1.5">
                <span>–</span><span>{l}</span>
              </p>
            ))}
          </div>

          {/* Constraints */}
          {trace.constraints.length > 0 && (
            <div className="py-3 space-y-1.5">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">System constraints</p>
              {trace.constraints.map((c, i) => (
                <div key={i} className="text-xs text-slate-400">
                  <span className="font-medium text-slate-300">{c.label}</span>
                  <span className="text-slate-500"> — {c.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Data warnings */}
          {trace.dataWarnings.length > 0 && (
            <div className="py-3 space-y-1">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Data warnings</p>
              {trace.dataWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-400">{w}</p>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="py-2">
            <p className="text-xs text-slate-600">
              Generated: {new Date(trace.generatedAt).toLocaleString()}
              {trace.clientName && ` · ${trace.clientName}`}
            </p>
          </div>
        </div>

        {/* Action links footer */}
        {trace.actionLinks.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950 shrink-0">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Go to</p>
            <div className="flex flex-wrap gap-2">
              {trace.actionLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs
                             bg-slate-800 border border-slate-700 rounded-lg
                             text-slate-300 hover:text-white hover:border-emerald-600
                             active:scale-95 transition-all"
                  title={link.description}
                >
                  <span className="text-slate-500">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
