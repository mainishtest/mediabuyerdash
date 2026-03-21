"use client";

// app/onboarding/[clientId]/OnboardingReadinessView.tsx
// Full onboarding readiness UI.
// Mobile: stacked sections, thumb-friendly actions.
// Desktop: two-column layout — checklist left, details right.

import Link from "next/link";
import type {
  GoLiveSummary,
  OnboardingBlocker,
  OnboardingChecklistItem,
  ChecklistCategory,
  OnboardingReadinessStatus,
} from "@/types/onboarding";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<OnboardingReadinessStatus, string> = {
  not_started:       "bg-slate-800 text-slate-400 border-slate-700",
  in_progress:       "bg-blue-950 text-blue-300 border-blue-800",
  blocked:           "bg-rose-950 text-rose-300 border-rose-800",
  needs_review:      "bg-amber-950 text-amber-300 border-amber-800",
  ready_for_go_live: "bg-emerald-950 text-emerald-300 border-emerald-800",
  live:              "bg-emerald-900 text-emerald-200 border-emerald-700",
};

const STATUS_LABELS: Record<OnboardingReadinessStatus, string> = {
  not_started:       "Not Started",
  in_progress:       "In Progress",
  blocked:           "Blocked",
  needs_review:      "Needs Review",
  ready_for_go_live: "Ready for Go-Live",
  live:              "Live",
};

function StatusBadge({ status }: { status: OnboardingReadinessStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{completed} of {total} required items complete</span>
        <span className="font-semibold text-slate-300">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Blocker card ──────────────────────────────────────────────────────────────

function BlockerCard({ blocker }: { blocker: OnboardingBlocker }) {
  const isCritical = blocker.severity === "critical";
  return (
    <div
      className={`rounded-lg border p-4 ${
        isCritical
          ? "border-rose-800/50 bg-rose-950/30"
          : "border-amber-800/40 bg-amber-950/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              isCritical ? "text-rose-300" : "text-amber-300"
            }`}
          >
            {isCritical ? "⛔ " : "⚠️ "}
            {blocker.label}
          </p>
          {blocker.detail && (
            <p className="mt-1 text-xs text-slate-500">{blocker.detail}</p>
          )}
        </div>
        {blocker.actionLabel && blocker.actionHref && (
          <Link
            href={blocker.actionHref}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isCritical
                ? "border-rose-700 text-rose-300 hover:bg-rose-900/40"
                : "border-amber-700 text-amber-300 hover:bg-amber-900/40"
            }`}
          >
            {blocker.actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Checklist item ────────────────────────────────────────────────────────────

const ITEM_ICON: Record<string, string> = {
  complete:   "✓",
  incomplete: "○",
  warning:    "△",
  optional:   "–",
};

const ITEM_COLORS: Record<string, string> = {
  complete:   "text-emerald-400",
  incomplete: "text-slate-500",
  warning:    "text-amber-400",
  optional:   "text-slate-600",
};

function ChecklistRow({ item }: { item: OnboardingChecklistItem }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span
        className={`mt-px shrink-0 text-sm font-bold ${ITEM_COLORS[item.status]}`}
      >
        {ITEM_ICON[item.status]}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            item.status === "complete" ? "text-slate-300" : "text-slate-400"
          }`}
        >
          {item.label}
          {!item.required && (
            <span className="ml-1.5 text-xs text-slate-600">(optional)</span>
          )}
        </p>
        {item.detail && (
          <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  account:     "Account Setup",
  integration: "Integrations",
  attribution: "Attribution & Timezone",
  goals:       "Goals & Targets",
  governance:  "Governance & Auto-Execution",
  sync:        "Sync Health",
};

const CATEGORY_ORDER: ChecklistCategory[] = [
  "account",
  "integration",
  "attribution",
  "goals",
  "governance",
  "sync",
];

function ChecklistSection({
  category,
  items,
}: {
  category: ChecklistCategory;
  items: OnboardingChecklistItem[];
}) {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.required && i.status === "complete").length;
  const total = items.filter((i) => i.required).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-300">
          {CATEGORY_LABELS[category]}
        </h3>
        {total > 0 && (
          <span className="text-xs text-slate-500">
            {done}/{total}
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-800/50 px-5">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  href,
  label,
  variant = "secondary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors ${
        variant === "primary"
          ? "bg-emerald-600 text-white hover:bg-emerald-500"
          : "border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-200"
      }`}
    >
      {label}
    </Link>
  );
}

// ── Sync health summary ───────────────────────────────────────────────────────

const SYNC_COLORS: Record<string, string> = {
  healthy: "text-emerald-400",
  stale:   "text-amber-400",
  failed:  "text-rose-400",
  never:   "text-slate-500",
};

function SyncPill({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-xs font-semibold uppercase ${SYNC_COLORS[status] ?? "text-slate-500"}`}>
        {status}
      </span>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function OnboardingReadinessView({ summary }: { summary: GoLiveSummary }) {
  const byCategory = CATEGORY_ORDER.reduce<
    Record<ChecklistCategory, OnboardingChecklistItem[]>
  >(
    (acc, cat) => {
      acc[cat] = summary.checklist.filter((i) => i.category === cat);
      return acc;
    },
    { account: [], integration: [], attribution: [], goals: [], governance: [], sync: [] }
  );

  const criticalBlockers = summary.blockers.filter((b) => b.severity === "critical");
  const warningBlockers  = summary.blockers.filter((b) => b.severity === "warning");

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/clients" className="hover:text-slate-400">Clients</Link>
            <span>/</span>
            <Link href={`/clients/${summary.clientId}`} className="hover:text-slate-400">
              {summary.clientName}
            </Link>
            <span>/</span>
            <span className="text-slate-400">Onboarding</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
                {summary.clientName}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Onboarding · {summary.timezone}
              </p>
            </div>
            <StatusBadge status={summary.status} />
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <ProgressBar
            completed={summary.completedCount}
            total={summary.totalRequiredCount}
          />
          {summary.readyForGoLive && (
            <div className="mt-4 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
              ✓ All required checks pass — this account is ready to operate.
            </div>
          )}
        </div>

        {/* Two-column layout on desktop */}
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">

          {/* Left column: blockers + checklist */}
          <div className="space-y-4">

            {/* Critical blockers */}
            {criticalBlockers.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-500">
                  Critical Blockers
                </h2>
                {criticalBlockers.map((b) => (
                  <BlockerCard key={b.id} blocker={b} />
                ))}
              </div>
            )}

            {/* Warning blockers */}
            {warningBlockers.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                  Warnings
                </h2>
                {warningBlockers.map((b) => (
                  <BlockerCard key={b.id} blocker={b} />
                ))}
              </div>
            )}

            {/* Checklist sections */}
            <div className="space-y-3">
              {CATEGORY_ORDER.map((cat) => (
                <ChecklistSection
                  key={cat}
                  category={cat}
                  items={byCategory[cat]}
                />
              ))}
            </div>
          </div>

          {/* Right column: actions + summary panels */}
          <div className="mt-4 space-y-4 lg:mt-0">

            {/* Quick actions */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Quick Actions
              </h2>
              <div className="space-y-2">
                {!summary.integration.meta.connected && (
                  <ActionButton href="/integrations" label="Connect Meta Account" variant="primary" />
                )}
                {!summary.integration.shopify.connected && (
                  <ActionButton href="/integrations" label="Connect Shopify / CRM" variant="primary" />
                )}
                {!summary.goalSetup.hasGoals && (
                  <ActionButton
                    href={`/clients/${summary.clientId}`}
                    label="Configure Goals"
                    variant="primary"
                  />
                )}
                {!summary.attribution.timezoneConfigured && (
                  <ActionButton
                    href={`/clients/${summary.clientId}`}
                    label="Set Timezone"
                  />
                )}
                {!summary.governance.hasAutoExecution && (
                  <ActionButton
                    href={`/clients/${summary.clientId}`}
                    label="Configure Autonomy Defaults"
                  />
                )}
                <ActionButton
                  href={`/clients/${summary.clientId}`}
                  label="Open Account Dashboard"
                />
              </div>
            </div>

            {/* Sync health */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sync Health
              </h2>
              <div className="space-y-2">
                <SyncPill label="Meta Sync" status={summary.syncHealth.metaSyncStatus} />
                <SyncPill label="Shopify Sync" status={summary.syncHealth.shopifySyncStatus} />
              </div>
              {summary.syncHealth.recentErrors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {summary.syncHealth.recentErrors.map((e, i) => (
                    <p key={i} className="text-xs text-rose-400">{e}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Goal summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Goal Targets
              </h2>
              {summary.goalSetup.hasGoals ? (
                <div className="space-y-2">
                  {summary.goalSetup.roasTarget && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">ROAS Target</span>
                      <span className="text-sm font-semibold text-slate-200">
                        {summary.goalSetup.roasTarget}x
                      </span>
                    </div>
                  )}
                  {summary.goalSetup.cpaTarget && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">CPA Target</span>
                      <span className="text-sm font-semibold text-slate-200">
                        ${summary.goalSetup.cpaTarget}
                      </span>
                    </div>
                  )}
                  {summary.goalSetup.maxDailySpend && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Max Daily Spend</span>
                      <span className="text-sm font-semibold text-slate-200">
                        ${summary.goalSetup.maxDailySpend}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Attribution Window</span>
                    <span className="text-sm font-semibold text-slate-200">7 days</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No goals configured yet.</p>
              )}
            </div>

            {/* Attribution */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Attribution Setup
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Timezone</span>
                  <span className="text-sm text-slate-300">{summary.timezone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Attribution Window</span>
                  <span className="text-sm text-slate-300">7 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Dayparting</span>
                  <span className="text-sm text-slate-300">Ad account TZ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">CRM Source</span>
                  <span className="text-sm text-slate-300">Shopify</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
