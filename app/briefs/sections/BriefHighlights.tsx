"use client";

// BriefHighlights — Winners, losers, accounts, and blocked items sections.
// Each section routes into the relevant downstream workflow.

import Link from "next/link";
import type {
  DailyBriefWinner,
  DailyBriefLoser,
  DailyBriefBlockedItem,
  DailyBriefAccountSummary,
} from "../../../types/dailyBrief";

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  count,
  accent,
  children,
}: {
  title:    string;
  count:    number;
  accent:   string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${accent}`}>{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── Winners ─────────────────────────────────────────────────────────────────

export function WinnersSection({ winners }: { winners: DailyBriefWinner[] }) {
  return (
    <Section title="Winners" count={winners.length} accent="bg-emerald-500/10 text-emerald-400">
      <div className="space-y-2">
        {winners.map((w) => (
          <Link
            key={w.id}
            href={w.href}
            className="group flex items-center justify-between rounded-lg border border-slate-800
                       bg-slate-900/50 px-4 py-3 transition-colors hover:border-emerald-800/50 hover:bg-slate-800/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-400 group-hover:text-emerald-300">{w.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{w.subtitle}</p>
            </div>
            <div className="ml-3 flex-shrink-0 text-right">
              {w.scaleReady && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  Scale Ready
                </span>
              )}
              {w.lift != null && (
                <p className="mt-1 text-xs text-slate-400">
                  {w.lift >= 0 ? "+" : ""}{(w.lift * 100).toFixed(1)}% lift
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Losers ──────────────────────────────────────────────────────────────────

export function LosersSection({ losers }: { losers: DailyBriefLoser[] }) {
  return (
    <Section title="Need Refresh" count={losers.length} accent="bg-amber-500/10 text-amber-400">
      <div className="space-y-2">
        {losers.map((l) => (
          <Link
            key={l.id}
            href={l.href}
            className="group flex items-center justify-between rounded-lg border border-slate-800
                       bg-slate-900/50 px-4 py-3 transition-colors hover:border-amber-800/50 hover:bg-slate-800/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-400 group-hover:text-amber-300">{l.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{l.subtitle}</p>
            </div>
            <div className="ml-3 flex-shrink-0">
              {l.refreshQueued && (
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
                  Queued
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Blocked items ───────────────────────────────────────────────────────────

export function BlockedSection({ items }: { items: DailyBriefBlockedItem[] }) {
  return (
    <Section title="Blocked" count={items.length} accent="bg-rose-500/10 text-rose-400">
      <div className="space-y-2">
        {items.map((b) => (
          <Link
            key={b.id}
            href={b.href}
            className="group flex items-center justify-between rounded-lg border border-rose-900/30
                       bg-rose-950/20 px-4 py-3 transition-colors hover:border-rose-800/50 hover:bg-rose-900/20"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rose-400 group-hover:text-rose-300">{b.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{b.reason}</p>
            </div>
            <div className="ml-3 flex-shrink-0">
              <span className="text-xs text-slate-600">{b.clientName}</span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Accounts at risk ────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case "critical": return "text-rose-400";
    case "at_risk":  return "text-amber-400";
    case "scaling":  return "text-emerald-400";
    case "stable":   return "text-slate-400";
    default:         return "text-slate-500";
  }
}

function statusBg(status: string): string {
  switch (status) {
    case "critical": return "border-rose-900/30 hover:border-rose-800/50";
    case "at_risk":  return "border-amber-900/30 hover:border-amber-800/50";
    case "scaling":  return "border-emerald-900/30 hover:border-emerald-800/50";
    default:         return "border-slate-800 hover:border-slate-700";
  }
}

export function AccountsSection({ accounts }: { accounts: DailyBriefAccountSummary[] }) {
  // Only show accounts that need attention (not stable/insufficient)
  const actionable = accounts.filter(
    (a) => a.status === "critical" || a.status === "at_risk" || a.status === "scaling"
  );

  if (actionable.length === 0) return null;

  return (
    <Section title="Accounts" count={actionable.length} accent="bg-slate-700/50 text-slate-400">
      <div className="space-y-2">
        {actionable.map((a) => (
          <Link
            key={a.clientId}
            href={a.href}
            className={`group flex items-center justify-between rounded-lg border
                        bg-slate-900/50 px-4 py-3 transition-colors hover:bg-slate-800/50 ${statusBg(a.status)}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${statusColor(a.status)}`}>{a.clientName}</p>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                  {a.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                <span>Spend: ${a.spend.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                <span>ROAS: {a.roas != null ? a.roas.toFixed(2) : "N/A"}</span>
                <span>Trend: {a.trend}</span>
                {a.alertCount > 0 && <span className="text-rose-400">{a.alertCount} alerts</span>}
                {a.hasStaleSync && <span className="text-amber-400">Stale sync</span>}
              </div>
            </div>
            {a.scaleReady && (
              <span className="ml-3 flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                Scale Ready
              </span>
            )}
          </Link>
        ))}
      </div>
    </Section>
  );
}
