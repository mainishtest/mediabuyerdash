"use client";

// app/clients/[clientId]/setup/ClientSetupView.tsx
// Main view for the first live client setup path.
//
// Responsive layout:
//   Mobile:  single column — progress, next-action banner, step cards, quick links
//   Desktop: two-column grid — sidebar (readiness + step list + quick links) | main (banner + step cards)
//
// Sync trigger:
//   The "Run First Sync" CTA calls runClientSyncAction from the existing syncActions.
//   On success, router.refresh() re-renders the server page with fresh data.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageContainer, PageHeader, Badge } from "../../../../components/ui";
import type { ClientSetupSummary } from "../../../../types/clientSetup";
import { SetupStepCard } from "./SetupStepCard";
import { runClientSyncAction } from "../syncActions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:     string;
  clientName:   string;
  setupSummary: ClientSetupSummary;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ClientSetupView({ clientId, clientName, setupSummary: setup }: Props) {
  const router                     = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncError, setSyncError]  = useState<string | null>(null);

  // ── Sync handler ─────────────────────────────────────────────────────────

  function handleRunSync() {
    setSyncError(null);
    startTransition(async () => {
      const res = await runClientSyncAction(clientId, "full");
      if (res.success) {
        router.refresh();
      } else {
        setSyncError(res.error);
      }
    });
  }

  // ── Readiness badge ───────────────────────────────────────────────────────

  const readinessBadge = setup.isLive ? (
    <Badge variant="success">Live</Badge>
  ) : setup.completedCount >= 4 ? (
    <Badge variant="info">Ready for sync</Badge>
  ) : setup.completedCount > 1 ? (
    <Badge variant="warning">In progress</Badge>
  ) : (
    <Badge variant="neutral">Not started</Badge>
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const progressPct = (setup.completedCount / setup.totalCount) * 100;
  const isNextStepSync = setup.currentStepId === "run_first_sync";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer>

      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <Link
        href={`/clients/${clientId}`}
        className="mb-5 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        ← Back to {clientName}
      </Link>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <PageHeader
        title="Client Setup"
        description={`Walk through the steps to bring ${clientName} live.`}
        badge={readinessBadge}
        actions={
          setup.isLive ? (
            <Link
              href={`/clients/${clientId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              View Dashboard →
            </Link>
          ) : undefined
        }
      />

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Setup Progress</span>
          <span className="text-xs font-semibold text-slate-200">
            {setup.completedCount} of {setup.totalCount} steps complete
          </span>
        </div>

        {/* Track */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              setup.isLive ? "bg-emerald-500" : "bg-sky-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="mt-3 flex items-center justify-between px-0.5">
          {setup.steps.map((s) => (
            <div
              key={s.id}
              title={s.label}
              className={`h-2 w-2 rounded-full transition-colors ${
                s.status === "complete"
                  ? "bg-emerald-500"
                  : s.status === "current"
                  ? "bg-sky-400 ring-2 ring-sky-400/30"
                  : "bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Two-column desktop layout ───────────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:items-start lg:gap-8">

        {/* ── Left sidebar (desktop only) ───────────────────────────────────── */}
        <div className="hidden space-y-4 lg:block">

          {/* Readiness score card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Readiness
            </p>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-3xl font-bold tabular-nums text-slate-100">
                {setup.completedCount}
              </span>
              <span className="mb-0.5 text-base text-slate-500">/ {setup.totalCount}</span>
            </div>
            <p className="text-xs text-slate-400">{setup.readinessLabel}</p>
            {setup.isLive && setup.lastSyncAt && (
              <p className="mt-2 text-[11px] text-emerald-400">
                Last synced {new Date(setup.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Compact step list */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Steps
            </p>
            <div className="space-y-1.5">
              {setup.steps.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 py-0.5 text-sm ${
                    s.status === "complete"
                      ? "text-slate-300"
                      : s.status === "current"
                      ? "font-semibold text-sky-300"
                      : "text-slate-600"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      s.status === "complete"
                        ? "bg-emerald-600 text-white"
                        : s.status === "current"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800 text-slate-600"
                    }`}
                  >
                    {s.status === "complete" ? "✓" : i + 1}
                  </span>
                  <span className="truncate">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <QuickLinks clientId={clientId} />
        </div>

        {/* ── Right: main content ──────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* ── Success state (when live) ─────────────────────────────────── */}
          {setup.isLive && (
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-400">
                  ✓
                </div>
                <div className="flex-1">
                  <h2 className="mb-1 text-base font-semibold text-emerald-300">
                    {clientName} is Live
                  </h2>
                  {setup.lastSyncAt && (
                    <p className="mb-4 text-xs text-slate-400">
                      Last synced {new Date(setup.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/clients/${clientId}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                    >
                      View Dashboard →
                    </Link>
                    <Link
                      href={`/clients/${clientId}/campaigns`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                    >
                      Campaign Performance →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Next action banner (when not live) ───────────────────────── */}
          {!setup.isLive && (
            <div className="rounded-xl border border-sky-800/50 bg-sky-950/30 p-4 sm:p-5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-sky-500">
                Next Step
              </p>
              <p className="mb-3 text-sm text-slate-200">{setup.nextAction.label}</p>

              {isNextStepSync ? (
                <div>
                  <button
                    onClick={handleRunSync}
                    disabled={isPending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isPending ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        Syncing…
                      </>
                    ) : (
                      setup.nextAction.ctaLabel
                    )}
                  </button>
                  {syncError && (
                    <p className="mt-2 text-xs text-rose-400">{syncError}</p>
                  )}
                </div>
              ) : (
                <Link
                  href={setup.nextAction.ctaHref}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 sm:w-auto"
                >
                  {setup.nextAction.ctaLabel} →
                </Link>
              )}
            </div>
          )}

          {/* ── Step cards ───────────────────────────────────────────────── */}
          <div className="space-y-3">
            {setup.steps.map((s, i) => (
              <SetupStepCard
                key={s.id}
                step={s}
                stepNumber={i + 1}
                onRunSync={s.id === "run_first_sync" ? handleRunSync : undefined}
                syncing={isPending}
              />
            ))}
          </div>

          {/* ── Mobile quick links ───────────────────────────────────────── */}
          <div className="lg:hidden">
            <QuickLinks clientId={clientId} />
          </div>

        </div>
      </div>
    </PageContainer>
  );
}

// ── Quick links sub-component ─────────────────────────────────────────────────

function QuickLinks({ clientId }: { clientId: string }) {
  const links = [
    { href: "/integrations/meta",              label: "Meta Integration",    dot: "text-blue-400" },
    { href: "/integrations/shopify",           label: "Shopify Integration", dot: "text-green-400" },
    { href: `/clients/${clientId}#integrations`, label: "Map Integrations",  dot: "text-purple-400" },
    { href: `/clients/${clientId}#sync`,       label: "Run / View Sync",     dot: "text-amber-400" },
    { href: `/clients/${clientId}/sync`,       label: "Sync History",        dot: "text-slate-400" },
    { href: `/clients/${clientId}/campaigns`,  label: "Campaigns",           dot: "text-emerald-400" },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Quick Links
      </p>

      {/* Desktop: stacked list */}
      <div className="hidden space-y-1.5 lg:block">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-2 py-0.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
          >
            <span className={`text-[10px] ${l.dot}`}>◆</span>
            {l.label}
          </Link>
        ))}
      </div>

      {/* Mobile: 2-col grid */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-center text-xs text-slate-300 transition-colors hover:bg-slate-800"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
