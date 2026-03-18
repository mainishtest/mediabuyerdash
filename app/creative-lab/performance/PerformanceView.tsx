"use client";

import { useState } from "react";
import Link          from "next/link";
import Image         from "next/image";
import type {
  CreativePerformanceSnapshot,
  CreativeDiagnostic,
  CreativeOpportunity,
  CreativeEvaluationStatus,
  CreativeOpportunityType,
} from "../../../lib/creativelab/types";

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const STATUS_BORDER: Record<CreativeEvaluationStatus, string> = {
  strong:            "border-l-emerald-500",
  average:           "border-l-slate-600",
  weak:              "border-l-rose-500",
  fatigued:          "border-l-amber-500",
  insufficient_data: "border-l-slate-800",
};

const STATUS_BADGE_BG: Record<CreativeEvaluationStatus, string> = {
  strong:            "bg-emerald-500/20 text-emerald-400",
  average:           "bg-slate-700 text-slate-300",
  weak:              "bg-rose-500/20 text-rose-400",
  fatigued:          "bg-amber-500/20 text-amber-400",
  insufficient_data: "bg-slate-800 text-slate-500",
};

const STATUS_LABEL: Record<CreativeEvaluationStatus, string> = {
  strong:            "Strong",
  average:           "Average",
  weak:              "Weak",
  fatigued:          "Fatigued",
  insufficient_data: "Insufficient Data",
};

const OPP_TYPE_BADGE: Record<CreativeOpportunityType, string> = {
  scale:   "bg-emerald-500/20 text-emerald-400",
  refresh: "bg-blue-500/20 text-blue-400",
  iterate: "bg-amber-500/20 text-amber-400",
  retire:  "bg-rose-500/20 text-rose-400",
};

const OPP_URGENCY_BADGE: Record<string, string> = {
  high:   "bg-rose-500/20 text-rose-400",
  medium: "bg-amber-500/20 text-amber-400",
  low:    "bg-slate-700 text-slate-400",
};

type FilterStatus = CreativeEvaluationStatus | "all";

// ---------------------------------------------------------------------------
// CreativeThumbnail
// ---------------------------------------------------------------------------

function CreativeThumbnail({
  thumbnailUrl,
  imageUrl,
  name,
}: {
  thumbnailUrl: string | null;
  imageUrl:     string | null;
  name:         string | null;
}) {
  const [failed, setFailed] = useState(false);
  const src = thumbnailUrl ?? imageUrl ?? null;

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-800 rounded-lg">
        <span className="text-2xl text-slate-600">◻</span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name ?? "Creative"}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricPill
// ---------------------------------------------------------------------------

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreativeCard
// ---------------------------------------------------------------------------

function CreativeCard({
  snapshot,
  diagnostic,
}: {
  snapshot:   CreativePerformanceSnapshot;
  diagnostic: CreativeDiagnostic;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = snapshot;
  const borderColor = STATUS_BORDER[s.evaluationStatus];
  const badgeBg     = STATUS_BADGE_BG[s.evaluationStatus];

  return (
    <div
      className={`rounded-xl border border-slate-800 border-l-4 ${borderColor} bg-slate-900`}
    >
      {/* Top: thumbnail + headline */}
      <div className="flex gap-3 p-4">
        {/* Thumbnail */}
        <div className="h-20 w-20 shrink-0 sm:h-24 sm:w-24">
          <CreativeThumbnail
            thumbnailUrl={s.thumbnailUrl}
            imageUrl={s.imageUrl}
            name={s.creativeName}
          />
        </div>

        {/* Identity + status */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">
                {s.creativeName ?? s.externalCreativeId}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {s.campaignName}
              </p>
              <p className="truncate text-xs text-slate-600">{s.clientName}</p>
            </div>
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badgeBg}`}
            >
              {STATUS_LABEL[s.evaluationStatus]}
            </span>
          </div>

          {/* Copy snippet */}
          {s.adCopy && (
            <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 italic">
              &ldquo;{s.adCopy}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Metrics strip */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <MetricPill label="CTR"       value={`${s.avgCtr.toFixed(2)}%`} />
          <MetricPill label="Spend"     value={`$${Math.round(s.spend).toLocaleString()}`} />
          <MetricPill label="Impressions" value={s.impressions.toLocaleString()} />
          <MetricPill
            label="Frequency"
            value={s.avgFrequency != null ? `${s.avgFrequency.toFixed(1)}x` : "—"}
          />
          <MetricPill
            label="ROAS"
            value={s.campaignRoas != null ? `${s.campaignRoas.toFixed(2)}x` : "—"}
          />
        </div>
        {s.campaignCpa != null && (
          <p className="mt-1.5 text-xs text-slate-500">
            CPA: <span className="font-medium text-slate-300">${s.campaignCpa.toFixed(2)}</span>
            <span className="ml-1 text-slate-600">(campaign-level, CRM-verified)</span>
          </p>
        )}
      </div>

      {/* Diagnostic */}
      <div className="border-t border-slate-800 px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">
              {diagnostic.primaryIssue}
            </span>
          </div>
          <span className="text-xs text-slate-600">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            {/* Supporting signals */}
            <ul className="space-y-1">
              {diagnostic.supportingSignals.map((sig, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                  <span className="mt-0.5 shrink-0 text-slate-600">·</span>
                  {sig}
                </li>
              ))}
            </ul>
            {/* Recommended direction */}
            <div className="rounded-lg bg-slate-800/60 px-3 py-2">
              <p className="text-xs font-medium text-slate-400">Recommended</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                {diagnostic.recommendedDirection}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  accent,
  onClick,
  active,
}: {
  label:   string;
  value:   number;
  accent?: string;
  onClick: () => void;
  active:  boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active
          ? "border-slate-500 bg-slate-800"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>
        {value}
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// OpportunityCard
// ---------------------------------------------------------------------------

function OpportunityCard({ opp }: { opp: CreativeOpportunity }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{opp.headline}</p>
        <div className="flex gap-1.5">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${OPP_TYPE_BADGE[opp.opportunityType]}`}
          >
            {opp.opportunityType}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${OPP_URGENCY_BADGE[opp.urgency]}`}
          >
            {opp.urgency}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        {opp.description}
      </p>
      {opp.creativeName && (
        <p className="mt-2 text-xs text-slate-600 truncate">
          Creative: {opp.creativeName}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PerformanceView({
  snapshots,
  diagnostics,
  opportunities,
}: {
  snapshots:     CreativePerformanceSnapshot[];
  diagnostics:   CreativeDiagnostic[];
  opportunities: CreativeOpportunity[];
}) {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  // Build diagnostic map for quick lookup
  const diagMap = new Map(
    diagnostics.map((d) => [d.externalCreativeId, d])
  );

  // Count by status
  const counts: Record<CreativeEvaluationStatus, number> = {
    strong:            0,
    average:           0,
    weak:              0,
    fatigued:          0,
    insufficient_data: 0,
  };
  for (const s of snapshots) counts[s.evaluationStatus]++;

  // Apply filter
  const filtered =
    activeFilter === "all"
      ? snapshots
      : snapshots.filter((s) => s.evaluationStatus === activeFilter);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 lg:px-8">

      {/* Sub-nav */}
      <nav className="mb-6 flex gap-4 border-b border-slate-800 pb-3 text-sm">
        <Link
          href="/creative-lab"
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          Creative Lab
        </Link>
        <Link
          href="/creative-lab/images"
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          Images
        </Link>
        <span className="font-medium text-white">Performance</span>
      </nav>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Creative Performance</h1>
        <p className="mt-1 text-sm text-slate-400">
          Rule-based evaluation of ad creatives using real Meta sync data.
          CTR and frequency come from ad-level insights. ROAS/CPA are
          CRM-verified campaign-level metrics from reconciliation.
        </p>
      </div>

      {/* No data state */}
      {snapshots.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-sm font-medium text-slate-300">No creative performance data yet</p>
          <p className="mt-2 max-w-sm mx-auto text-xs leading-relaxed text-slate-500">
            Creative performance requires ad-level Meta sync data. Run a Meta sync
            for a client to start seeing creative diagnostics here.
          </p>
          <Link
            href="/integrations"
            className="mt-5 inline-block rounded-lg border border-slate-700 bg-slate-800
              px-5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            Go to Integrations
          </Link>
        </div>
      )}

      {snapshots.length > 0 && (
        <>
          {/* Summary cards — clickable filter shortcuts */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              label="Strong"
              value={counts.strong}
              accent="text-emerald-400"
              active={activeFilter === "strong"}
              onClick={() =>
                setActiveFilter((f) => (f === "strong" ? "all" : "strong"))
              }
            />
            <SummaryCard
              label="Weak"
              value={counts.weak}
              accent="text-rose-400"
              active={activeFilter === "weak"}
              onClick={() =>
                setActiveFilter((f) => (f === "weak" ? "all" : "weak"))
              }
            />
            <SummaryCard
              label="Fatigued"
              value={counts.fatigued}
              accent="text-amber-400"
              active={activeFilter === "fatigued"}
              onClick={() =>
                setActiveFilter((f) => (f === "fatigued" ? "all" : "fatigued"))
              }
            />
            <SummaryCard
              label="Total Creatives"
              value={snapshots.length}
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
          </div>

          {/* Filter bar */}
          <div className="mb-5 flex flex-wrap gap-2">
            {(
              [
                "all",
                "strong",
                "weak",
                "fatigued",
                "average",
                "insufficient_data",
              ] as const
            ).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  activeFilter === f
                    ? "bg-slate-200 text-slate-900"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {f === "all"
                  ? `All (${snapshots.length})`
                  : f === "insufficient_data"
                  ? `Insufficient Data (${counts.insufficient_data})`
                  : `${STATUS_LABEL[f as CreativeEvaluationStatus]} (${counts[f as CreativeEvaluationStatus]})`}
              </button>
            ))}
          </div>

          {/* Creative cards */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
              <p className="text-sm text-slate-500">
                No creatives match this filter.
              </p>
            </div>
          ) : (
            <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filtered.map((s) => {
                const d = diagMap.get(s.externalCreativeId);
                if (!d) return null;
                return (
                  <CreativeCard
                    key={`${s.externalCreativeId}::${s.externalCampaignId}`}
                    snapshot={s}
                    diagnostic={d}
                  />
                );
              })}
            </div>
          )}

          {/* Creative Opportunities */}
          {opportunities.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-50">
                  Creative Opportunities
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Prioritised actions — creatives to scale, refresh, iterate, or
                  retire.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {opportunities.map((opp, i) => (
                  <OpportunityCard key={i} opp={opp} />
                ))}
              </div>
            </section>
          )}

          {/* Data notes */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
            <p className="text-xs font-medium text-slate-400">Data notes</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              <li>· CTR and frequency are aggregated from ad-level Meta sync data (last 14 days).</li>
              <li>· ROAS and CPA are campaign-level, CRM-verified from reconciliation — not Meta&apos;s self-reported conversions.</li>
              <li>· &ldquo;Strong&rdquo; status requires both CTR ≥ 1.5% and campaign ROAS ≥ 2.0x. ROAS shows &mdash; if reconciliation has not been run.</li>
              <li>· One card per (creative, campaign) pair — a creative running in two campaigns appears twice.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
