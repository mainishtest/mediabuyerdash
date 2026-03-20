"use client";

// app/creative-lab/launch/LaunchPlanDetail.tsx
// Full detail panel for a single experiment launch plan.
//
// Responsive design:
//   Mobile:  stacked sections — variant summary → mapping → criteria → guardrails
//   Desktop: same sections but richer, side-by-side control/challenger comparison

import { useState } from "react";
import type { CreativeExperimentLaunchPlan } from "../../../types/experimentLaunch";
import {
  READINESS_STATE_LABEL,
  READINESS_STATE_COLOR,
  READINESS_STATE_BG,
  PRIMARY_METRIC_OPTIONS,
} from "../../../types/experimentLaunch";
import { SectionCard } from "../../../components/ui/SectionCard";
import { ActionButton } from "../../../components/ui/ActionButton";

type Props = {
  plan:       CreativeExperimentLaunchPlan;
  onUpdate:   (id: string, patch: Record<string, unknown>) => Promise<void>;
  onRefresh?: () => void;
  pending?:   boolean;
};

// ---------------------------------------------------------------------------
// Readiness badge
// ---------------------------------------------------------------------------

function ReadinessBadge({ state }: { state: CreativeExperimentLaunchPlan["readiness"]["state"] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium
      ${READINESS_STATE_BG[state]} ${READINESS_STATE_COLOR[state]}`}>
      {READINESS_STATE_LABEL[state]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Guardrail row
// ---------------------------------------------------------------------------

function GuardrailRow({ g }: { g: CreativeExperimentLaunchPlan["guardrails"][number] }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/40 last:border-0">
      <span className={`mt-0.5 shrink-0 text-base leading-none ${g.passed ? "text-emerald-400" : g.required ? "text-rose-400" : "text-amber-400"}`}>
        {g.passed ? "✓" : "✗"}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{g.label}</p>
        <p className="mt-0.5 text-xs text-slate-400">{g.message}</p>
      </div>
      {!g.required && !g.passed && (
        <span className="shrink-0 rounded-full border border-amber-700/40 bg-amber-950/20 px-2 py-0.5 text-[11px] text-amber-400">
          warning
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant panel (control or challenger)
// ---------------------------------------------------------------------------

function VariantPanel({
  label,
  colorClass,
  borderClass,
  name,
  type,
  subtext,
  meta,
}: {
  label:       string;
  colorClass:  string;
  borderClass: string;
  name:        string;
  type?:       string | null;
  subtext?:    string | null;
  meta?:       string | null;
}) {
  return (
    <div className={`rounded-xl border ${borderClass} p-4`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${colorClass}`}>{label}</p>
      <p className="mt-1.5 text-sm font-medium text-white">{name}</p>
      {type && (
        <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
          {type}
        </span>
      )}
      {subtext && <p className="mt-1.5 text-xs text-slate-400">{subtext}</p>}
      {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main detail panel
// ---------------------------------------------------------------------------

export function LaunchPlanDetail({ plan, onUpdate, pending = false }: Props) {
  const [criteriaOpen,  setCriteriaOpen]  = useState(false);
  const [guardrailsOpen, setGuardrailsOpen] = useState(false);

  // Stub notice for flows not yet implemented in this UI.
  const notImplemented = (label: string) => () => {
    // eslint-disable-next-line no-console
    console.warn(`[LaunchPlanDetail] "${label}" flow not yet implemented.`);
  };

  const { readiness, successCriteria, guardrails, control, challenger, mapping } = plan;

  const primaryMetricLabel = PRIMARY_METRIC_OPTIONS.find((m) => m.key === successCriteria.primaryMetric)?.label
    ?? successCriteria.primaryMetric;

  const challengerName = challenger.variantTitle ?? challenger.label;
  const controlName    = control.creativeName    ?? control.label;

  const handleAssignControl = notImplemented("Select Control Creative");

  const handleApprove = () => {
    onUpdate(plan.id, { approve: true });
  };

  const handleMarkLaunched = () => {
    // In a real flow, this would open a modal to select or create an experiment ID
    onUpdate(plan.id, {
      markLaunched: { experimentId: `exp_${Date.now()}` },
    });
  };

  const canApprove    = readiness.state === "needs_approval" && !pending;
  const canLaunch     = readiness.state === "ready_for_launch" && !pending;
  const isLaunched    = readiness.state === "launched";
  const needsControl  = !control.creativeId && !control.adExternalId;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{plan.name}</h2>
          {plan.hypothesis && (
            <p className="mt-1 text-sm text-slate-400 italic">&ldquo;{plan.hypothesis}&rdquo;</p>
          )}
        </div>
        <ReadinessBadge state={readiness.state} />
      </div>

      {/* Blockers */}
      {readiness.blockers.length > 0 && (
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 p-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">
            {readiness.blockers.length} Blocker{readiness.blockers.length !== 1 ? "s" : ""}
          </p>
          {readiness.blockers.map((b) => (
            <p key={b.key} className="text-sm text-rose-300">{b.message}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {readiness.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-700/30 bg-amber-950/10 p-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
            {readiness.warnings.length} Warning{readiness.warnings.length !== 1 ? "s" : ""}
          </p>
          {readiness.warnings.map((w) => (
            <p key={w.key} className="text-sm text-amber-300">{w.message}</p>
          ))}
        </div>
      )}

      {/* Next action */}
      {!isLaunched && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
          → {readiness.nextAction}
        </p>
      )}

      {/* Control vs Challenger — stacked on mobile, side-by-side on sm+ */}
      <SectionCard title="Control vs Challenger">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VariantPanel
            label="Challenger"
            colorClass="text-emerald-400"
            borderClass="border-emerald-800/30 bg-emerald-950/20"
            name={challengerName}
            type={challenger.variantType}
            subtext={challenger.briefIntent ?? undefined}
            meta={challenger.clientName ?? challenger.campaignName ?? undefined}
          />
          <VariantPanel
            label="Control"
            colorClass="text-sky-400"
            borderClass={
              needsControl
                ? "border-dashed border-rose-800/40 bg-rose-950/10"
                : "border-sky-800/30 bg-sky-950/20"
            }
            name={needsControl ? "Not assigned" : controlName}
            subtext={
              needsControl
                ? "Select an existing creative as the baseline."
                : control.adExternalId ?? undefined
            }
          />
        </div>

        {/* Action buttons — thumb-friendly min-h-[44px] */}
        <div className="mt-4 flex flex-wrap gap-2">
          {needsControl && (
            <ActionButton
              variant="secondary"
              size="md"
              disabled={pending || isLaunched}
              onClick={handleAssignControl}
            >
              Select Control Creative
            </ActionButton>
          )}
          {challenger.prepItemId && (
            <a
              href={`/creative-lab/publish-prep`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700
                bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Open Source Creative ↗
            </a>
          )}
        </div>
      </SectionCard>

      {/* Campaign / ad set mapping */}
      <SectionCard title="Target Campaign & Ad Set">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Campaign</p>
            <p className="mt-1 text-sm text-white">
              {mapping.campaignName ?? mapping.campaignExternalId ?? (
                <span className="text-rose-400">Not mapped</span>
              )}
            </p>
            {mapping.campaignExternalId && (
              <p className="mt-0.5 text-xs text-slate-500 font-mono">{mapping.campaignExternalId}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Ad Set</p>
            <p className="mt-1 text-sm text-white">
              {mapping.adSetName ?? mapping.adSetExternalId ?? (
                <span className="text-rose-400">Not mapped</span>
              )}
            </p>
            {mapping.adSetExternalId && (
              <p className="mt-0.5 text-xs text-slate-500 font-mono">{mapping.adSetExternalId}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Comparison Mode</p>
            <p className="mt-1 text-sm capitalize text-white">
              {mapping.comparisonMode.replace("_", " ")}
            </p>
          </div>
        </div>

        {mapping.campaignExternalId && (
          <div className="mt-4">
            <a
              href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${mapping.externalAdAccountId ?? ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700
                bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Open Target Campaign ↗
            </a>
          </div>
        )}
      </SectionCard>

      {/* Success criteria — collapsible on mobile */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setCriteriaOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Success Criteria</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {primaryMetricLabel} · ≥{(successCriteria.successThreshold * 100).toFixed(0)}% lift · {successCriteria.evaluationWindowDays}d window
            </p>
          </div>
          <span className="shrink-0 text-slate-500">{criteriaOpen ? "▲" : "▼"}</span>
        </button>

        {criteriaOpen && (
          <div className="border-t border-slate-800/60 px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Primary Metric</p>
                <p className="mt-1 text-sm text-white">{primaryMetricLabel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Success Threshold</p>
                <p className="mt-1 text-sm text-white">
                  +{(successCriteria.successThreshold * 100).toFixed(0)}% lift
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Eval Window</p>
                <p className="mt-1 text-sm text-white">{successCriteria.evaluationWindowDays} days</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Min Spend</p>
                <p className="mt-1 text-sm text-white">${successCriteria.minSpendPerVariant} / variant</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Min Conversions</p>
                <p className="mt-1 text-sm text-white">{successCriteria.minConversionsPerVariant} / variant</p>
              </div>
            </div>
            {successCriteria.secondaryMetrics.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Secondary Metrics</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {successCriteria.secondaryMetrics.map((m) => (
                    <span key={m} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {successCriteria.guardrailMetrics.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Guardrail Metrics</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {successCriteria.guardrailMetrics.map((m) => (
                    <span key={m} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-amber-300">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {successCriteria.hypothesisStatement && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Hypothesis</p>
                <p className="mt-1 text-sm italic text-slate-300">&ldquo;{successCriteria.hypothesisStatement}&rdquo;</p>
              </div>
            )}
            <div className="pt-1">
              <ActionButton
                variant="secondary"
                size="sm"
                disabled={pending || isLaunched}
                onClick={notImplemented("Edit Success Criteria")}
              >
                Edit Success Criteria
              </ActionButton>
            </div>
          </div>
        )}
      </div>

      {/* Guardrails — collapsible on mobile */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setGuardrailsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Guardrails</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {guardrails.filter((g) => g.passed).length}/{guardrails.length} passing
              {guardrails.some((g) => g.required && !g.passed) && (
                <span className="ml-2 text-rose-400">
                  · {guardrails.filter((g) => g.required && !g.passed).length} required failing
                </span>
              )}
            </p>
          </div>
          <span className="shrink-0 text-slate-500">{guardrailsOpen ? "▲" : "▼"}</span>
        </button>

        {guardrailsOpen && (
          <div className="border-t border-slate-800/60 px-5 py-2">
            {guardrails.map((g) => (
              <GuardrailRow key={g.key} g={g} />
            ))}
            <div className="pt-3 pb-2">
              <ActionButton
                variant="secondary"
                size="sm"
                disabled={pending || isLaunched}
                onClick={notImplemented("Edit Guardrails")}
              >
                Edit Guardrails
              </ActionButton>
            </div>
          </div>
        )}
      </div>

      {/* Launch notes */}
      {plan.launchNotes && (
        <SectionCard title="Launch Notes">
          <p className="text-sm text-slate-300">{plan.launchNotes}</p>
        </SectionCard>
      )}

      {/* Approval + launch actions */}
      {!isLaunched && (
        <SectionCard title="Actions">
          <div className="flex flex-wrap gap-3">
            {canApprove && (
              <ActionButton
                variant="primary"
                size="md"
                disabled={pending}
                onClick={handleApprove}
              >
                Mark Ready for Launch
              </ActionButton>
            )}
            {readiness.state === "needs_approval" && (
              <ActionButton
                variant="secondary"
                size="md"
                disabled={pending}
                onClick={notImplemented("Send for Approval")}
              >
                Send for Approval
              </ActionButton>
            )}
            {canLaunch && (
              <ActionButton
                variant="primary"
                size="md"
                disabled={pending}
                onClick={handleMarkLaunched}
              >
                Assign as Challenger →
              </ActionButton>
            )}
            {(readiness.state === "draft" || readiness.state === "needs_mapping") && (
              <ActionButton
                variant="secondary"
                size="md"
                disabled={pending}
                onClick={handleAssignControl}
              >
                Assign as Challenger
              </ActionButton>
            )}
          </div>

          {plan.approvedAt && (
            <p className="mt-3 text-xs text-slate-500">
              Approved {new Date(plan.approvedAt).toLocaleDateString()}
              {plan.approvedBy ? ` by ${plan.approvedBy}` : ""}
            </p>
          )}
        </SectionCard>
      )}

      {/* Linked experiment */}
      {isLaunched && plan.linkedExperimentId && (
        <SectionCard title="Linked Experiment">
          <p className="text-sm text-slate-400">
            This plan is live and linked to experiment{" "}
            <span className="font-mono text-slate-300">{plan.linkedExperimentId}</span>.
          </p>
          <div className="mt-3">
            <a
              href={`/experiments`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700
                bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              View Experiment Results ↗
            </a>
          </div>
        </SectionCard>
      )}

      {/* Lineage trail */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800/40 pt-4 text-xs text-slate-500">
        {plan.prepItemId && (
          <a href="/creative-lab/publish-prep" className="hover:text-slate-300 transition-colors">
            ← Publish Prep
          </a>
        )}
        {plan.briefId && (
          <a href="/creative-lab/briefs" className="hover:text-slate-300 transition-colors">
            Source Brief
          </a>
        )}
        {plan.linkedExperimentId && (
          <a href="/experiments" className="hover:text-slate-300 transition-colors">
            Experiment Results →
          </a>
        )}
      </div>
    </div>
  );
}
