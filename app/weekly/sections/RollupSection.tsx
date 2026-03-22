"use client";

// RollupSection — Reusable section cards for weekly rollup.
// Renders winners, losers, experiments, patterns, scale opps, decline signals.

import Link from "next/link";
import type {
  WeeklyWinnerSummary,
  WeeklyLoserSummary,
  WeeklyExperimentSummary,
  WeeklyCreativePattern,
  WeeklyScaleOpportunity,
  WeeklyDeclineSignal,
  WeeklyRollupEvidenceLink,
} from "../../../types/weeklyRollup";
import { fmtLift, fmtCurrency, fmtRoas, confidenceColor, severityColor } from "../../../lib/weeklyRollup/utils";

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, count, accent, children }: {
  title: string; count: number; accent: string; children: React.ReactNode;
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

// ── Evidence badge ──────────────────────────────────────────────────────────

function EvidenceBadge({ link }: { link: WeeklyRollupEvidenceLink }) {
  return (
    <Link
      href={link.href}
      className="inline-flex items-center rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
      title={link.label}
    >
      {link.entityType} · {link.label.slice(0, 40)}{link.label.length > 40 ? "…" : ""}
    </Link>
  );
}

// ── Winners section ─────────────────────────────────────────────────────────

export function WinnersSection({ winners }: { winners: WeeklyWinnerSummary[] }) {
  return (
    <Section title="What Won This Week" count={winners.length} accent="bg-emerald-500/10 text-emerald-400">
      <div className="space-y-2">
        {winners.map((w) => (
          <Link key={w.id} href={w.href}
            className="group flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50
                       px-4 py-3 transition-colors hover:border-emerald-800/50 hover:bg-slate-800/50">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-400 group-hover:text-emerald-300">{w.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{w.subtitle}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {w.evidence.map((e, i) => <EvidenceBadge key={i} link={e} />)}
              </div>
            </div>
            <div className="ml-3 shrink-0 text-right">
              {w.scaleReady && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">Scale Ready</span>
              )}
              {w.lift != null && <p className="mt-1 text-xs text-slate-400">{fmtLift(w.lift)} lift</p>}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Losers section ──────────────────────────────────────────────────────────

export function LosersSection({ losers }: { losers: WeeklyLoserSummary[] }) {
  return (
    <Section title="What Lost This Week" count={losers.length} accent="bg-amber-500/10 text-amber-400">
      <div className="space-y-2">
        {losers.map((l) => (
          <Link key={l.id} href={l.href}
            className="group flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50
                       px-4 py-3 transition-colors hover:border-amber-800/50 hover:bg-slate-800/50">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-400 group-hover:text-amber-300">{l.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{l.subtitle}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {l.evidence.map((e, i) => <EvidenceBadge key={i} link={e} />)}
              </div>
            </div>
            {l.refreshQueued && (
              <span className="ml-3 shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
                Refresh Queued
              </span>
            )}
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Experiments section ─────────────────────────────────────────────────────

export function ExperimentsSection({ experiments }: { experiments: WeeklyExperimentSummary[] }) {
  return (
    <Section title="Experiments This Week" count={experiments.length} accent="bg-violet-500/10 text-violet-400">
      <div className="space-y-2">
        {experiments.map((e) => (
          <Link key={e.id} href={e.href}
            className="group flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50
                       px-4 py-3 transition-colors hover:border-violet-800/50 hover:bg-slate-800/50">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-200 group-hover:text-white">{e.name}</p>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">{e.status}</span>
              </div>
              {e.insightText && <p className="mt-0.5 text-xs text-slate-500">{e.insightText}</p>}
              {e.outcome && <p className="mt-0.5 text-xs text-slate-400">Outcome: {e.outcome.replace(/_/g, " ")}</p>}
            </div>
            <div className="ml-3 shrink-0 text-right">
              <span className="text-xs text-slate-600">{e.daysRunning}d</span>
              {e.winningVariant && (
                <p className="mt-0.5 text-xs text-emerald-400">{e.winningVariant}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Creative patterns section ───────────────────────────────────────────────

export function PatternsSection({ patterns }: { patterns: WeeklyCreativePattern[] }) {
  return (
    <Section title="Creative Patterns That Worked" count={patterns.length} accent="bg-sky-500/10 text-sky-400">
      <div className="space-y-2">
        {patterns.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${confidenceColor(p.confidence)}`}>
                {p.confidence}
              </span>
              <span className="text-[10px] text-slate-600">{p.category.replace(/_/g, " ")}</span>
              <span className="text-[10px] text-slate-600">×{p.occurrences}</span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{p.exampleInsight}</p>
            {p.clientNames.length > 0 && (
              <p className="mt-1 text-[10px] text-slate-600">Clients: {p.clientNames.join(", ")}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {p.evidence.map((e, i) => <EvidenceBadge key={i} link={e} />)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Scale opportunities section ─────────────────────────────────────────────

export function ScaleSection({ opportunities }: { opportunities: WeeklyScaleOpportunity[] }) {
  return (
    <Section title="Scale Opportunities" count={opportunities.length} accent="bg-emerald-500/10 text-emerald-400">
      <div className="space-y-2">
        {opportunities.map((o) => (
          <Link key={o.id} href={o.href}
            className="group flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50
                       px-4 py-3 transition-colors hover:border-emerald-800/50 hover:bg-slate-800/50">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-400 group-hover:text-emerald-300">{o.clientName}</p>
              <p className="mt-0.5 text-xs text-slate-500">{o.reason}</p>
            </div>
            <div className="ml-3 shrink-0 text-right text-xs">
              <p className="text-slate-400">ROAS {fmtRoas(o.currentRoas)}</p>
              <p className="text-slate-600">Spend {fmtCurrency(o.spend)}</p>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Decline signals section ─────────────────────────────────────────────────

export function DeclineSection({ signals }: { signals: WeeklyDeclineSignal[] }) {
  return (
    <Section title="Areas Needing Attention" count={signals.length} accent="bg-rose-500/10 text-rose-400">
      <div className="space-y-2">
        {signals.map((s) => (
          <Link key={s.id} href={s.href}
            className={`group flex items-center justify-between rounded-lg border bg-slate-900/50
                       px-4 py-3 transition-colors hover:bg-slate-800/50
                       ${s.severity === "high" ? "border-rose-900/30 hover:border-rose-800/50" : "border-slate-800 hover:border-amber-800/50"}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${severityColor(s.severity)}`}>{s.clientName}</p>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">{s.severity}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{s.signal}</p>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
