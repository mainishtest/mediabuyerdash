"use client";

// app/clients/[clientId]/campaigns/CampaignPerformanceView.tsx
// Campaign-level live performance view.
// Mobile:  stacked cards, 2-col summary grid, thumb-friendly filters.
// Desktop: 4-col summary row, full table with all metric columns.
// Inline goal editing: click "Edit goal" / "Add goal" to set ROAS + CPA without
// navigating to the campaign detail page. Bulk mode: select campaigns → apply one goal.

import { useState, useMemo, useTransition, Fragment, useCallback } from "react";
import Link from "next/link";
import { StatCard }   from "../../../../components/ui/StatCard";
import { SectionCard } from "../../../../components/ui/SectionCard";
import { EmptyState }  from "../../../../components/ui/EmptyState";
import { Badge }       from "../../../../components/ui/Badge";
import type { BadgeVariant } from "../../../../components/ui/Badge";
import { countCampaignsByHealthStatus }  from "../../../../lib/campaignPerformance/evaluator";
import { buildOpportunityRiskSummary }   from "../../../../lib/campaignPerformance/recommendations";
import type {
  CampaignPerformanceSnapshot,
  CampaignHealthStatus,
  CampaignActionType,
  GoalSource,
} from "../../../../lib/campaignPerformance/types";
import { SparkLine }   from "../../../../components/charts/SparkLine";
import { TrendChart }  from "../../../../components/charts/TrendChart";
import type { SparkPoint, DailyPoint } from "../../../../lib/charts/dataService";

// ── Local types ───────────────────────────────────────────────────────────────

type GoalData = {
  roasGoalValue: number;
  cpaGoalValue:  number;
};

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:    string;
  clientName:  string;
  currency:    string;
  snapshots:   CampaignPerformanceSnapshot[];
  sparklines:  Record<string, SparkPoint[]>;
  clientDaily: DailyPoint[];
};

// ── Format helpers ────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n === 0) return "—";
  return n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${n.toFixed(2)}`;
}
function fmtRoas(n: number): string { return n === 0 ? "—" : `${n.toFixed(2)}x`; }
function fmtCpa(n: number): string  { return n === 0 ? "—" : `$${n.toFixed(2)}`;  }
function fmtNum(n: number): string  { return n === 0 ? "—" : String(n); }

// ── Health / action badge styles ──────────────────────────────────────────────

const HEALTH_COLORS: Record<CampaignHealthStatus, string> = {
  strong:     "bg-emerald-800/60 text-emerald-300",
  on_target:  "bg-emerald-900/40 text-emerald-400",
  watch:      "bg-amber-900/40 text-amber-300",
  below_goal: "bg-rose-900/50 text-rose-300",
  no_goal:    "bg-slate-800 text-slate-400",
  stale:      "bg-slate-800 text-slate-500",
  no_data:    "bg-slate-800 text-slate-600",
};

const HEALTH_LABELS: Record<CampaignHealthStatus, string> = {
  strong:     "Strong",
  on_target:  "On Target",
  watch:      "Watch",
  below_goal: "Below Goal",
  no_goal:    "No Goal",
  stale:      "Stale",
  no_data:    "No Data",
};

const ACTION_COLORS: Record<CampaignActionType, string> = {
  scale:        "bg-emerald-800/60 text-emerald-300",
  maintain:     "bg-emerald-900/40 text-emerald-400",
  review:       "bg-amber-900/40 text-amber-300",
  reduce_spend: "bg-rose-900/50 text-rose-300",
  watch:        "bg-amber-900/30 text-amber-400",
  set_goal:     "bg-slate-800 text-slate-400",
  sync_now:     "bg-slate-800 text-slate-500",
};

function HealthChip({ status }: { status: CampaignHealthStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_COLORS[status]}`}>
      {HEALTH_LABELS[status]}
    </span>
  );
}

function ActionChip({ action }: { action: CampaignActionType }) {
  const label = action.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[action]}`}>
      {label}
    </span>
  );
}

function GoalStatusChip({ hasGoal }: { hasGoal: boolean }) {
  if (hasGoal) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-900/40 text-emerald-400">
        Goal set
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-900/40 text-amber-400">
      Missing goal
    </span>
  );
}

// Shows where the active goal came from — always shown alongside GoalStatusChip
function GoalSourceChip({ source }: { source: GoalSource }) {
  if (source === "explicit") {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-900/20 text-emerald-500 border border-emerald-900/40">
        Explicit
      </span>
    );
  }
  if (source === "client_default") {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-900/30 text-indigo-400 border border-indigo-900/40">
        Client default
      </span>
    );
  }
  return null;
}

function statusBadgeVariant(s: string): BadgeVariant {
  if (s === "ACTIVE") return "success";
  if (s === "PAUSED") return "warning";
  return "neutral";
}

// ── Goal delta indicator ──────────────────────────────────────────────────────

function GoalDelta({
  actual,
  goal,
  higherIsBetter,
}: {
  actual: number;
  goal:   number | null;
  higherIsBetter: boolean;
}) {
  if (!goal || actual === 0) return <span className="text-slate-600">—</span>;
  const pct  = ((actual - goal) / goal) * 100;
  const good = higherIsBetter ? pct >= 0 : pct <= 0;
  const sign = pct >= 0 ? "+" : "";
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-400" : "text-rose-400"}`}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

// ── Inline goal form ──────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm " +
  "text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 " +
  "focus:ring-emerald-500 min-h-[40px]";

function InlineGoalForm({
  externalCampaignId,
  currentRoas,
  currentCpa,
  onSave,
  onCancel,
}: {
  externalCampaignId: string;
  currentRoas:        number | null;
  currentCpa:         number | null;
  onSave:             (goal: GoalData) => void;
  onCancel:           () => void;
}) {
  const [roasValue, setRoasValue] = useState(currentRoas ? String(currentRoas) : "");
  const [cpaValue,  setCpaValue]  = useState(currentCpa  ? String(currentCpa)  : "");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const roas = parseFloat(roasValue);
    const cpa  = parseFloat(cpaValue);

    if (!isFinite(roas) || roas <= 0) {
      setError("ROAS goal must be a positive number (e.g. 2.5)");
      return;
    }
    if (!isFinite(cpa) || cpa <= 0) {
      setError("CPA goal must be a positive number (e.g. 45.00)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${externalCampaignId}/goal`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          roasGoalType:  "high",
          roasGoalValue: roas,
          cpaGoalType:   "low",
          cpaGoalValue:  cpa,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save goal");
        return;
      }
      onSave({ roasGoalValue: roas, cpaGoalValue: cpa });
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
        Set Campaign Goals
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">ROAS Target (exceed)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="e.g. 2.50"
            value={roasValue}
            onChange={(e) => setRoasValue(e.target.value)}
            className={INPUT_CLS}
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">CPA Target (stay under $)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="e.g. 45.00"
            value={cpaValue}
            onChange={(e) => setCpaValue(e.target.value)}
            className={INPUT_CLS}
            disabled={saving}
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-rose-400">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 min-h-[36px]"
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors min-h-[36px]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Bulk goal panel ───────────────────────────────────────────────────────────

function BulkGoalPanel({
  selectedCount,
  onApply,
  onClear,
}: {
  selectedCount: number;
  onApply:       (roas: number, cpa: number) => void;
  onClear:       () => void;
}) {
  const [roasValue, setRoasValue] = useState("");
  const [cpaValue,  setCpaValue]  = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleApply() {
    setError(null);
    const roas = parseFloat(roasValue);
    const cpa  = parseFloat(cpaValue);
    if (!isFinite(roas) || roas <= 0) { setError("Enter a valid ROAS target"); return; }
    if (!isFinite(cpa)  || cpa  <= 0) { setError("Enter a valid CPA target");  return; }
    startTransition(() => onApply(roas, cpa));
  }

  return (
    <div className="mb-4 rounded-xl border border-indigo-900/60 bg-indigo-950/30 px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-indigo-300 mb-2">
            Bulk goal — {selectedCount} campaign{selectedCount !== 1 ? "s" : ""} selected
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">ROAS</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 2.5"
                value={roasValue}
                onChange={(e) => setRoasValue(e.target.value)}
                className="w-28 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">CPA ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 45"
                value={cpaValue}
                onChange={(e) => setCpaValue(e.target.value)}
                className="w-28 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[40px]"
              />
            </div>
            <button
              onClick={handleApply}
              className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 min-h-[40px]"
            >
              Apply to {selectedCount}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}

// ── Missing Goals Banner ──────────────────────────────────────────────────────

function MissingGoalsBanner({
  missingCount,
  totalCount,
  clientId,
  onFilterMissing,
}: {
  missingCount:    number;
  totalCount:      number;
  clientId:        string;
  onFilterMissing: () => void;
}) {
  if (missingCount === 0) return null;

  if (missingCount === totalCount) {
    return (
      <div className="mb-5 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-300">
            No campaigns have goals set
          </p>
          <p className="mt-0.5 text-xs text-amber-600">
            {totalCount} campaign{totalCount !== 1 ? "s" : ""} imported · set per-campaign goals inline, or{" "}
            <Link href={`/clients/${clientId}/settings`} className="underline underline-offset-2 hover:text-amber-400">
              configure client defaults
            </Link>{" "}
            as a fallback for all campaigns
          </p>
        </div>
        <button
          onClick={onFilterMissing}
          className="text-xs text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2"
        >
          View campaigns →
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-amber-300">
          {missingCount} campaign{missingCount !== 1 ? "s" : ""} missing goals
        </p>
        <p className="mt-0.5 text-xs text-amber-600">
          {totalCount - missingCount} of {totalCount} have goals · click &ldquo;Add goal&rdquo; inline or{" "}
            <Link href={`/clients/${clientId}/settings`} className="underline underline-offset-2 hover:text-amber-400">
              set client defaults
            </Link>
        </p>
      </div>
      <button
        onClick={onFilterMissing}
        className="text-xs text-amber-400 hover:text-amber-200 transition-colors underline underline-offset-2"
      >
        Show missing →
      </button>
    </div>
  );
}

// ── Mobile campaign card ──────────────────────────────────────────────────────

function CampaignCard({
  s,
  clientId,
  sparkData,
  isEditing,
  isSelected,
  goalOverride,
  onEdit,
  onCancel,
  onGoalSaved,
  onToggleSelect,
}: {
  s:              CampaignPerformanceSnapshot;
  clientId:       string;
  sparkData:      SparkPoint[];
  isEditing:      boolean;
  isSelected:     boolean;
  goalOverride:   GoalData | undefined;
  onEdit:         () => void;
  onCancel:       () => void;
  onGoalSaved:    (goal: GoalData) => void;
  onToggleSelect: () => void;
}) {
  const hasGoal      = goalOverride !== undefined || s.hasGoal;
  const roasGoal     = goalOverride?.roasGoalValue ?? s.roasGoalValue;
  const cpaGoal      = goalOverride?.cpaGoalValue  ?? s.cpaGoalValue;

  return (
    <div className={`rounded-xl border bg-slate-900/60 p-4 space-y-3 transition-colors ${
      isSelected ? "border-indigo-700" : "border-slate-800"
    }`}>
      {/* Name + statuses + checkbox */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-700 accent-indigo-500 cursor-pointer"
          />
          <Link
            href={`/clients/${clientId}/campaigns/${s.externalCampaignId}`}
            className="text-sm font-semibold text-slate-100 leading-tight hover:text-emerald-400 transition-colors"
          >
            {s.campaignName}
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant={statusBadgeVariant(s.campaignStatus)}>
            {s.campaignStatus}
          </Badge>
          <HealthChip status={s.healthStatus} />
        </div>
      </div>

      {/* Goal status + source + edit trigger */}
      <div className="flex items-center gap-2 flex-wrap">
        <GoalStatusChip hasGoal={hasGoal} />
        {hasGoal && <GoalSourceChip source={goalOverride ? "explicit" : s.goalSource} />}
        {hasGoal && roasGoal && (
          <span className="text-xs text-slate-500">
            ROAS {roasGoal.toFixed(2)}x · CPA ${cpaGoal?.toFixed(2) ?? "—"}
          </span>
        )}
        <button
          onClick={isEditing ? onCancel : onEdit}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          {isEditing ? "Cancel" : hasGoal ? "Edit goal" : "Add goal"}
        </button>
      </div>

      {/* Inline goal form */}
      {isEditing && (
        <InlineGoalForm
          externalCampaignId={s.externalCampaignId}
          currentRoas={roasGoal ?? null}
          currentCpa={cpaGoal ?? null}
          onSave={(goal) => { onGoalSaved(goal); }}
          onCancel={onCancel}
        />
      )}

      {/* Spend sparkline */}
      {!isEditing && sparkData.length > 1 && (
        <div className="flex items-center gap-2">
          <SparkLine data={sparkData} />
          <span className="text-xs text-slate-600">30d spend trend</span>
        </div>
      )}

      {/* Key metrics — 2-column */}
      {!isEditing && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-800/30 p-3">
          {[
            { label: "Spend",    value: fmt$(s.metaSpend) },
            { label: "CRM Rev",  value: fmt$(s.crmRevenue) },
            { label: "Orders",   value: fmtNum(s.crmOrders) },
            { label: "ROAS",     value: fmtRoas(s.evaluatedRoas) },
            { label: "CPA",      value: fmtCpa(s.evaluatedCpa) },
            { label: "vs Goal",  value: roasGoal ? (
              <span className="text-xs">
                <GoalDelta actual={s.evaluatedRoas} goal={roasGoal} higherIsBetter />
              </span>
            ) : <span className="text-slate-600 text-xs">No goal</span> },
          ].map((m) => (
            <div key={m.label}>
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className="text-sm font-medium text-slate-200">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      {!isEditing && (
        <div className="flex items-start gap-2">
          <ActionChip action={s.recommendation.actionType} />
          <p className="text-xs text-slate-400 leading-relaxed">{s.recommendation.reason}</p>
        </div>
      )}

      {!isEditing && s.recommendation.supportingMetrics && (
        <p className="text-xs text-slate-600">{s.recommendation.supportingMetrics}</p>
      )}
    </div>
  );
}

// ── Desktop table ─────────────────────────────────────────────────────────────

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-3 py-3 text-sm text-slate-300 align-top";

function CampaignTableRow({
  s,
  clientId,
  sparkData,
  isEditing,
  isSelected,
  goalOverride,
  onEdit,
  onCancel,
  onGoalSaved,
  onToggleSelect,
}: {
  s:              CampaignPerformanceSnapshot;
  clientId:       string;
  sparkData:      SparkPoint[];
  isEditing:      boolean;
  isSelected:     boolean;
  goalOverride:   GoalData | undefined;
  onEdit:         () => void;
  onCancel:       () => void;
  onGoalSaved:    (goal: GoalData) => void;
  onToggleSelect: () => void;
}) {
  const hasGoal  = goalOverride !== undefined || s.hasGoal;
  const roasGoal = goalOverride?.roasGoalValue ?? s.roasGoalValue;
  const cpaGoal  = goalOverride?.cpaGoalValue  ?? s.cpaGoalValue;
  const colSpan  = 13; // total columns including new checkbox col

  return (
    <Fragment>
      <tr className={`border-b border-slate-800 last:border-0 transition-colors ${
        isSelected ? "bg-indigo-950/20" : "hover:bg-slate-800/20"
      } ${isEditing ? "bg-slate-800/30" : ""}`}>
        {/* Checkbox */}
        <td className="px-3 py-3 align-top w-8">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-slate-600 bg-slate-700 accent-indigo-500 cursor-pointer"
          />
        </td>
        <td className={`${TD} max-w-[200px]`}>
          <Link
            href={`/clients/${clientId}/campaigns/${s.externalCampaignId}`}
            className="font-medium text-slate-100 hover:text-emerald-400 transition-colors truncate block"
          >
            {s.campaignName}
          </Link>
          <p className="text-xs text-slate-600 font-mono truncate">{s.externalCampaignId}</p>
        </td>
        <td className={TD}>
          <Badge variant={statusBadgeVariant(s.campaignStatus)}>{s.campaignStatus}</Badge>
        </td>
        {/* Goal column */}
        <td className={TD}>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <GoalStatusChip hasGoal={hasGoal} />
              {hasGoal && <GoalSourceChip source={goalOverride ? "explicit" : s.goalSource} />}
            </div>
            {roasGoal && (
              <p className="text-xs text-slate-500">ROAS {roasGoal.toFixed(2)}x</p>
            )}
            {cpaGoal && (
              <p className="text-xs text-slate-500">CPA ${cpaGoal.toFixed(2)}</p>
            )}
            <button
              onClick={isEditing ? onCancel : onEdit}
              className="block text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
            >
              {isEditing ? "Cancel" : hasGoal ? "Edit" : "+ Add goal"}
            </button>
          </div>
        </td>
        <td className={`${TD} text-right`}>{fmt$(s.metaSpend)}</td>
        <td className={TD}>
          <SparkLine data={sparkData} />
        </td>
        <td className={`${TD} text-right`}>{fmt$(s.crmRevenue)}</td>
        <td className={`${TD} text-right`}>{fmtNum(s.crmOrders)}</td>
        <td className={`${TD} text-right`}>
          <div className="flex flex-col items-end gap-0.5">
            <span>{fmtRoas(s.evaluatedRoas)}</span>
            {roasGoal && (
              <span className="text-xs text-slate-500">goal {roasGoal.toFixed(2)}x</span>
            )}
          </div>
        </td>
        <td className={`${TD} text-right`}>
          <div className="flex flex-col items-end gap-0.5">
            <span>{fmtCpa(s.evaluatedCpa)}</span>
            {cpaGoal && (
              <span className="text-xs text-slate-500">goal ${cpaGoal.toFixed(2)}</span>
            )}
          </div>
        </td>
        <td className={`${TD} text-right`}>
          <div className="flex flex-col items-end gap-0.5">
            <GoalDelta actual={s.evaluatedRoas} goal={roasGoal ?? null} higherIsBetter />
            <GoalDelta actual={s.evaluatedCpa}  goal={cpaGoal ?? null}  higherIsBetter={false} />
          </div>
        </td>
        <td className={TD}>
          <HealthChip status={s.healthStatus} />
        </td>
        <td className={TD}>
          <div className="space-y-1">
            <ActionChip action={s.recommendation.actionType} />
            <p className="text-xs text-slate-500 max-w-[180px] leading-relaxed">
              {s.recommendation.reason}
            </p>
          </div>
        </td>
      </tr>

      {/* Inline edit row */}
      {isEditing && (
        <tr className="border-b border-slate-800 bg-slate-800/40">
          <td colSpan={colSpan} className="px-4 py-3">
            <InlineGoalForm
              externalCampaignId={s.externalCampaignId}
              currentRoas={roasGoal ?? null}
              currentCpa={cpaGoal ?? null}
              onSave={(goal) => { onGoalSaved(goal); }}
              onCancel={onCancel}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// ── Opportunities / Risks strip ────────────────────────────────────────────────

function OpportunityRiskStrip({ snapshots }: { snapshots: CampaignPerformanceSnapshot[] }) {
  const { opportunities, risks } = buildOpportunityRiskSummary(snapshots);
  if (opportunities.length === 0 && risks.length === 0) return null;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {opportunities.length > 0 && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Opportunities
          </p>
          {opportunities.map((line, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-emerald-300">
              <span className="mt-0.5 shrink-0">↑</span>{line}
            </p>
          ))}
        </div>
      )}
      {risks.length > 0 && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            Needs Attention
          </p>
          {risks.map((line, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-rose-300">
              <span className="mt-0.5 shrink-0">⚠</span>{line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign Actions (top-priority recommendation list) ───────────────────────

function CampaignActionsSection({ snapshots }: { snapshots: CampaignPerformanceSnapshot[] }) {
  const highPriority = snapshots
    .filter((s) => s.recommendation.priority === "high")
    .sort((a, b) => {
      const order = { scale: 0, reduce_spend: 1 } as Record<string, number>;
      return (order[a.recommendation.actionType] ?? 2) - (order[b.recommendation.actionType] ?? 2);
    })
    .slice(0, 5);

  if (highPriority.length === 0) return null;

  return (
    <section className="mt-8">
      <SectionCard title="Campaign Actions" description="Highest-priority deterministic recommendations.">
        <div className="space-y-3">
          {highPriority.map((s) => (
            <div
              key={s.campaignId}
              className="flex flex-col gap-2 rounded-lg bg-slate-800/30 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex shrink-0 gap-2">
                <ActionChip action={s.recommendation.actionType} />
                <HealthChip  status={s.healthStatus} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">{s.campaignName}</p>
                <p className="mt-0.5 text-xs text-slate-400">{s.recommendation.reason}</p>
                {s.recommendation.supportingMetrics && (
                  <p className="mt-0.5 text-xs text-slate-600">{s.recommendation.supportingMetrics}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500">Spend</p>
                <p className="text-sm font-medium text-slate-300">{fmt$(s.metaSpend)}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type HealthFilter  = CampaignHealthStatus | "all";
type StatusFilter  = "all" | "ACTIVE" | "PAUSED";
type PriorityFilter = "all" | "high" | "medium" | "low";
type GoalFilter    = "all" | "explicit" | "client_default" | "missing_goal";

const SELECT_CLS =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 " +
  "focus:outline-none focus:ring-1 focus:ring-slate-500 min-h-[40px]";

function FilterBar({
  healthFilter,  setHealthFilter,
  statusFilter,  setStatusFilter,
  priorityFilter, setPriorityFilter,
  goalFilter,    setGoalFilter,
  search,        setSearch,
}: {
  healthFilter:    HealthFilter;
  setHealthFilter: (v: HealthFilter)   => void;
  statusFilter:    StatusFilter;
  setStatusFilter: (v: StatusFilter)   => void;
  priorityFilter:  PriorityFilter;
  setPriorityFilter: (v: PriorityFilter) => void;
  goalFilter:      GoalFilter;
  setGoalFilter:   (v: GoalFilter) => void;
  search:    string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <input
        type="text"
        placeholder="Search campaigns…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${SELECT_CLS} min-w-[160px] flex-1 sm:flex-none`}
      />
      <select
        value={goalFilter}
        onChange={(e) => setGoalFilter(e.target.value as GoalFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All campaigns</option>
        <option value="explicit">Explicit goals</option>
        <option value="client_default">Client default</option>
        <option value="missing_goal">Missing goals</option>
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="PAUSED">Paused</option>
      </select>
      <select
        value={healthFilter}
        onChange={(e) => setHealthFilter(e.target.value as HealthFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All health</option>
        <option value="strong">Strong</option>
        <option value="on_target">On Target</option>
        <option value="watch">Watch</option>
        <option value="below_goal">Below Goal</option>
        <option value="no_goal">No Goal</option>
        <option value="stale">Stale</option>
      </select>
      <select
        value={priorityFilter}
        onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
        className={SELECT_CLS}
      >
        <option value="all">All priorities</option>
        <option value="high">High priority</option>
        <option value="medium">Medium priority</option>
        <option value="low">Low priority</option>
      </select>
    </div>
  );
}

// ── Date range helpers ────────────────────────────────────────────────────────

type DatePreset = "7d" | "14d" | "30d" | "90d" | "custom";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function presetToDates(preset: DatePreset): { startDate: string; endDate: string } {
  const end = todayStr();
  switch (preset) {
    case "7d":  return { startDate: daysAgoStr(6),  endDate: end };
    case "14d": return { startDate: daysAgoStr(13), endDate: end };
    case "30d": return { startDate: daysAgoStr(29), endDate: end };
    case "90d": return { startDate: daysAgoStr(89), endDate: end };
    default:    return { startDate: daysAgoStr(29), endDate: end };
  }
}

function fmtDateLabel(startDate: string, endDate: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

// ── Date range picker ─────────────────────────────────────────────────────────

const BTN_PRESET =
  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] " +
  "border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500";

const BTN_PRESET_ACTIVE =
  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] " +
  "border border-emerald-700 bg-emerald-900/30 text-emerald-300";

const DATE_INPUT_CLS =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px] " +
  "cursor-pointer [color-scheme:dark]";

function DateRangePicker({
  startDate,
  endDate,
  preset,
  loading,
  onPreset,
  onCustomRange,
}: {
  startDate:     string;
  endDate:       string;
  preset:        DatePreset;
  loading:       boolean;
  onPreset:      (p: DatePreset) => void;
  onCustomRange: (start: string, end: string) => void;
}) {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd,   setLocalEnd]   = useState(endDate);

  function applyCustom() {
    if (localStart && localEnd && localStart <= localEnd) {
      onCustomRange(localStart, localEnd);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      {(["7d", "14d", "30d", "90d"] as DatePreset[]).map((p) => (
        <button
          key={p}
          type="button"
          disabled={loading}
          onClick={() => onPreset(p)}
          className={preset === p ? BTN_PRESET_ACTIVE : BTN_PRESET}
        >
          {p === "7d" ? "7 days" : p === "14d" ? "14 days" : p === "30d" ? "30 days" : "90 days"}
        </button>
      ))}

      {/* Divider */}
      <span className="hidden text-slate-700 sm:inline">|</span>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={localStart}
          max={localEnd || todayStr()}
          onChange={(e) => { setLocalStart(e.target.value); }}
          className={DATE_INPUT_CLS}
          disabled={loading}
        />
        <span className="text-xs text-slate-600">to</span>
        <input
          type="date"
          value={localEnd}
          min={localStart}
          max={todayStr()}
          onChange={(e) => { setLocalEnd(e.target.value); }}
          className={DATE_INPUT_CLS}
          disabled={loading}
        />
        <button
          type="button"
          onClick={applyCustom}
          disabled={loading || !localStart || !localEnd || localStart > localEnd}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300
                     hover:text-white hover:border-slate-400 transition-colors min-h-[36px]
                     disabled:opacity-40"
        >
          Apply
        </button>
      </div>

      {loading && (
        <span className="text-xs text-slate-500 animate-pulse">Loading…</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CampaignPerformanceView({
  clientId,
  clientName,
  snapshots:    initialSnapshots,
  sparklines:   initialSparklines,
  clientDaily:  initialClientDaily,
}: Props) {
  const [healthFilter,   setHealthFilter]   = useState<HealthFilter>("all");
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [goalFilter,     setGoalFilter]     = useState<GoalFilter>("all");
  const [search,         setSearch]         = useState("");

  // Inline goal editing state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalOverrides,  setGoalOverrides] = useState<Map<string, GoalData>>(new Map());

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition]     = useTransition();

  // ── Date range state ────────────────────────────────────────────────────────
  const [datePreset,  setDatePreset]  = useState<DatePreset>("30d");
  const [dateRange,   setDateRange]   = useState(() => presetToDates("30d"));
  const [snapshots,   setSnapshots]   = useState(initialSnapshots);
  const [sparklines,  setSparklines]  = useState(initialSparklines);
  const [clientDaily, setClientDaily] = useState(initialClientDaily);
  const [dateLoading, setDateLoading] = useState(false);
  const [dateError,   setDateError]   = useState<string | null>(null);

  const fetchForRange = useCallback(async (startDate: string, endDate: string) => {
    setDateLoading(true);
    setDateError(null);
    try {
      const url = `/api/clients/${encodeURIComponent(clientId)}/campaigns/performance` +
                  `?startDate=${startDate}&endDate=${endDate}`;
      const res  = await fetch(url);
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setDateError((data.error as string | undefined) ?? "Failed to load data");
        return;
      }
      setSnapshots(data.snapshots  as typeof initialSnapshots);
      setSparklines(data.sparklines as typeof initialSparklines);
      setClientDaily(data.clientDaily as typeof initialClientDaily);
      setGoalOverrides(new Map()); // clear inline overrides for new date range
    } catch {
      setDateError("Network error — please try again");
    } finally {
      setDateLoading(false);
    }
  }, [clientId]);

  function handlePreset(preset: DatePreset) {
    setDatePreset(preset);
    const range = presetToDates(preset);
    setDateRange(range);
    void fetchForRange(range.startDate, range.endDate);
  }

  function handleCustomRange(startDate: string, endDate: string) {
    setDatePreset("custom");
    setDateRange({ startDate, endDate });
    void fetchForRange(startDate, endDate);
  }

  const counts = useMemo(() => countCampaignsByHealthStatus(snapshots), [snapshots]);

  // After an inline save the override is "explicit" — use it for source resolution
  const effectiveSource = (s: CampaignPerformanceSnapshot): GoalSource =>
    goalOverrides.has(s.externalCampaignId) ? "explicit" : s.goalSource;

  const missingGoalsCount = useMemo(
    () => snapshots.filter((s) => effectiveSource(s) === "none").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshots, goalOverrides]
  );

  const filtered = useMemo(() => {
    return snapshots.filter((s) => {
      const src = effectiveSource(s);
      if (goalFilter === "explicit"      && src !== "explicit")       return false;
      if (goalFilter === "client_default" && src !== "client_default") return false;
      if (goalFilter === "missing_goal"  && src !== "none")            return false;
      if (healthFilter   !== "all" && s.healthStatus               !== healthFilter)   return false;
      if (statusFilter   !== "all" && s.campaignStatus             !== statusFilter)   return false;
      if (priorityFilter !== "all" && s.recommendation.priority    !== priorityFilter) return false;
      if (search && !s.campaignName.toLowerCase().includes(search.toLowerCase()))      return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, goalFilter, goalOverrides, healthFilter, statusFilter, priorityFilter, search]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleGoalSaved(externalCampaignId: string, goal: GoalData) {
    setGoalOverrides((prev) => new Map(prev).set(externalCampaignId, goal));
    setEditingGoalId(null);
  }

  async function handleBulkApply(roas: number, cpa: number) {
    const ids = Array.from(selected);
    // fire all requests in parallel — optimistically update immediately
    const updates = ids.map((id) =>
      fetch(`/api/campaigns/${id}/goal`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          roasGoalType:  "high",
          roasGoalValue: roas,
          cpaGoalType:   "low",
          cpaGoalValue:  cpa,
        }),
      }).catch(() => null)
    );
    // optimistic update
    startTransition(() => {
      setGoalOverrides((prev) => {
        const next = new Map(prev);
        for (const id of ids) next.set(id, { roasGoalValue: roas, cpaGoalValue: cpa });
        return next;
      });
      setSelected(new Set());
    });
    await Promise.all(updates);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((s) => s.externalCampaignId)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ── Empty states ──────────────────────────────────────────────────────────

  const noSync   = snapshots.length === 0;
  const noFilter = filtered.length === 0 && snapshots.length > 0;

  // ── Summary card data ─────────────────────────────────────────────────────

  const aboveGoal    = counts.strong + counts.on_target;
  const needsReview  = counts.no_goal + counts.stale + counts.no_data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/clients/${clientId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to {clientName}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              Campaign Performance
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {clientName} · CRM is source of truth for ROAS &amp; CPA
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/clients/${clientId}/settings`}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Goal defaults →
            </Link>
            <Link
              href={`/clients/${clientId}`}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Run sync →
            </Link>
          </div>
        </div>

        {/* Date range picker */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Date range
            </span>
            <span className="text-xs text-slate-500">
              {fmtDateLabel(dateRange.startDate, dateRange.endDate)}
            </span>
          </div>
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            preset={datePreset}
            loading={dateLoading}
            onPreset={handlePreset}
            onCustomRange={handleCustomRange}
          />
          {dateError && (
            <p className="mt-2 text-xs text-rose-400">{dateError}</p>
          )}
        </div>
      </div>

      {/* Overview chart */}
      {clientDaily.some((d) => d.spend > 0 || d.revenue > 0) && (
        <div className="mb-8">
          <SectionCard
            title={`Overview · ${fmtDateLabel(dateRange.startDate, dateRange.endDate)}`}
            description="Spend (indigo), CRM revenue (green), and evaluated ROAS (amber dashed) from Meta + Shopify."
          >
            <TrendChart data={clientDaily} height={240} />
          </SectionCard>
        </div>
      )}

      {noSync ? (
        <SectionCard>
          <EmptyState
            title="No campaigns synced yet"
            description="Run a Meta sync from the client page to pull in campaign data. Make sure a Meta ad account is mapped to this client first."
            icon="□"
            action={
              <Link
                href={`/clients/${clientId}`}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
              >
                Go to client page →
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          {/* Summary cards — 2-col on mobile, 4-col on desktop */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Above Goal"
              value={String(aboveGoal)}
              sub={`${counts.strong} strong · ${counts.on_target} on target`}
            />
            <StatCard
              label="On Watch"
              value={String(counts.watch)}
              sub="Hitting one goal"
            />
            <StatCard
              label="Below Goal"
              value={String(counts.below_goal)}
              sub="Missing both goals"
            />
            <StatCard
              label="Needs Setup"
              value={String(needsReview)}
              sub={`${counts.no_goal} no goal · ${counts.stale + counts.no_data} no data`}
            />
          </div>

          {/* Missing Goals Banner */}
          <MissingGoalsBanner
            missingCount={missingGoalsCount}
            totalCount={snapshots.length}
            clientId={clientId}
            onFilterMissing={() => setGoalFilter("missing_goal")}
          />

          {/* Opportunities / Risks strip */}
          <OpportunityRiskStrip snapshots={snapshots} />

          {/* Bulk Goal Panel — appears when campaigns are selected */}
          {selected.size > 0 && (
            <BulkGoalPanel
              selectedCount={selected.size}
              onApply={handleBulkApply}
              onClear={clearSelection}
            />
          )}

          {/* Filters */}
          <FilterBar
            healthFilter={healthFilter}     setHealthFilter={setHealthFilter}
            statusFilter={statusFilter}     setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
            goalFilter={goalFilter}         setGoalFilter={setGoalFilter}
            search={search}                 setSearch={setSearch}
          />

          {noFilter ? (
            <SectionCard>
              {goalFilter === "missing_goal" && missingGoalsCount === 0 ? (
                <EmptyState
                  title="All campaigns have goals set"
                  description="Every imported campaign has a ROAS and CPA goal configured."
                  icon="✓"
                  action={
                    <button
                      onClick={() => setGoalFilter("all")}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
                    >
                      View all campaigns
                    </button>
                  }
                />
              ) : goalFilter === "explicit" ? (
                <EmptyState
                  title="No campaigns have explicit goals"
                  description="Use '+ Add goal' on any campaign to set a direct ROAS and CPA target, or configure client defaults as a starting point."
                  icon="◎"
                  action={
                    <button
                      onClick={() => setGoalFilter("all")}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
                    >
                      View all campaigns
                    </button>
                  }
                />
              ) : goalFilter === "client_default" ? (
                <EmptyState
                  title="No campaigns using client defaults"
                  description="Campaigns using the client default appear here. Set defaults in Settings, or all campaigns may already have explicit goals."
                  icon="◎"
                  action={
                    <button
                      onClick={() => setGoalFilter("all")}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
                    >
                      View all campaigns
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="No campaigns match these filters"
                  description="Try adjusting the health, status, goal, or priority filters."
                  icon="□"
                />
              )}
            </SectionCard>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 md:hidden">
                {/* Select-all shortcut when 2+ campaigns */}
                {filtered.length > 1 && (
                  <div className="flex items-center gap-3 px-1">
                    <button
                      onClick={selected.size === filtered.length ? clearSelection : selectAllVisible}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                    >
                      {selected.size === filtered.length ? "Deselect all" : "Select all"}
                    </button>
                    {selected.size > 0 && (
                      <span className="text-xs text-indigo-400">{selected.size} selected</span>
                    )}
                  </div>
                )}
                {filtered.map((s) => (
                  <CampaignCard
                    key={s.campaignId}
                    s={s}
                    clientId={clientId}
                    sparkData={sparklines[s.externalCampaignId] ?? []}
                    isEditing={editingGoalId === s.externalCampaignId}
                    isSelected={selected.has(s.externalCampaignId)}
                    goalOverride={goalOverrides.get(s.externalCampaignId)}
                    onEdit={() => setEditingGoalId(s.externalCampaignId)}
                    onCancel={() => setEditingGoalId(null)}
                    onGoalSaved={(goal) => handleGoalSaved(s.externalCampaignId, goal)}
                    onToggleSelect={() => toggleSelect(s.externalCampaignId)}
                  />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 md:block">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={selected.size === filtered.length && filtered.length > 0}
                          onChange={() =>
                            selected.size === filtered.length
                              ? clearSelection()
                              : selectAllVisible()
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-700 accent-indigo-500 cursor-pointer"
                          title="Select all visible"
                        />
                      </th>
                      <th className={TH}>Campaign</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Goal</th>
                      <th className={`${TH} text-right`}>Spend</th>
                      <th className={TH}>Trend</th>
                      <th className={`${TH} text-right`}>CRM Rev</th>
                      <th className={`${TH} text-right`}>Orders</th>
                      <th className={`${TH} text-right`}>ROAS</th>
                      <th className={`${TH} text-right`}>CPA</th>
                      <th className={`${TH} text-right`}>vs Goal</th>
                      <th className={TH}>Health</th>
                      <th className={TH}>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <CampaignTableRow
                        key={s.campaignId}
                        s={s}
                        clientId={clientId}
                        sparkData={sparklines[s.externalCampaignId] ?? []}
                        isEditing={editingGoalId === s.externalCampaignId}
                        isSelected={selected.has(s.externalCampaignId)}
                        goalOverride={goalOverrides.get(s.externalCampaignId)}
                        onEdit={() => setEditingGoalId(s.externalCampaignId)}
                        onCancel={() => setEditingGoalId(null)}
                        onGoalSaved={(goal) => handleGoalSaved(s.externalCampaignId, goal)}
                        onToggleSelect={() => toggleSelect(s.externalCampaignId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* No reconciliation data hint */}
              {filtered.every((s) => s.crmRevenue === 0 && s.crmOrders === 0) && (
                <p className="mt-3 text-xs text-slate-600">
                  No CRM order data matched to these campaigns. Sync Shopify orders and ensure
                  UTM campaign names match your Meta campaign names.
                </p>
              )}
            </>
          )}

          {/* Campaign Actions */}
          <CampaignActionsSection snapshots={filtered} />
        </>
      )}
    </div>
  );
}
