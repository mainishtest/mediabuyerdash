"use client";

import { useState, useMemo } from "react";
import Link                  from "next/link";
import type {
  PortfolioIntelligenceSummary,
  PortfolioPriorityItem,
  PortfolioPriorityCategory,
} from "../../../types/portfolioIntelligence";
import { CATEGORY_LABELS, CATEGORY_VARIANTS } from "../../../lib/portfolioIntelligence/scoring";

// ── Category pill ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: PortfolioPriorityCategory }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_VARIANTS[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ── Score bar ───────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 60 ? "bg-rose-500" :
    score >= 35 ? "bg-amber-500" :
    score >= 15 ? "bg-sky-500" :
    "bg-slate-600";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{score}</span>
    </div>
  );
}

// ── Priority item row ───────────────────────────────────────────────────────

function PriorityRow({ item, expanded, onToggle }: {
  item:     PortfolioPriorityItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-slate-800/60 last:border-0">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={item.category} />
            {item.isBlocked && (
              <span className="rounded-full border border-orange-800/50 bg-orange-950/60 px-2 py-0.5 text-xs text-orange-300">
                Blocked
              </span>
            )}
            {item.isReady && (
              <span className="rounded-full border border-emerald-800/50 bg-emerald-950/60 px-2 py-0.5 text-xs text-emerald-300">
                Ready
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-slate-200">{item.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.reason}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ScoreBar score={item.score.total} />
          <span className="text-xs text-slate-600">{item.clientName}</span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-800/40 bg-slate-900/60 px-4 py-3">
          {/* Evidence */}
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Evidence</p>
            <div className="flex flex-wrap gap-2">
              {item.evidence.map((e, i) => (
                <span
                  key={i}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    e.direction === "positive" ? "border-emerald-800/40 bg-emerald-950/40 text-emerald-400" :
                    e.direction === "negative" ? "border-rose-800/40 bg-rose-950/40 text-rose-400" :
                    "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  {e.label}: {e.value}
                </span>
              ))}
            </div>
          </div>

          {/* Score factors */}
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Priority factors</p>
            <div className="flex flex-wrap gap-1.5">
              {item.score.factors.map((f, i) => (
                <span
                  key={i}
                  className={`rounded border px-1.5 py-0.5 text-xs ${
                    f.direction === "positive" ? "border-emerald-800/40 text-emerald-500" :
                    f.direction === "negative" ? "border-rose-800/40 text-rose-500" :
                    "border-slate-700 text-slate-500"
                  }`}
                >
                  {f.label} (+{f.weight})
                </span>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={item.action.href}
              className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-1.5
                         text-xs font-medium text-emerald-300 transition-colors
                         hover:bg-emerald-900/50 hover:text-emerald-200"
            >
              {item.action.label}
            </Link>
            <Link
              href={`/clients/${item.clientId}`}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
                         text-xs font-medium text-slate-300 transition-colors hover:border-slate-600"
            >
              Open account
            </Link>
            <Link
              href="/history"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
                         text-xs font-medium text-slate-300 transition-colors hover:border-slate-600"
            >
              Action history
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary stat cards ──────────────────────────────────────────────────────

function StatCard({ label, count, variant }: { label: string; count: number; variant: string }) {
  if (count === 0) return null;
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${variant}`}>
      <p className="text-lg font-bold tabular-nums">{count}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

// ── Filter bar ──────────────────────────────────────────────────────────────

const SEL =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 " +
  "outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 " +
  "hover:border-slate-600 transition-colors";

// ── Main panel ──────────────────────────────────────────────────────────────

export function IntelligencePanel({ data }: { data: PortfolioIntelligenceSummary }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<PortfolioPriorityCategory | "">("");
  const [clientFilter, setClientFilter]     = useState("");
  const [blockerFilter, setBlockerFilter]   = useState<"blocked" | "ready" | "">("");

  const filtered = useMemo(() => {
    let items = data.priorities;
    if (categoryFilter) items = items.filter((p) => p.category === categoryFilter);
    if (clientFilter)   items = items.filter((p) => p.clientId === clientFilter);
    if (blockerFilter === "blocked") items = items.filter((p) => p.isBlocked);
    if (blockerFilter === "ready")   items = items.filter((p) => p.isReady);
    return items;
  }, [data.priorities, categoryFilter, clientFilter, blockerFilter]);

  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data.priorities) map.set(p.clientId, p.clientName);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.priorities]);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex flex-wrap gap-2">
        <StatCard label="Scale Now" count={data.scaleNowCount} variant="border-emerald-800/50 bg-emerald-950/40 text-emerald-300" />
        <StatCard label="Investigate" count={data.investigateNowCount} variant="border-rose-800/50 bg-rose-950/40 text-rose-300" />
        <StatCard label="Refresh" count={data.refreshNeededCount} variant="border-amber-800/50 bg-amber-950/40 text-amber-300" />
        <StatCard label="Test" count={data.testNeededCount} variant="border-sky-800/50 bg-sky-950/40 text-sky-300" />
        <StatCard label="Blocked" count={data.blockedActionCount} variant="border-orange-800/50 bg-orange-950/40 text-orange-300" />
        <StatCard label="Monitor" count={data.monitorCount} variant="border-slate-700 bg-slate-800 text-slate-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Priority</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as PortfolioPriorityCategory | "")} className={SEL}>
            <option value="">All priorities</option>
            <option value="scale_now">Scale Now</option>
            <option value="investigate_now">Investigate Now</option>
            <option value="refresh_needed">Refresh Needed</option>
            <option value="test_needed">Test Needed</option>
            <option value="blocked_action">Blocked Action</option>
            <option value="monitor">Monitor</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Account</label>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={SEL}>
            <option value="">All accounts</option>
            {uniqueClients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">State</label>
          <select value={blockerFilter} onChange={(e) => setBlockerFilter(e.target.value as "blocked" | "ready" | "")} className={SEL}>
            <option value="">All states</option>
            <option value="blocked">Blocked</option>
            <option value="ready">Ready</option>
          </select>
        </div>
      </div>

      {/* Priority queue */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-3xl">✓</p>
          <p className="mt-2 text-sm font-medium text-slate-300">No priorities match filters</p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust filters or check back when new signals are detected.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40">
          {filtered.map((item) => (
            <PriorityRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2">
          {data.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">{w}</p>
          ))}
        </div>
      )}

      {/* Data sources */}
      <p className="text-xs text-slate-700">
        Sources: {data.inputSources.join(", ")} · {data.totalAccounts} accounts ·
        Generated {new Date(data.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
