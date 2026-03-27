"use client";

// app/pacing/PacingView.tsx
// Budget Pacing Tracker — main client component.
//
// Mobile:  stacked PacingCards per client, easy-to-tap budget edit
// Desktop: 4-col summary row, filterable client list with richer detail

import { useState, useMemo } from "react";
import Link from "next/link";
import { StatCard } from "../../components/ui/StatCard";
import { SectionCard } from "../../components/ui/SectionCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { countPacingByStatus } from "../../lib/budgetPacing/calculations";
import type {
  ClientPacingSummary,
  BudgetPacingSnapshot,
  BudgetPacingStatus,
} from "../../lib/budgetPacing/types";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  summaries: ClientPacingSummary[];
};

// ── Format helpers ────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(0)}%`;
}

// ── Pacing status helpers ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<BudgetPacingStatus, string> = {
  on_pacing:     "bg-emerald-900/40 text-emerald-400",
  under_pacing:  "bg-amber-900/40   text-amber-400",
  over_pacing:   "bg-rose-900/40    text-rose-400",
  no_budget_set: "bg-slate-800      text-slate-500",
};

const STATUS_LABELS: Record<BudgetPacingStatus, string> = {
  on_pacing:     "On Pacing",
  under_pacing:  "Under Pacing",
  over_pacing:   "Over Pacing",
  no_budget_set: "No Budget Set",
};

function PacingChip({ status }: { status: BudgetPacingStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Pacing bar ────────────────────────────────────────────────────────────────

function PacingBar({ percent, status }: { percent: number; status: BudgetPacingStatus }) {
  const clamped = Math.min(150, Math.max(0, percent));
  const barColor =
    status === "on_pacing"     ? "bg-emerald-500" :
    status === "under_pacing"  ? "bg-amber-500"   :
    status === "over_pacing"   ? "bg-rose-500"     :
    "bg-slate-700";

  return (
    <div className="relative h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
      {/* 100% target marker */}
      <div className="absolute left-2/3 top-0 h-full w-px bg-slate-600 z-10" style={{ left: `${(100 / 150) * 100}%` }} />
      <div
        className={`h-full rounded-full transition-all ${barColor}`}
        style={{ width: `${(clamped / 150) * 100}%` }}
      />
    </div>
  );
}

// ── Inline budget form ────────────────────────────────────────────────────────

function BudgetForm({
  clientId,
  currentMonthly,
  currentDaily,
  onSave,
  onCancel,
}: {
  clientId:       string;
  currentMonthly: number | null;
  currentDaily:   number | null;
  onSave:         (monthly: number, daily: number | null) => void;
  onCancel:       () => void;
}) {
  const [monthly, setMonthly] = useState(currentMonthly ? String(currentMonthly) : "");
  const [daily,   setDaily]   = useState(currentDaily   ? String(currentDaily)   : "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const m = parseFloat(monthly);
    if (!isFinite(m) || m <= 0) {
      setError("Monthly budget must be a positive number");
      return;
    }

    const d = daily.trim() !== "" ? parseFloat(daily) : null;
    if (d !== null && (!isFinite(d) || d <= 0)) {
      setError("Daily budget must be a positive number if provided");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/budget-target`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ monthlyBudget: m, dailyBudget: d }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      onSave(m, d);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  const INPUT = "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[42px]";

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg bg-slate-800/40 p-3 border border-slate-700">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Monthly budget ($)</label>
          <input
            type="number" step="1" min="1"
            placeholder="e.g. 10000"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className={INPUT}
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Daily cap (optional)</label>
          <input
            type="number" step="1" min="1"
            placeholder="implied"
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            className={INPUT}
            disabled={saving}
          />
        </div>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-emerald-700 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[38px]"
        >
          {saving ? "Saving…" : "Save budget"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-700 py-2 text-xs text-slate-400 hover:text-slate-200 min-h-[38px]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Pacing card (mobile-first per-client card) ────────────────────────────────

function PacingCard({
  summary,
}: {
  summary: ClientPacingSummary;
}) {
  const { clientId, clientName, clientSnapshot: s, campaignSnapshots } = summary;
  const [editing,         setEditing]        = useState(false);
  const [showCampaigns,   setShowCampaigns]   = useState(false);
  const [overrideMonthly, setOverrideMonthly] = useState<number | null>(s.monthlyBudget);
  const [overrideDaily,   setOverrideDaily]   = useState<number | null>(s.dailyBudget);

  // Use overrides if saved inline
  const snap: BudgetPacingSnapshot = overrideMonthly !== null
    ? { ...s, monthlyBudget: overrideMonthly, dailyBudget: overrideDaily }
    : s;

  function handleSave(monthly: number, daily: number | null) {
    setOverrideMonthly(monthly);
    setOverrideDaily(daily);
    setEditing(false);
  }

  const impliedDaily = snap.monthlyBudget
    ? snap.dailyBudget ?? snap.impliedDailyBudget
    : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/clients/${clientId}/campaigns`}
            className="text-base font-semibold text-slate-100 hover:text-emerald-400 transition-colors truncate block"
          >
            {clientName}
          </Link>
          <p className="text-xs text-slate-500 mt-0.5">{snap.periodLabel}</p>
        </div>
        <PacingChip status={snap.pacingStatus} />
      </div>

      {/* Key numbers — 3-col */}
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-800/30 px-3 py-2.5">
        {[
          { label: "Spent",      value: fmt$(snap.spendToDate) },
          { label: "Budget",     value: snap.monthlyBudget ? fmt$(snap.monthlyBudget) : "—" },
          { label: "Projected",  value: snap.projectedEndOfPeriodSpend > 0 ? fmt$(snap.projectedEndOfPeriodSpend) : "—" },
        ].map((m) => (
          <div key={m.label}>
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="text-sm font-semibold text-slate-200">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Pacing bar + percent */}
      {snap.pacingStatus !== "no_budget_set" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Day {snap.daysElapsed}/{snap.daysInPeriod} · Expected {fmt$(snap.expectedSpendToDate)}
            </span>
            <span className={`font-medium ${
              snap.pacingStatus === "on_pacing"    ? "text-emerald-400" :
              snap.pacingStatus === "under_pacing" ? "text-amber-400"   :
              "text-rose-400"
            }`}>
              {fmtPct(snap.pacingPercent)}
            </span>
          </div>
          <PacingBar percent={snap.pacingPercent} status={snap.pacingStatus} />
        </div>
      )}

      {/* Implied daily */}
      {impliedDaily !== null && (
        <p className="text-xs text-slate-600">
          Daily budget: {fmt$(impliedDaily)}/day{snap.dailyBudget ? " (explicit)" : " (implied)"}
        </p>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
        >
          {editing ? "Cancel" : snap.monthlyBudget ? "Edit budget" : "Set budget"}
        </button>
        {campaignSnapshots.length > 0 && (
          <button
            onClick={() => setShowCampaigns((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
          >
            {showCampaigns ? "Hide campaigns" : `${campaignSnapshots.length} campaign target${campaignSnapshots.length !== 1 ? "s" : ""}`}
          </button>
        )}
        <Link
          href={`/clients/${clientId}/campaigns`}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors ml-auto"
        >
          Campaigns →
        </Link>
      </div>

      {/* Budget form */}
      {editing && (
        <BudgetForm
          clientId={clientId}
          currentMonthly={snap.monthlyBudget}
          currentDaily={snap.dailyBudget}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Campaign breakdown */}
      {showCampaigns && campaignSnapshots.length > 0 && (
        <div className="mt-1 divide-y divide-slate-800 rounded-lg border border-slate-800 overflow-hidden">
          {campaignSnapshots.map((cs) => (
            <div key={cs.entityId} className="flex items-center justify-between px-3 py-2 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-300 truncate">{cs.entityName}</p>
                <p className="text-xs text-slate-600">
                  {fmt$(cs.spendToDate)} / {cs.monthlyBudget ? fmt$(cs.monthlyBudget) : "—"}
                </p>
              </div>
              <PacingChip status={cs.pacingStatus} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-3 py-3 text-sm text-slate-300 align-top";

function PacingTableRow({ summary }: { summary: ClientPacingSummary }) {
  const { clientId, clientName, clientSnapshot: s, campaignSnapshots } = summary;
  const [editing,         setEditing]        = useState(false);
  const [showCampaigns,   setShowCampaigns]   = useState(false);
  const [overrideMonthly, setOverrideMonthly] = useState<number | null>(s.monthlyBudget);
  const [overrideDaily,   setOverrideDaily]   = useState<number | null>(s.dailyBudget);

  const snap: BudgetPacingSnapshot = overrideMonthly !== null
    ? { ...s, monthlyBudget: overrideMonthly, dailyBudget: overrideDaily }
    : s;

  function handleSave(monthly: number, daily: number | null) {
    setOverrideMonthly(monthly);
    setOverrideDaily(daily);
    setEditing(false);
  }

  const impliedDaily = snap.monthlyBudget
    ? snap.dailyBudget ?? snap.impliedDailyBudget
    : null;

  const colSpan = 8;

  return (
    <>
      <tr className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
        {/* Client name */}
        <td className={`${TD} font-medium max-w-[180px]`}>
          <Link
            href={`/clients/${clientId}/campaigns`}
            className="text-slate-100 hover:text-emerald-400 transition-colors truncate block"
          >
            {clientName}
          </Link>
        </td>

        {/* Status */}
        <td className={TD}>
          <PacingChip status={snap.pacingStatus} />
        </td>

        {/* Spend */}
        <td className={`${TD} text-right font-mono`}>{fmt$(snap.spendToDate)}</td>

        {/* Budget */}
        <td className={`${TD} text-right font-mono`}>
          {snap.monthlyBudget ? fmt$(snap.monthlyBudget) : <span className="text-slate-600">—</span>}
        </td>

        {/* Expected */}
        <td className={`${TD} text-right font-mono text-slate-500`}>
          {snap.expectedSpendToDate > 0 ? fmt$(snap.expectedSpendToDate) : <span className="text-slate-700">—</span>}
        </td>

        {/* Projected EOM */}
        <td className={`${TD} text-right font-mono`}>
          {snap.projectedEndOfPeriodSpend > 0
            ? fmt$(snap.projectedEndOfPeriodSpend)
            : <span className="text-slate-600">—</span>}
        </td>

        {/* Pacing % + bar */}
        <td className={`${TD} min-w-[120px]`}>
          {snap.pacingStatus !== "no_budget_set" ? (
            <div className="space-y-1.5">
              <span className={`text-xs font-semibold ${
                snap.pacingStatus === "on_pacing"    ? "text-emerald-400" :
                snap.pacingStatus === "under_pacing" ? "text-amber-400"   : "text-rose-400"
              }`}>
                {fmtPct(snap.pacingPercent)}
              </span>
              <PacingBar percent={snap.pacingPercent} status={snap.pacingStatus} />
            </div>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
        </td>

        {/* Actions */}
        <td className={TD}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditing((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 whitespace-nowrap"
              >
                {editing ? "Cancel" : snap.monthlyBudget ? "Edit" : "Set budget"}
              </button>
              {campaignSnapshots.length > 0 && (
                <button
                  onClick={() => setShowCampaigns((v) => !v)}
                  className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 whitespace-nowrap"
                >
                  {showCampaigns ? "Hide" : `${campaignSnapshots.length}c`}
                </button>
              )}
            </div>
            {impliedDaily !== null && (
              <span className="text-xs text-slate-600 whitespace-nowrap">
                {fmt$(impliedDaily)}/day{snap.dailyBudget ? "" : " implied"}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Inline budget form */}
      {editing && (
        <tr className="border-b border-slate-800/60">
          <td colSpan={colSpan} className="px-3 py-2">
            <BudgetForm
              clientId={clientId}
              currentMonthly={snap.monthlyBudget}
              currentDaily={snap.dailyBudget}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          </td>
        </tr>
      )}

      {/* Campaign sub-rows */}
      {showCampaigns && campaignSnapshots.map((cs) => (
        <tr key={cs.entityId} className="border-b border-slate-800/40 bg-slate-900/30">
          <td className={`${TD} pl-8 text-xs text-slate-400 max-w-[160px] truncate`}>
            ↳ {cs.entityName}
          </td>
          <td className={TD}><PacingChip status={cs.pacingStatus} /></td>
          <td className={`${TD} text-right font-mono text-xs`}>{fmt$(cs.spendToDate)}</td>
          <td className={`${TD} text-right font-mono text-xs`}>{cs.monthlyBudget ? fmt$(cs.monthlyBudget) : "—"}</td>
          <td className={`${TD} text-right font-mono text-xs text-slate-500`}>
            {cs.expectedSpendToDate > 0 ? fmt$(cs.expectedSpendToDate) : "—"}
          </td>
          <td className={`${TD} text-right font-mono text-xs`}>
            {cs.projectedEndOfPeriodSpend > 0 ? fmt$(cs.projectedEndOfPeriodSpend) : "—"}
          </td>
          <td className={TD}>
            {cs.pacingStatus !== "no_budget_set" ? (
              <span className={`text-xs font-medium ${
                cs.pacingStatus === "on_pacing"    ? "text-emerald-400" :
                cs.pacingStatus === "under_pacing" ? "text-amber-400"   : "text-rose-400"
              }`}>
                {fmtPct(cs.pacingPercent)}
              </span>
            ) : "—"}
          </td>
          <td className={TD} />
        </tr>
      ))}
    </>
  );
}

// ── Filter types ──────────────────────────────────────────────────────────────

type PacingFilter = "all" | BudgetPacingStatus;

const SELECT_CLS =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 " +
  "focus:outline-none focus:ring-1 focus:ring-slate-500 min-h-[40px]";

// ── Main component ────────────────────────────────────────────────────────────

export function PacingView({ summaries }: Props) {
  const [pacingFilter, setPacingFilter] = useState<PacingFilter>("all");
  const [search,       setSearch]       = useState("");

  const allClientSnapshots = useMemo(
    () => summaries.map((s) => s.clientSnapshot),
    [summaries]
  );

  const counts = useMemo(
    () => countPacingByStatus(allClientSnapshots),
    [allClientSnapshots]
  );

  const filtered = useMemo(() => {
    return summaries.filter((s) => {
      if (pacingFilter !== "all" && s.clientSnapshot.pacingStatus !== pacingFilter) return false;
      if (search && !s.clientName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [summaries, pacingFilter, search]);

  const periodLabel = summaries[0]?.clientSnapshot.periodLabel ?? "";
  const noBudget    = counts.no_budget_set;
  const atRisk      = counts.over_pacing + counts.under_pacing;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Budget Pacing
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {periodLabel
            ? `${periodLabel} · Spend vs. monthly targets · Meta is spend source`
            : "Monthly spend tracking against client budget targets"}
        </p>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center">
          <p className="text-slate-400 text-sm">No clients found.</p>
          <Link href="/clients" className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
            Add a client →
          </Link>
        </div>
      ) : (
        <>
          {/* Summary cards — 4-col on lg+, 2-col on mobile */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="On Pacing"
              value={String(counts.on_pacing)}
              sub={`${counts.total} total clients`}
            />
            <StatCard
              label="Under Pacing"
              value={String(counts.under_pacing)}
              sub="Spending below target"
            />
            <StatCard
              label="Over Pacing"
              value={String(counts.over_pacing)}
              sub="Risk of overspend"
            />
            <StatCard
              label="No Budget Set"
              value={String(counts.no_budget_set)}
              sub="Configure targets"
            />
          </div>

          {/* Risk callout */}
          {atRisk > 0 && (
            <div className="mb-5 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3">
              <p className="text-sm font-medium text-amber-300">
                {atRisk} client{atRisk !== 1 ? "s" : ""} need{atRisk === 1 ? "s" : ""} pacing attention this month
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                {counts.over_pacing > 0 && `${counts.over_pacing} over-pacing (risk of overspend)`}
                {counts.over_pacing > 0 && counts.under_pacing > 0 && " · "}
                {counts.under_pacing > 0 && `${counts.under_pacing} under-pacing (may miss delivery targets)`}
              </p>
            </div>
          )}

          {/* Missing budget callout */}
          {noBudget > 0 && (
            <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-3">
              <p className="text-sm font-medium text-slate-400">
                {noBudget} client{noBudget !== 1 ? "s" : ""} {noBudget === 1 ? "has" : "have"} no monthly budget set
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Click &ldquo;Set budget&rdquo; on any client to enable pacing tracking
              </p>
            </div>
          )}

          {/* Filter bar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${SELECT_CLS} min-w-[160px] flex-1 sm:flex-none`}
            />
            <select
              value={pacingFilter}
              onChange={(e) => setPacingFilter(e.target.value as PacingFilter)}
              className={SELECT_CLS}
            >
              <option value="all">All clients</option>
              <option value="on_pacing">On pacing</option>
              <option value="under_pacing">Under pacing</option>
              <option value="over_pacing">Over pacing</option>
              <option value="no_budget_set">No budget set</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <SectionCard>
              <EmptyState
                title="No clients match these filters"
                description="Try adjusting the pacing status filter or search term."
                icon="□"
                action={
                  <button
                    onClick={() => { setPacingFilter("all"); setSearch(""); }}
                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
                  >
                    Clear filters
                  </button>
                }
              />
            </SectionCard>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="space-y-3 lg:hidden">
                {filtered.map((s) => (
                  <PacingCard key={s.clientId} summary={s} />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead className="border-b border-slate-800 bg-slate-900/80">
                    <tr>
                      <th className={TH}>Client</th>
                      <th className={TH}>Status</th>
                      <th className={`${TH} text-right`}>Spent</th>
                      <th className={`${TH} text-right`}>Budget</th>
                      <th className={`${TH} text-right`}>Expected</th>
                      <th className={`${TH} text-right`}>Projected EOM</th>
                      <th className={TH}>Pacing</th>
                      <th className={TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <PacingTableRow key={s.clientId} summary={s} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer note */}
              <p className="mt-4 text-xs text-slate-600">
                Spend source: Meta Ads. Period: {periodLabel}. Pacing model: linear spend across the calendar month.
                Thresholds: on target 90–110%, under &lt;90%, over &gt;110%.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
