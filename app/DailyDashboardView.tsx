"use client";

import { useState } from "react";
import Link from "next/link";
import { PageContainer } from "../components/ui/PageContainer";
import { StatCard }      from "../components/ui/StatCard";
import { SectionCard }   from "../components/ui/SectionCard";
import { Badge }         from "../components/ui/Badge";
import { EmptyState }    from "../components/ui/EmptyState";
import {
  statusLabel,
  statusBadgeVariant,
  trendArrow,
  trendColor,
} from "../lib/dailySummary/status";
import type {
  DailyExecutiveSummary,
  DailySummaryFilterState,
  ClientDailySummary,
  ClientPerformanceStatus,
  ClientTrendDirection,
  ClientRiskLevel,
  DataTrustLevel,
} from "../types/dailySummary";

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtCurrency(n: number, currency = "USD"): string {
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

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}%`;
}

// ── Filter select component ─────────────────────────────────────────────────

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label:    string;
  value:    T | "";
  onChange: (v: T | "") => void;
  options:  { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "")}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200
                   focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ── Client card component ───────────────────────────────────────────────────

function ClientCard({ client }: { client: ClientDailySummary }) {
  const borderColor = {
    scaling:           "border-l-emerald-500",
    stable:            "border-l-slate-600",
    at_risk:           "border-l-amber-500",
    critical:          "border-l-rose-500",
    insufficient_data: "border-l-sky-500",
  }[client.status];

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 border-l-4 ${borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">{client.clientName}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${trendColor(client.trend)}`}>
            {trendArrow(client.trend)} 3d
          </span>
          <Badge variant={statusBadgeVariant(client.status)}>
            {statusLabel(client.status)}
          </Badge>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px border-t border-slate-800/60 bg-slate-800/30 sm:grid-cols-4">
        <MetricCell label="Spend" value={fmtCurrency(client.spend)} />
        <MetricCell label="Revenue" value={fmtCurrency(client.revenue)} />
        <MetricCell
          label="ROAS"
          value={fmtRoas(client.roas)}
          sub={client.roasGoal ? `Goal: ${client.roasGoal.toFixed(1)}x` : undefined}
          highlight={client.roasVsGoalPct}
        />
        <MetricCell
          label="CPA"
          value={fmtCpa(client.cpa)}
          sub={client.cpaGoal ? `Goal: ${fmtCpa(client.cpaGoal)}` : undefined}
          highlight={client.cpaVsGoalPct !== null ? -client.cpaVsGoalPct : null}
        />
      </div>

      {/* Warnings */}
      {(client.hasStaleSync || client.hasMissingGoals || client.hasPartialData) && (
        <div className="flex flex-wrap gap-2 border-t border-slate-800/60 px-4 py-2 sm:px-5">
          {client.hasStaleSync && (
            <span className="text-xs text-amber-400">Stale sync</span>
          )}
          {client.hasMissingGoals && (
            <span className="text-xs text-slate-500">No goals set</span>
          )}
          {client.hasPartialData && (
            <span className="text-xs text-amber-400">Partial CRM data</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800/60 px-4 py-3 sm:px-5">
        {client.actions.map((action) => (
          <Link
            key={action.action + action.label}
            href={action.href}
            className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium
              transition-colors min-h-[36px] sm:min-h-[32px] ${actionButtonClass(action.variant)}`}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: number | null;
}) {
  const highlightColor =
    highlight === null || highlight === undefined ? "" :
    highlight > 0 ? "text-emerald-400" :
    highlight < -15 ? "text-rose-400" :
    highlight < 0 ? "text-amber-400" : "";

  return (
    <div className="px-4 py-2.5 sm:px-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlightColor || "text-white"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}

function actionButtonClass(variant: string): string {
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

// ── Alerts banner ───────────────────────────────────────────────────────────

function AlertsBanner({ data }: { data: DailyExecutiveSummary }) {
  const warnings: string[] = [];
  if (data.noDataYesterday) warnings.push("No data available for yesterday. Reconciliation may not have completed.");
  if (data.hasStaleSync)    warnings.push("Some accounts have stale sync data (>48h).");
  if (data.hasPartialCrm)   warnings.push("Some accounts have spend but no CRM revenue — partial attribution.");
  if (data.hasMissingGoals) warnings.push("Some accounts have no ROAS/CPA goals configured.");

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-3 sm:px-5">
      <p className="text-xs font-semibold text-amber-300">Data Notes</p>
      <ul className="mt-1.5 space-y-1">
        {warnings.map((w, i) => (
          <li key={i} className="text-xs text-amber-400/80">{w}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Trust state banner ──────────────────────────────────────────────────────

function TrustBanner({ trustState, trustMessage }: { trustState: DataTrustLevel; trustMessage: string }) {
  if (trustState === "healthy") return null;

  const config: Record<string, { border: string; bg: string; text: string; labelColor: string; label: string }> = {
    unverified: { border: "border-slate-700", bg: "bg-slate-900/60", text: "text-slate-400", labelColor: "text-slate-300", label: "Unverified" },
    warning:    { border: "border-amber-800/40", bg: "bg-amber-950/30", text: "text-amber-400/80", labelColor: "text-amber-300", label: "Data Warning" },
    suspect:    { border: "border-orange-800/40", bg: "bg-orange-950/30", text: "text-orange-400/80", labelColor: "text-orange-300", label: "Suspect Data" },
    blocked:    { border: "border-rose-800/40", bg: "bg-rose-950/30", text: "text-rose-400/80", labelColor: "text-rose-300", label: "Blocked" },
  };
  const c = config[trustState] ?? config.warning;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} px-4 py-3 sm:px-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold ${c.labelColor}`}>{c.label}</p>
          <p className={`mt-1 text-xs ${c.text}`}>{trustMessage}</p>
        </div>
        <Link
          href="/health"
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white min-h-[36px] inline-flex items-center"
        >
          View Health Check
        </Link>
      </div>
    </div>
  );
}

// ── Main dashboard view ─────────────────────────────────────────────────────

export default function DailyDashboardView({ data }: { data: DailyExecutiveSummary }) {
  const [filters, setFilters] = useState<DailySummaryFilterState>({
    clientId: "",
    status:   "",
    riskLevel: "",
    trend:    "",
  });

  const p = data.portfolio;

  // Apply filters
  const filtered = data.clients.filter((c) => {
    if (filters.clientId && c.clientId !== filters.clientId) return false;
    if (filters.status   && c.status   !== filters.status)   return false;
    if (filters.trend    && c.trend    !== filters.trend)    return false;
    return true;
  });

  return (
    <PageContainer className="max-w-6xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white sm:text-xl">Daily Summary</h1>
        <p className="mt-1 text-xs text-slate-500">{p.dateLabel} · CRM source of truth · 7-day attribution</p>
      </div>

      {/* Trust state banner */}
      <TrustBanner trustState={data.trustState} trustMessage={data.trustMessage} />

      {/* Alerts banner */}
      <AlertsBanner data={data} />

      {/* SECTION 1: Portfolio Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Total Spend" value={fmtCurrency(p.totalSpend)} />
        <StatCard label="CRM Revenue" value={fmtCurrency(p.totalRevenue)} />
        <StatCard label="Blended ROAS" value={fmtRoas(p.blendedRoas)} />
        <StatCard label="Blended CPA" value={fmtCpa(p.blendedCpa)} />
        <StatCard
          label="Scaling"
          value={p.scalingCount}
          sub={`of ${p.totalClients}`}
        />
        <StatCard
          label="At Risk"
          value={p.atRiskCount + p.criticalCount}
          sub={p.criticalCount > 0 ? `${p.criticalCount} critical` : undefined}
        />
        <StatCard label="Stable" value={p.stableCount} />
        {p.insufficientDataCount > 0 && (
          <StatCard label="No Data" value={p.insufficientDataCount} />
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <FilterSelect<string>
          label="Client"
          value={filters.clientId}
          onChange={(v) => setFilters((f) => ({ ...f, clientId: v }))}
          options={data.clientOptions.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect<ClientPerformanceStatus>
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={[
            { value: "scaling",           label: "Scaling" },
            { value: "stable",            label: "Stable" },
            { value: "at_risk",           label: "At Risk" },
            { value: "critical",          label: "Critical" },
            { value: "insufficient_data", label: "No Data" },
          ]}
        />
        <FilterSelect<ClientTrendDirection>
          label="Trend"
          value={filters.trend}
          onChange={(v) => setFilters((f) => ({ ...f, trend: v }))}
          options={[
            { value: "up",   label: "Up" },
            { value: "flat", label: "Flat" },
            { value: "down", label: "Down" },
          ]}
        />
      </div>

      {/* SECTION 2 + 3: Client Cards with Actions */}
      <div className="mt-5">
        <SectionCard
          title="Client Performance"
          description={`${filtered.length} account${filtered.length !== 1 ? "s" : ""}`}
        >
          {filtered.length === 0 ? (
            <EmptyState
              title="No accounts match filters"
              description="Adjust filters to see client performance cards."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((client) => (
                <ClientCard key={client.clientId} client={client} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
