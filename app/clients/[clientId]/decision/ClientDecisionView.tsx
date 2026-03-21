"use client";

import Link from "next/link";
import { PageContainer } from "../../../../components/ui/PageContainer";
import { SectionCard }   from "../../../../components/ui/SectionCard";
import { Badge }         from "../../../../components/ui/Badge";
import { EmptyState }    from "../../../../components/ui/EmptyState";
import type {
  ClientDecisionSummary,
  ClientChangeSignal,
  ClientPerformanceDriver,
  ClientRecommendedAction,
  ClientIssue,
  ClientOpportunity,
} from "../../../../types/clientDecision";

// ── Formatting ──────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtRoas(v: number | null): string {
  return v !== null ? `${v.toFixed(2)}x` : "—";
}

function fmtCpa(v: number | null): string {
  return v !== null ? `$${v.toFixed(2)}` : "—";
}

// ── Change direction helpers ────────────────────────────────────────────────

function directionArrow(dir: string): string {
  if (dir === "improved") return "↑";
  if (dir === "declined") return "↓";
  return "→";
}

function directionColor(dir: string): string {
  if (dir === "improved") return "text-emerald-400";
  if (dir === "declined") return "text-rose-400";
  return "text-slate-500";
}

function severityBadgeVariant(sev: string): "danger" | "warning" | "neutral" {
  if (sev === "major" || sev === "critical" || sev === "high") return "danger";
  if (sev === "moderate" || sev === "medium") return "warning";
  return "neutral";
}

function actionBtnClass(variant: string): string {
  switch (variant) {
    case "primary":
      return "border-emerald-700 bg-emerald-700/20 text-emerald-300 hover:bg-emerald-700/40";
    case "danger":
      return "border-rose-700 bg-rose-700/20 text-rose-300 hover:bg-rose-700/40";
    case "secondary":
      return "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700";
    default:
      return "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800";
  }
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function YesterdayKPIs({ data }: { data: ClientDecisionSummary }) {
  const y = data.yesterday;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <KpiCard label="Spend" value={fmtCurrency(y.spend)} />
      <KpiCard label="Revenue" value={fmtCurrency(y.revenue)} />
      <KpiCard
        label="ROAS"
        value={fmtRoas(y.roas)}
        sub={data.roasGoal ? `Goal: ${data.roasGoal.toFixed(1)}x` : "No goal"}
        highlight={y.roas !== null && data.roasGoal !== null
          ? (y.roas >= data.roasGoal ? "good" : "bad")
          : undefined}
      />
      <KpiCard
        label="CPA"
        value={fmtCpa(y.cpa)}
        sub={data.cpaGoal ? `Goal: ${fmtCpa(data.cpaGoal)}` : "No goal"}
        highlight={y.cpa !== null && data.cpaGoal !== null
          ? (y.cpa <= data.cpaGoal ? "good" : "bad")
          : undefined}
      />
      <KpiCard label="Orders" value={String(y.orders)} />
    </div>
  );
}

function KpiCard({ label, value, sub, highlight }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad";
}) {
  const hlClass = highlight === "good" ? "text-emerald-400" : highlight === "bad" ? "text-rose-400" : "text-white";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight ${hlClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}

// ── Section 1: What Changed ─────────────────────────────────────────────────

function ChangesSection({ changes }: { changes: ClientChangeSignal[] }) {
  if (changes.length === 0) {
    return (
      <SectionCard title="What Changed" description="Day-over-day metric deltas">
        <p className="text-sm text-slate-500">No significant changes detected.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="What Changed" description="Key deltas vs previous day">
      <div className="space-y-2">
        {changes.map((c) => (
          <div
            key={c.metric}
            className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-800/30 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold ${directionColor(c.direction)}`}>
                {directionArrow(c.direction)}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{c.label}</p>
                <p className="text-xs text-slate-500">{c.displayValue}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${directionColor(c.direction)}`}>
                {c.deltaPct > 0 ? "+" : ""}{c.deltaPct.toFixed(1)}%
              </span>
              <Badge variant={severityBadgeVariant(c.severity)}>
                {c.severity}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Section 2: Why It Changed ───────────────────────────────────────────────

function DriversSection({ drivers }: { drivers: ClientPerformanceDriver[] }) {
  if (drivers.length === 0) {
    return (
      <SectionCard title="Why It Changed" description="Detected performance signals">
        <p className="text-sm text-slate-500">No performance drivers detected. Metrics are within normal range.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Why It Changed" description="Detected signals and likely causes">
      <div className="space-y-3">
        {drivers.map((d, i) => (
          <div
            key={`${d.type}-${i}`}
            className={`rounded-lg border px-4 py-3 ${driverBorderClass(d.severity)}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">{driverIcon(d.type)}</span>
              <p className="text-sm font-medium text-white">{d.title}</p>
              <Badge variant={severityBadgeVariant(d.severity)}>{d.severity}</Badge>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{d.description}</p>
            {d.relatedEntity && (
              <p className="mt-1 text-xs text-slate-600">Related: {d.relatedEntity}</p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function driverBorderClass(severity: string): string {
  if (severity === "high") return "border-rose-800/40 bg-rose-950/20";
  if (severity === "medium") return "border-amber-800/40 bg-amber-950/20";
  return "border-slate-800 bg-slate-900/40";
}

function driverIcon(type: string): string {
  const MAP: Record<string, string> = {
    creative_fatigue: "◈",
    frequency_high:   "◉",
    ctr_drop:         "◇",
    spend_change:     "◎",
    cpa_spike:        "△",
    roas_drop:        "▽",
    conversion_drop:  "▿",
    goal_miss:        "⚑",
    new_campaign:     "◆",
    experiment_result: "◇",
  };
  return MAP[type] ?? "○";
}

// ── Section 3: What To Do ───────────────────────────────────────────────────

function ActionsSection({ actions }: { actions: ClientRecommendedAction[] }) {
  return (
    <SectionCard title="What To Do" description="Recommended next steps">
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.action + a.label}
            href={a.href}
            className={`flex flex-col rounded-xl border p-4 transition-colors ${actionBtnClass(a.variant)}`}
          >
            <span className="text-sm font-semibold">{a.label}</span>
            <span className="mt-1 text-xs opacity-80">{a.description}</span>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Issues & Opportunities ──────────────────────────────────────────────────

function IssuesPanel({ issues }: { issues: ClientIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <SectionCard title="Active Issues" description={`${issues.length} issue${issues.length !== 1 ? "s" : ""} detected`}>
      <div className="space-y-2">
        {issues.map((issue) => (
          <div key={issue.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800/60 bg-slate-800/30 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{issue.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{issue.description}</p>
            </div>
            <Badge variant={severityBadgeVariant(issue.severity)}>{issue.severity}</Badge>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function OpportunitiesPanel({ opportunities }: { opportunities: ClientOpportunity[] }) {
  if (opportunities.length === 0) return null;
  return (
    <SectionCard title="Opportunities" description="Areas to capitalize on">
      <div className="space-y-2">
        {opportunities.map((op) => (
          <div key={op.id} className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-4 py-3">
            <p className="text-sm font-medium text-emerald-300">{op.title}</p>
            <p className="mt-0.5 text-xs text-emerald-400/70">{op.description}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Data warning banner ─────────────────────────────────────────────────────

function DataWarningBanner({ data }: { data: ClientDecisionSummary }) {
  const warnings: string[] = [];
  if (data.noData) warnings.push("No data available for yesterday. Reconciliation may not have run.");
  if (data.hasPartialData) warnings.push("Spend recorded but no CRM revenue — attribution may be incomplete.");
  if (data.hasMissingGoals) warnings.push("No ROAS or CPA goals configured for this client.");

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-3">
      <p className="text-xs font-semibold text-amber-300">Data Notes</p>
      <ul className="mt-1.5 space-y-1">
        {warnings.map((w, i) => (
          <li key={i} className="text-xs text-amber-400/80">{w}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export default function ClientDecisionView({ data }: { data: ClientDecisionSummary }) {
  const yesterdayLabel = new Date(data.yesterday.date + "T12:00:00Z")
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <PageContainer className="max-w-5xl">
      {/* Header */}
      <div className="mb-2">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
          ← Back to Daily Summary
        </Link>
      </div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-white sm:text-xl">{data.clientName}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Decision View · {yesterdayLabel} · CRM source of truth · 7-day attribution
          </p>
        </div>
        <Link
          href={`/clients/${data.clientId}`}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Full Client View →
        </Link>
      </div>

      {/* Data warnings */}
      <DataWarningBanner data={data} />

      {/* Yesterday KPIs */}
      <div className="mt-4">
        <YesterdayKPIs data={data} />
      </div>

      {/* Three decision sections */}
      <div className="mt-6 space-y-5">
        <ChangesSection changes={data.changes} />
        <DriversSection drivers={data.drivers} />
        <ActionsSection actions={data.actions} />
      </div>

      {/* Issues & Opportunities — side by side on desktop */}
      {(data.issues.length > 0 || data.opportunities.length > 0) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <IssuesPanel issues={data.issues} />
          <OpportunitiesPanel opportunities={data.opportunities} />
        </div>
      )}
    </PageContainer>
  );
}
