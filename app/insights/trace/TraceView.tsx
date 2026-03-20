"use client";

import Link from "next/link";
import { TraceSurfaceCard } from "./sections/TraceSurfaceCard";
import { ConfidenceGuide }  from "./sections/ConfidenceGuide";

// ── Traceable surfaces registry ───────────────────────────────────────────────

const SURFACES = [
  {
    outputType:  "campaign_recommendation" as const,
    title:       "Campaign Recommendations",
    description: "Deterministic recommendations (scale, maintain, reduce_spend, review, etc.) based on CRM-evaluated ROAS and CPA against configured goals.",
    href:        "/optimization",
    icon:        "◈",
    examples: [
      "CRM ROAS and CPA vs goal thresholds",
      "Goal source (explicit vs client default)",
      "Health status classification rules",
      "Data window and attribution constraints",
      "Confidence based on goal coverage and CRM data availability",
    ],
    statusNote: "Trace available in Optimization page",
  },
  {
    outputType:  "assistant_response" as const,
    title:       "AI Assistant Responses",
    description: "Operational Q&A responses grounded in Command Center, Executive Reporting, and Learning Memory data. Includes intent classification and evidence attribution.",
    href:        "/assistant",
    icon:        "◈",
    examples: [
      "Intent classification method and matched keywords",
      "Data sources assembled for context",
      "Evidence items extracted from live data",
      "Whether response was AI-generated or template-based",
      "Data warnings from aggregator",
    ],
    statusNote: "Trace available directly in Assistant conversation",
  },
  {
    outputType:  "experiment_outcome" as const,
    title:       "Experiment Outcome Decisions",
    description: "Winner detection results from A/B experiments. Shows lift calculation, statistical confidence, guardrail checks, and recommended action.",
    href:        "/experiments",
    icon:        "⊡",
    examples: [
      "Primary metric lift vs success threshold",
      "Statistical confidence score",
      "Spend and conversion volume coverage",
      "Guardrail breach detection",
      "Recommended follow-up action",
    ],
    statusNote: "Trace available in Experiments page",
  },
  {
    outputType:  "creative_score" as const,
    title:       "Creative Scoring Decisions",
    description: "Heuristic dimension scores for creative draft variants. Shows per-dimension scores, policy risk detection, and approval readiness.",
    href:        "/creative-lab/review",
    icon:        "◇",
    examples: [
      "Scoring weights per variant type (copy vs image)",
      "Per-dimension scores with pass/fail",
      "Policy risk pattern detection",
      "Brief intent and goal alignment context",
      "Approval readiness determination",
    ],
    statusNote: "Trace available in Creative Lab review",
  },
  {
    outputType:  "publish_guardrail" as const,
    title:       "Publish Guardrail Checks",
    description: "Safety gate evaluation before launch actions. Every required and optional guardrail result with blocking status is shown.",
    href:        "/creative-lab/publish-prep",
    icon:        "◎",
    examples: [
      "Required vs optional guardrail results",
      "Human approval confirmation status",
      "Validation pass/fail state",
      "Execution mode allowance check",
      "Blocking vs warning severity",
    ],
    statusNote: "Trace available in Publish Prep workflow",
  },
] as const;

// ── Product rules ─────────────────────────────────────────────────────────────

const PRODUCT_RULES = [
  { icon: "★", label: "CRM source of truth", desc: "ROAS and CPA always use Shopify/CRM data. Meta-reported revenue is never used for performance decisions." },
  { icon: "⊙", label: "7-day attribution", desc: "All conversion metrics use a 7-day attribution window. Conversions after this window are excluded." },
  { icon: "◐", label: "Ad account timezone", desc: "Dayparting and hour-of-day analysis use the ad account's configured timezone — not UTC or server time." },
  { icon: "◈", label: "Meta for delivery", desc: "Meta is used for delivery analysis and operational execution. Shopify/CRM is used for business outcomes." },
];

// ── Main view ─────────────────────────────────────────────────────────────────

export function TraceView() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-100">Decision Trace Explorer</h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Every recommendation, assistant response, experiment outcome, creative score, and publish
          guardrail check in this dashboard includes a full decision trace — showing exactly what data
          was used, what rules were applied, what the system&apos;s confidence is, and what limitations exist.
        </p>
      </div>

      {/* Product rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Core product rules applied to all traces</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRODUCT_RULES.map((r) => (
            <div key={r.label} className="flex items-start gap-2.5 text-sm">
              <span className="text-emerald-600 text-base shrink-0 mt-0.5">{r.icon}</span>
              <div>
                <span className="text-slate-300 font-medium">{r.label}</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Traceable surfaces */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Traceable output surfaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SURFACES.map((s) => (
            <TraceSurfaceCard key={s.outputType} {...s} />
          ))}
        </div>
      </div>

      {/* Confidence guide */}
      <ConfidenceGuide />

      {/* How to use */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-200">How to use decision traces</h2>
        <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
          <p>
            Every output surface that supports tracing shows a <span className="text-slate-300 font-medium">confidence badge</span> (high / medium / low) inline with the recommendation or response.
          </p>
          <p>
            Clicking <span className="text-slate-300 font-medium">&ldquo;View reasoning&rdquo;</span> or the confidence badge opens a <span className="text-slate-300 font-medium">trace drawer</span> showing the full decision trace — steps, evidence, rules applied, confidence factors, and limitations.
          </p>
          <p>
            Traces are generated on-demand from live data. They are not persisted separately — re-opening a trace always reflects the current data state.
          </p>
          <p>
            Low-confidence traces should be treated as directional signals only. Always check the Limitations section before acting on any recommendation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/assistant" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
            AI Assistant →
          </Link>
          <Link href="/optimization" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
            Optimization →
          </Link>
          <Link href="/experiments" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
            Experiments →
          </Link>
          <Link href="/creative-lab" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
            Creative Lab →
          </Link>
          <Link href="/docs/decision-trace" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
            Setup docs →
          </Link>
        </div>
      </div>
    </div>
  );
}
