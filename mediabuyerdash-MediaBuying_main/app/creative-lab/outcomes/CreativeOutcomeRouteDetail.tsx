"use client";

// app/creative-lab/outcomes/CreativeOutcomeRouteDetail.tsx
// Full detail panel for a selected outcome route.
// Shows route decision, reasons, evidence, extracted learning, and action controls.

import Link from "next/link";
import type { CreativeOutcomeRoute } from "../../../types/creativeOutcomeRouting";
import {
  ROUTE_TYPE_LABEL,
  ROUTE_TYPE_COLOR,
  ROUTE_TYPE_BG,
  READINESS_STATE_LABEL,
  READINESS_STATE_COLOR,
} from "../../../types/creativeOutcomeRouting";
import { SectionCard } from "../../../components/ui";

type Props = {
  route:        CreativeOutcomeRoute;
  pending:      boolean;
  onAction:     (id: string, readinessState: string, note?: string) => Promise<void>;
};

export function CreativeOutcomeRouteDetail({ route, pending, onAction }: Props) {
  const liftStr = route.primaryLift != null
    ? `${route.primaryLift > 0 ? "+" : ""}${(route.primaryLift * 100).toFixed(1)}%`
    : "—";

  const confPct = route.confidenceScore != null
    ? `${(route.confidenceScore * 100).toFixed(0)}%`
    : "—";

  const isActioned  = route.readinessState === "actioned";
  const isArchived  = route.readinessState === "archived";
  const isLearning  = route.readinessState === "learning_captured";
  const isPending   = route.readinessState === "pending_action";

  return (
    <div className="space-y-5">
      {/* Route header */}
      <div className={`rounded-xl border p-4 ${ROUTE_TYPE_BG[route.routeType]}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className={`text-sm font-bold ${ROUTE_TYPE_COLOR[route.routeType]}`}>
              {ROUTE_TYPE_LABEL[route.routeType]}
            </span>
            <p className="mt-0.5 text-xs text-slate-400">{route.nextActionHint}</p>
          </div>
          <span className={`text-xs font-medium ${READINESS_STATE_COLOR[route.readinessState]}`}>
            {READINESS_STATE_LABEL[route.readinessState]}
          </span>
        </div>

        {/* Metrics row */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-slate-500">Lift </span>
            <span className={route.primaryLift != null && route.primaryLift > 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {liftStr}
            </span>
            {route.primaryMetric && (
              <span className="ml-1 text-slate-500">on {route.primaryMetric.replace(/_/g, " ")}</span>
            )}
          </div>
          <div>
            <span className="text-slate-500">Confidence </span>
            <span className="text-slate-200 font-semibold">{confPct}</span>
            {route.confidenceLevel && (
              <span className="ml-1 text-slate-500">({route.confidenceLevel})</span>
            )}
          </div>
        </div>

        {/* Creative names */}
        <div className="mt-3 text-xs text-slate-400">
          <span className="font-medium text-slate-300">{route.challengerVariantTitle ?? "Challenger"}</span>
          <span className="text-slate-600"> vs </span>
          <span>{route.controlCreativeName ?? "Control"}</span>
          {route.campaignName && (
            <span className="ml-2 text-slate-500">· {route.campaignName}</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {isPending && (
        <SectionCard title="Next Action">
          <div className="flex flex-wrap gap-2">
            {route.linkedWorkflow && (
              <Link
                href={route.linkedWorkflow}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                  hover:bg-indigo-500 transition-colors"
              >
                {route.nextActionLabel} →
              </Link>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => onAction(route.id, "actioned")}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Mark Actioned
            </button>
            {(route.routeType === "capture_learning_only" || route.learning) && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onAction(route.id, "learning_captured")}
                className="rounded-lg border border-indigo-800/60 bg-indigo-950/40 px-4 py-2
                  text-sm font-medium text-indigo-300 hover:bg-indigo-900/40 transition-colors
                  disabled:opacity-50"
              >
                Save Learning
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => onAction(route.id, "archived")}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm
                font-medium text-slate-500 hover:text-slate-400 transition-colors disabled:opacity-50"
            >
              Archive
            </button>
          </div>
        </SectionCard>
      )}

      {(isActioned || isArchived || isLearning) && (
        <SectionCard title="Status">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${READINESS_STATE_COLOR[route.readinessState]}`}>
              {READINESS_STATE_LABEL[route.readinessState]}
            </span>
            {isPending ? null : (
              <button
                type="button"
                disabled={pending}
                onClick={() => onAction(route.id, "pending_action")}
                className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                Reopen
              </button>
            )}
          </div>
          {route.actionNote && (
            <p className="mt-1 text-xs text-slate-400">{route.actionNote}</p>
          )}
          {route.actionedAt && (
            <p className="mt-0.5 text-xs text-slate-500">
              Actioned {new Date(route.actionedAt).toLocaleDateString()}
              {route.actionedBy ? ` by ${route.actionedBy}` : ""}
            </p>
          )}
        </SectionCard>
      )}

      {/* Reasons */}
      <SectionCard title="Route Decision">
        <div className="space-y-2">
          {route.reasons.map((r) => (
            <div
              key={r.key}
              className={[
                "rounded-lg border px-3 py-2 text-xs",
                r.isBlocker
                  ? "border-rose-800/40 bg-rose-950/30"
                  : "border-slate-800/60 bg-slate-900/30",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5">
                {r.isBlocker && (
                  <span className="text-rose-400">⚠</span>
                )}
                <span className="font-medium text-slate-300">{r.label}</span>
              </div>
              <p className="mt-0.5 text-slate-400">{r.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Learning */}
      {route.learning && (
        <SectionCard title="Extracted Learning">
          <div className="space-y-3 text-xs">
            {route.learning.extractionConfidence !== "high" && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2">
                <span className="text-amber-400 font-medium">
                  Extraction confidence: {route.learning.extractionConfidence}
                </span>
                {route.learning.extractionConfidence === "low" && (
                  <span className="ml-1 text-amber-500">— treat as directional only</span>
                )}
              </div>
            )}

            {route.learning.winningPattern && (
              <div>
                <p className="text-slate-500 mb-0.5">Winning pattern</p>
                <p className="text-emerald-300">{route.learning.winningPattern}</p>
              </div>
            )}

            {route.learning.losingPattern && (
              <div>
                <p className="text-slate-500 mb-0.5">Losing pattern</p>
                <p className="text-rose-300">{route.learning.losingPattern}</p>
              </div>
            )}

            {route.learning.iterationHints.length > 0 && (
              <div>
                <p className="text-slate-500 mb-1">Iteration hints</p>
                <ul className="space-y-1">
                  {route.learning.iterationHints.map((hint, i) => (
                    <li key={i} className="flex gap-1.5 text-slate-300">
                      <span className="shrink-0 text-indigo-500">→</span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {route.learning.briefAdjustments.length > 0 && (
              <div>
                <p className="text-slate-500 mb-1">Brief adjustments</p>
                <ul className="space-y-1">
                  {route.learning.briefAdjustments.map((adj, i) => (
                    <li key={i} className="flex gap-1.5 text-slate-300">
                      <span className="shrink-0 text-amber-500">✎</span>
                      {adj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {route.learning.avoidList.length > 0 && (
              <div>
                <p className="text-slate-500 mb-1">Avoid</p>
                <ul className="space-y-1">
                  {route.learning.avoidList.map((item, i) => (
                    <li key={i} className="flex gap-1.5 text-rose-400">
                      <span className="shrink-0">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Evidence */}
      <SectionCard title="Evidence">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          {Object.entries(route.evidence)
            .filter(([, v]) => v !== null && v !== undefined && !Array.isArray(v) && typeof v !== "object")
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
                <dd className="font-medium text-slate-300">{String(v)}</dd>
              </div>
            ))}
        </dl>
        {(route.evidence.guardrailBreaches as string[] | undefined)?.length ? (
          <div className="mt-3">
            <p className="mb-1 text-xs text-slate-500">Guardrail breaches</p>
            <ul className="space-y-1">
              {(route.evidence.guardrailBreaches as string[]).map((b, i) => (
                <li key={i} className="text-xs text-rose-400">⚠ {b}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      {/* Back-links */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-1">
        {route.linkedWorkflow && (
          <Link href={route.linkedWorkflow} className="hover:text-slate-300 transition-colors">
            {route.nextActionLabel} →
          </Link>
        )}
        <Link
          href={`/creative-lab/results?highlight=${route.testResultId}`}
          className="hover:text-slate-300 transition-colors"
        >
          View Test Result
        </Link>
        {route.experimentId && (
          <Link
            href={`/experiments?highlight=${route.experimentId}`}
            className="hover:text-slate-300 transition-colors"
          >
            Experiment →
          </Link>
        )}
      </div>
    </div>
  );
}
