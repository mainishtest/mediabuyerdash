"use client";

// app/readiness/ReadinessView.tsx
// Go-live readiness dashboard. Shows checklist, blockers, and recommendations.

import Link from "next/link";
import type { AccountReadinessSummary, AccountReadinessCheck, ReadinessCategory } from "../../lib/readiness/types";
import { READINESS_CATEGORIES } from "../../lib/readiness/types";

type Props = {
  summary: AccountReadinessSummary;
};

// ── Status helpers ────────────────────────────────────────────────────────────

function statusIcon(status: AccountReadinessCheck["status"]) {
  switch (status) {
    case "pass":    return { icon: "✓", cls: "bg-emerald-700 text-emerald-100" };
    case "fail":    return { icon: "✕", cls: "bg-rose-700 text-rose-100" };
    case "warning": return { icon: "!", cls: "bg-amber-700 text-amber-100" };
    case "skipped": return { icon: "–", cls: "bg-slate-700 text-slate-400" };
  }
}

function goLiveColor(state: string) {
  switch (state) {
    case "ready_for_go_live": return "border-emerald-700/50 bg-emerald-950/30 text-emerald-300";
    case "needs_review":      return "border-amber-700/50 bg-amber-950/30 text-amber-300";
    case "blocked":           return "border-rose-700/50 bg-rose-950/30 text-rose-300";
    default:                  return "border-slate-700 bg-slate-900/40 text-slate-300";
  }
}

function goLiveLabel(state: string) {
  switch (state) {
    case "ready_for_go_live": return "Ready for Go-Live";
    case "needs_review":      return "Needs Review";
    case "blocked":           return "Blocked";
    case "not_started":       return "Not Started";
    case "live":              return "Live";
    default:                  return "In Progress";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReadinessView({ summary }: Props) {
  const { checks, blockers, goLiveStatus, recommendations } = summary;

  // Group checks by category
  const grouped = READINESS_CATEGORIES.map((cat) => ({
    ...cat,
    checks: checks.filter((c) => c.category === cat.id),
  })).filter((g) => g.checks.length > 0);

  const progressPct = goLiveStatus.requiredTotalCount > 0
    ? Math.round((goLiveStatus.requiredPassCount / goLiveStatus.requiredTotalCount) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Account Readiness
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Review your setup status and resolve any blockers before going live.
        </p>
      </div>

      {/* Go-live status banner */}
      <div className={`mb-6 rounded-xl border p-5 ${goLiveColor(goLiveStatus.state)}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                goLiveStatus.state === "ready_for_go_live" ? "bg-emerald-600 text-white"
                : goLiveStatus.state === "blocked" ? "bg-rose-600 text-white"
                : "bg-amber-600 text-white"
              }`}>
                {goLiveStatus.state === "ready_for_go_live" ? "✓" : goLiveStatus.state === "blocked" ? "!" : "?"}
              </span>
              <h2 className="text-lg font-semibold">{goLiveLabel(goLiveStatus.state)}</h2>
            </div>
            <p className="mt-1 text-sm opacity-80">{goLiveStatus.message}</p>
          </div>

          {goLiveStatus.readyToOperate && (
            <Link
              href="/home"
              className="shrink-0 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Go to Dashboard
            </Link>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>Required: {goLiveStatus.requiredPassCount}/{goLiveStatus.requiredTotalCount}</span>
            <span>Optional: {goLiveStatus.optionalPassCount}/{goLiveStatus.optionalTotalCount}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className={`h-full rounded-full transition-all ${
                goLiveStatus.state === "ready_for_go_live" ? "bg-emerald-500"
                : goLiveStatus.state === "blocked" ? "bg-rose-500"
                : "bg-amber-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Blockers — shown prominently when present */}
      {blockers.length > 0 && (
        <div className="mb-6 rounded-xl border border-rose-800/50 bg-rose-950/20 p-5">
          <h3 className="mb-3 text-sm font-semibold text-rose-300">
            Blockers ({blockers.length})
          </h3>
          <div className="space-y-2">
            {blockers.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-3 rounded-lg bg-rose-950/30 px-3 py-2.5">
                <p className="text-sm text-rose-200">{b.message}</p>
                <Link
                  href={b.actionHref}
                  className="shrink-0 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-600"
                >
                  {b.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist by category */}
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
                    Complete
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {group.checks.map((check) => {
                  const si = statusIcon(check.status);
                  return (
                    <div key={check.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${si.cls}`}>
                        {si.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            check.status === "pass" ? "text-slate-200"
                            : check.status === "fail" ? "text-rose-300"
                            : "text-slate-400"
                          }`}>
                            {check.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{check.description}</p>
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
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations — shown when there are suggestions */}
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

      {/* Data health link */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Data Health Check</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Validate your synced data before relying on dashboard numbers.
            </p>
          </div>
          <Link
            href="/health"
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
          >
            View Health Check
          </Link>
        </div>
      </div>

      {/* Footer links */}
      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        <Link href="/onboarding" className="text-slate-500 transition-colors hover:text-slate-300">
          Back to Onboarding
        </Link>
        <Link href="/health" className="text-slate-500 transition-colors hover:text-slate-300">
          Data Health
        </Link>
        <Link href="/home" className="text-slate-500 transition-colors hover:text-slate-300">
          Go to Dashboard
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
