"use client";

// app/health/HealthView.tsx
// First-sync data validation and account health dashboard.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { AccountHealthSummary, AccountHealthCheck, DataTrustState } from "../../lib/health/types";
import { HEALTH_CATEGORIES } from "../../lib/health/types";

type Props = { summary: AccountHealthSummary };

// ── Visual helpers ────────────────────────────────────────────────────────────

function trustColor(state: DataTrustState) {
  switch (state) {
    case "healthy":    return "border-emerald-700/50 bg-emerald-950/30 text-emerald-300";
    case "warning":    return "border-amber-700/50 bg-amber-950/30 text-amber-300";
    case "suspect":    return "border-orange-700/50 bg-orange-950/30 text-orange-300";
    case "blocked":    return "border-rose-700/50 bg-rose-950/30 text-rose-300";
    case "unverified": return "border-slate-700 bg-slate-900/40 text-slate-300";
  }
}

function trustLabel(state: DataTrustState) {
  switch (state) {
    case "healthy":    return "Data Healthy";
    case "warning":    return "Warnings Detected";
    case "suspect":    return "Anomalies Detected";
    case "blocked":    return "Critical Issues";
    case "unverified": return "Unverified";
  }
}

function trustIcon(state: DataTrustState) {
  switch (state) {
    case "healthy":    return { icon: "✓", cls: "bg-emerald-600 text-white" };
    case "warning":    return { icon: "!", cls: "bg-amber-600 text-white" };
    case "suspect":    return { icon: "?", cls: "bg-orange-600 text-white" };
    case "blocked":    return { icon: "✕", cls: "bg-rose-600 text-white" };
    case "unverified": return { icon: "–", cls: "bg-slate-600 text-white" };
  }
}

function checkStatusIcon(status: AccountHealthCheck["status"]) {
  switch (status) {
    case "pass":    return { icon: "✓", cls: "bg-emerald-700 text-emerald-100" };
    case "fail":    return { icon: "✕", cls: "bg-rose-700 text-rose-100" };
    case "warning": return { icon: "!", cls: "bg-amber-700 text-amber-100" };
    case "skipped": return { icon: "–", cls: "bg-slate-700 text-slate-400" };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HealthView({ summary }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { trustState, trustMessage, checks, issues, recommendations, spendSummary, revenueSummary, syncFreshnessHours } = summary;

  const ti = trustIcon(trustState);
  const canProceed = trustState === "healthy" || trustState === "warning";

  // Group checks by category
  const grouped = HEALTH_CATEGORIES.map((cat) => ({
    ...cat,
    checks: checks.filter((c) => c.category === cat.id),
  })).filter((g) => g.checks.length > 0);

  const passCount = checks.filter((c) => c.status === "pass").length;

  function handleRetry() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Account Health Check
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Validate your synced data before relying on dashboard numbers.
        </p>
      </div>

      {/* Trust state banner */}
      <div className={`mb-6 rounded-xl border p-5 ${trustColor(trustState)}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${ti.cls}`}>
                {ti.icon}
              </span>
              <h2 className="text-lg font-semibold">{trustLabel(trustState)}</h2>
            </div>
            <p className="mt-1 text-sm opacity-80">{trustMessage}</p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleRetry}
              disabled={isPending}
              className="rounded-lg border border-current/20 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {isPending ? "Checking..." : "Retry Validation"}
            </button>
            {canProceed && (
              <Link
                href="/home"
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                Continue to Dashboard
              </Link>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs opacity-70">
          <span>{passCount}/{checks.length} checks pass</span>
          <span>{issues.filter((i) => i.severity === "critical").length} critical</span>
          <span>{issues.filter((i) => i.severity === "warning").length} warnings</span>
        </div>
      </div>

      {/* Data summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-xs font-medium text-slate-500 uppercase">Meta Spend (14d)</h3>
          <p className="mt-1 text-xl font-bold text-white">
            {spendSummary.hasSpend ? `$${spendSummary.totalSpend.toLocaleString()}` : "No data"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {spendSummary.hasSpend
              ? `${spendSummary.daysCovered} days covered, avg $${spendSummary.avgDailySpend}/day`
              : "Run a Meta sync to import spend data"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-xs font-medium text-slate-500 uppercase">Revenue (14d)</h3>
          <p className="mt-1 text-xl font-bold text-white">
            {revenueSummary.hasRevenue ? `$${revenueSummary.totalRevenue.toLocaleString()}` : "No data"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {revenueSummary.hasRevenue
              ? `${revenueSummary.orderCount} orders, ${revenueSummary.daysCovered} days covered`
              : "Run a Shopify sync to import order data"}
          </p>
          {revenueSummary.hasFbAttribution && (
            <p className="mt-0.5 text-xs text-slate-500">
              ${revenueSummary.fbAttributedRevenue.toLocaleString()} Facebook-attributed
            </p>
          )}
        </div>
      </div>

      {/* Critical issues — shown prominently */}
      {issues.filter((i) => i.severity === "critical").length > 0 && (
        <div className="mb-6 rounded-xl border border-rose-800/50 bg-rose-950/20 p-5">
          <h3 className="mb-3 text-sm font-semibold text-rose-300">
            Critical Issues ({issues.filter((i) => i.severity === "critical").length})
          </h3>
          <div className="space-y-2">
            {issues.filter((i) => i.severity === "critical").map((issue) => (
              <div key={issue.id} className="flex items-start justify-between gap-3 rounded-lg bg-rose-950/30 px-3 py-2.5">
                <p className="text-sm text-rose-200">{issue.message}</p>
                <Link
                  href={issue.actionHref}
                  className="shrink-0 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-600"
                >
                  {issue.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checks by category */}
      <div className="space-y-4">
        {grouped.map((group) => {
          const allPass = group.checks.every((c) => c.status === "pass" || c.status === "skipped");
          return (
            <div key={group.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                  {group.required && (
                    <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Required
                    </span>
                  )}
                </div>
                {allPass && (
                  <span className="rounded-full bg-emerald-700/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    Healthy
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {group.checks.map((check) => {
                  const si = checkStatusIcon(check.status);
                  return (
                    <div key={check.id}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${si.cls}`}>
                          {si.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${
                            check.status === "pass" ? "text-slate-200"
                            : check.status === "fail" ? "text-rose-300"
                            : check.status === "warning" ? "text-amber-300"
                            : "text-slate-400"
                          }`}>
                            {check.label}
                          </span>
                          <p className="text-xs text-slate-500">{check.description}</p>
                          {check.detail && (
                            <p className="mt-0.5 text-xs text-slate-600">{check.detail}</p>
                          )}
                        </div>
                        {check.actionLabel && check.actionHref && (
                          <Link
                            href={check.actionHref}
                            className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                          >
                            {check.actionLabel}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync freshness detail */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-2 text-xs font-medium text-slate-500 uppercase">Sync Freshness</h3>
        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          <span>
            Meta: {syncFreshnessHours.meta !== null ? `${syncFreshnessHours.meta}h ago` : "No sync"}
          </span>
          <span>
            Shopify: {syncFreshnessHours.shopify !== null ? `${syncFreshnessHours.shopify}h ago` : "No sync"}
          </span>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">
            Recommended Next Steps
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-slate-800/40 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      rec.priority === "required" ? "bg-rose-800/40 text-rose-300"
                      : rec.priority === "recommended" ? "bg-amber-800/40 text-amber-300"
                      : "bg-slate-700 text-slate-400"
                    }`}>
                      {rec.priority}
                    </span>
                    <span className="text-sm font-medium text-slate-200">{rec.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{rec.description}</p>
                </div>
                <Link
                  href={rec.actionHref}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {rec.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer links */}
      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        <Link href="/readiness" className="text-slate-500 transition-colors hover:text-slate-300">
          Account Readiness
        </Link>
        <Link href="/home" className="text-slate-500 transition-colors hover:text-slate-300">
          Dashboard
        </Link>
        <Link href="/integrations/meta" className="text-slate-500 transition-colors hover:text-slate-300">
          Meta Integration
        </Link>
        <Link href="/integrations/shopify" className="text-slate-500 transition-colors hover:text-slate-300">
          Shopify Integration
        </Link>
      </div>
    </div>
  );
}
