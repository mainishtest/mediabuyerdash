"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { StatCard }     from "../../../../components/ui/StatCard";
import {
  createExperimentLaunchPlanAction,
  loadApprovedRequestsAction,
  loadExperimentLaunchPlansAction,
} from "../actions";
import type { CreativeExperimentLaunchPlan } from "../../../../types/experimentLaunch";
import {
  READINESS_STATE_LABEL,
  READINESS_STATE_BG,
} from "../../../../types/experimentLaunch";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApprovedRequest {
  id:              string;
  variationIntent: string;
  triggerType:     string;
  status:          string;
  approvedCount:   number;
  totalCount:      number;
  createdAt:       string;
  clientName:      string | null;
}

interface Props {
  initialPlans: CreativeExperimentLaunchPlan[];
}

// ---------------------------------------------------------------------------
// Readiness badge
// ---------------------------------------------------------------------------

function readinessBadge(state: string) {
  const label = READINESS_STATE_LABEL[state as keyof typeof READINESS_STATE_LABEL] ?? state;
  const variant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
    draft:            "neutral",
    needs_mapping:    "warning",
    needs_approval:   "warning",
    ready_for_launch: "success",
    blocked:          "danger",
    launched:         "success",
  };
  return <Badge variant={variant[state] ?? "neutral"}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageVariationLaunchView({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [approvedRequests, setApprovedRequests] = useState<ApprovedRequest[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createPending, startCreate] = useTransition();
  const [loadPending, startLoad] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Create form state
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [controlName, setControlName] = useState("");
  const [hypothesis, setHypothesis] = useState("");

  // Load approved requests for creation
  function handleShowCreate() {
    setShowCreateForm(true);
    startLoad(async () => {
      const reqs = await loadApprovedRequestsAction();
      setApprovedRequests(reqs);
    });
  }

  function handleCreate() {
    if (!selectedRequestId || !selectedCandidateId) {
      setActionMsg("Error: Select a request and candidate.");
      return;
    }
    setActionMsg(null);
    startCreate(async () => {
      const r = await createExperimentLaunchPlanAction(
        selectedRequestId,
        selectedCandidateId,
        undefined,
        controlName || undefined,
        hypothesis || undefined,
      );
      if (r.ok) {
        setActionMsg("Experiment launch plan created.");
        setShowCreateForm(false);
        setSelectedRequestId("");
        setSelectedCandidateId("");
        setControlName("");
        setHypothesis("");
        // Refresh plans
        const updated = await loadExperimentLaunchPlansAction();
        setPlans(updated);
      } else {
        setActionMsg(`Error: ${r.error}`);
      }
    });
  }

  // Stats
  const totalPlans = plans.length;
  const readyCount = plans.filter((p) => p.readiness.state === "ready_for_launch").length;
  const needsMapping = plans.filter((p) => p.readiness.state === "needs_mapping").length;
  const blockedCount = plans.filter((p) => p.readiness.state === "blocked").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/creative-lab" className="hover:text-slate-300">Creative Lab</Link>
        <span>/</span>
        <Link href="/creative-lab/image-variations" className="hover:text-slate-300">Image Variations</Link>
        <span>/</span>
        <span className="text-slate-400">Experiment Launch</span>
      </nav>

      <PageHeader
        title="Image Variation Experiment Launch"
        description="Wire approved image variations into structured experiments with controls, success criteria, and guardrails."
      />

      {/* Action message */}
      {actionMsg && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          actionMsg.startsWith("Error")
            ? "border-red-800 bg-red-950/40 text-red-400"
            : "border-emerald-700 bg-emerald-950/40 text-emerald-300"
        }`}>
          {actionMsg}
        </div>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Launch Plans"  value={String(totalPlans)} />
        <StatCard label="Ready"         value={String(readyCount)} />
        <StatCard label="Needs Mapping" value={String(needsMapping)} />
        <StatCard label="Blocked"       value={String(blockedCount)} />
      </section>

      {/* Create new plan */}
      <SectionCard
        title="Create Launch Plan"
        actions={
          !showCreateForm ? (
            <ActionButton variant="primary" size="sm" onClick={handleShowCreate}>
              New Launch Plan
            </ActionButton>
          ) : undefined
        }
      >
        {!showCreateForm && (
          <p className="text-xs text-slate-500">
            Select an approved image variation candidate to wire into an experiment.
          </p>
        )}

        {showCreateForm && (
          <div className="space-y-4">
            {loadPending && <p className="text-xs text-slate-400">Loading approved candidates...</p>}

            {!loadPending && approvedRequests.length === 0 && (
              <p className="text-xs text-slate-500">
                No approved image variation candidates found. Approve candidates in the
                {" "}<Link href="/creative-lab/image-variations/review" className="text-emerald-500 hover:text-emerald-400">review queue</Link> first.
              </p>
            )}

            {!loadPending && approvedRequests.length > 0 && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Source Request</label>
                    <select
                      value={selectedRequestId}
                      onChange={(e) => { setSelectedRequestId(e.target.value); setSelectedCandidateId(e.target.value ? "first" : ""); }}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200
                        focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">Select request...</option>
                      {approvedRequests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.variationIntent} — {r.clientName ?? "Unknown"} ({r.approvedCount} approved)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Control Creative Name</label>
                    <input
                      type="text"
                      value={controlName}
                      onChange={(e) => setControlName(e.target.value)}
                      placeholder="Current creative name (optional)"
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200
                        placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Hypothesis</label>
                  <textarea
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                    placeholder="What do you expect this test to show? (auto-generated if blank)"
                    rows={2}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200
                      placeholder-slate-600 focus:border-emerald-600 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <ActionButton variant="primary" size="sm" disabled={createPending || !selectedRequestId} onClick={handleCreate}>
                    Create Plan
                  </ActionButton>
                  <ActionButton variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </ActionButton>
                </div>
              </>
            )}
          </div>
        )}
      </SectionCard>

      {/* Existing plans */}
      {plans.length === 0 && !showCreateForm && (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500">No image variation experiment plans yet.</p>
            <p className="mt-2 text-xs text-slate-600">
              Create a launch plan from an approved image variation candidate.
            </p>
          </div>
        </SectionCard>
      )}

      {plans.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Launch Plans
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <LaunchPlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/creative-lab/image-variations/results" className="text-xs text-emerald-500 hover:text-emerald-400">
          View Results →
        </Link>
        <Link href="/creative-lab/image-variations/selection" className="text-xs text-slate-500 hover:text-slate-300">
          ← Selection
        </Link>
        <Link href="/creative-lab/image-variations/review" className="text-xs text-slate-500 hover:text-slate-300">
          ← Review Queue
        </Link>
        <Link href="/experiments" className="text-xs text-slate-500 hover:text-slate-300">
          All Experiments →
        </Link>
        <Link href="/creative-lab" className="ml-auto text-xs text-slate-500 hover:text-slate-300">
          ← Back to Creative Lab
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Launch plan card
// ---------------------------------------------------------------------------

function LaunchPlanCard({ plan }: { plan: CreativeExperimentLaunchPlan }) {
  const [expanded, setExpanded] = useState(false);
  const bgClass = READINESS_STATE_BG[plan.readiness.state] ?? "border-slate-800 bg-slate-900/40";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${bgClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white leading-tight truncate">{plan.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            {plan.challenger.clientName ?? "—"} · {new Date(plan.createdAt).toLocaleDateString()}
          </p>
        </div>
        {readinessBadge(plan.readiness.state)}
      </div>

      {/* Control vs Challenger */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
          <p className="text-xs font-medium text-slate-500 mb-0.5">Control</p>
          <p className="text-xs text-slate-300 truncate">
            {plan.control.creativeName ?? "Not assigned"}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2">
          <p className="text-xs font-medium text-emerald-500 mb-0.5">Challenger</p>
          <p className="text-xs text-slate-300 truncate">
            {plan.challenger.variantTitle ?? plan.challenger.creativeName ?? "Not assigned"}
          </p>
        </div>
      </div>

      {/* Hypothesis */}
      {plan.hypothesis && (
        <div className="rounded-lg bg-slate-800/40 px-3 py-2">
          <p className="text-xs text-slate-500 mb-0.5">Hypothesis</p>
          <p className={`text-xs text-slate-400 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}>
            {plan.hypothesis}
          </p>
        </div>
      )}

      {/* Success criteria summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
          {plan.successCriteria.primaryMetric}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
          ≥{(plan.successCriteria.successThreshold * 100).toFixed(0)}% lift
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
          {plan.successCriteria.evaluationWindowDays}d window
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
          ${plan.successCriteria.minSpendPerVariant} min spend
        </span>
      </div>

      {/* Expanded: guardrails + blockers */}
      {expanded && (
        <>
          {/* Guardrails */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Guardrails</p>
            {plan.guardrails.map((g) => (
              <div key={g.key} className="flex items-center gap-2 text-xs">
                <span className={g.passed ? "text-emerald-400" : g.required ? "text-rose-400" : "text-amber-400"}>
                  {g.passed ? "✓" : g.required ? "✗" : "◐"}
                </span>
                <span className="text-slate-400">{g.label}</span>
              </div>
            ))}
          </div>

          {/* Blockers */}
          {plan.readiness.blockers.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-rose-400">Blockers</p>
              {plan.readiness.blockers.map((b) => (
                <p key={b.key} className="text-xs text-slate-400">{b.message}</p>
              ))}
            </div>
          )}

          {/* Warnings */}
          {plan.readiness.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-400">Warnings</p>
              {plan.readiness.warnings.map((w) => (
                <p key={w.key} className="text-xs text-slate-400">{w.message}</p>
              ))}
            </div>
          )}

          {/* Mapping */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Target Mapping</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <dt className="text-slate-600">Campaign</dt>
                <dd className="text-slate-300">{plan.mapping.campaignName ?? "Not mapped"}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Ad Set</dt>
                <dd className="text-slate-300">{plan.mapping.adSetName ?? "Not mapped"}</dd>
              </div>
            </dl>
          </div>

          {/* Launch notes */}
          {plan.launchNotes && (
            <div className="rounded-lg bg-slate-800/30 px-3 py-2">
              <p className="text-xs text-slate-500 mb-0.5">Launch Notes</p>
              <p className="text-xs text-slate-400 whitespace-pre-line">{plan.launchNotes}</p>
            </div>
          )}
        </>
      )}

      {/* Next action */}
      <p className="text-xs text-slate-500">{plan.readiness.nextAction}</p>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-emerald-500 hover:text-emerald-400"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
        {plan.readiness.state === "ready_for_launch" && (
          <Badge variant="success">Ready</Badge>
        )}
        {plan.linkedExperimentId && (
          <Link
            href="/experiments"
            className="text-xs text-violet-400 hover:text-violet-300"
          >
            View Experiment →
          </Link>
        )}
      </div>
    </div>
  );
}
