"use client";

// BriefView — In-app daily morning brief viewer.
// Shows the most recent brief with all sections.
// Supports archive navigation and manual regeneration.

import { useState }          from "react";
import Link                  from "next/link";
import type { DailyMorningBrief } from "../../types/dailyBrief";
import { BriefSummaryBar }   from "./sections/BriefSummaryBar";
import { BriefActionList }   from "./sections/BriefActionList";
import {
  WinnersSection,
  LosersSection,
  BlockedSection,
  AccountsSection,
} from "./sections/BriefHighlights";

// ── Types ───────────────────────────────────────────────────────────────────

type BriefArchiveEntry = {
  id:            string;
  briefDate:     string;
  deliveryState: string;
  briefJson:     string;
  timezone:      string;
  createdAt:     string;
};

type Props = {
  latestBrief:  DailyMorningBrief | null;
  archive:      BriefArchiveEntry[];
};

// ── Trust banner ────────────────────────────────────────────────────────────

function TrustBanner({ trustState, trustMessage }: { trustState: string; trustMessage: string }) {
  if (trustState === "healthy") return null;

  const style = trustState === "suspect" || trustState === "blocked"
    ? "border-rose-800/40 bg-rose-950/30 text-rose-400"
    : trustState === "warning"
      ? "border-amber-800/40 bg-amber-950/30 text-amber-400"
      : "border-slate-700 bg-slate-800/50 text-slate-400";

  return (
    <div className={`rounded-lg border px-4 py-3 ${style}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">
        {trustState === "suspect" ? "Data Quality Warning" : trustState === "warning" ? "Data Note" : "Unverified"}
      </p>
      <p className="mt-1 text-sm">{trustMessage}</p>
    </div>
  );
}

// ── No data state ───────────────────────────────────────────────────────────

function NoDataState() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-6 py-12 text-center">
      <p className="text-lg font-medium text-slate-300">No morning brief yet</p>
      <p className="mt-2 text-sm text-slate-500">
        Briefs are generated based on your account timezone.
        You can also generate one manually.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/command-center"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300
                     transition-colors hover:bg-slate-700 hover:text-white"
        >
          Command Center
        </Link>
      </div>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export function BriefView({ latestBrief, archive }: Props) {
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  // Determine which brief to display
  let brief: DailyMorningBrief | null = latestBrief;
  if (selectedBriefId) {
    const entry = archive.find((a) => a.id === selectedBriefId);
    if (entry) {
      try {
        brief = JSON.parse(entry.briefJson) as DailyMorningBrief;
      } catch {
        brief = latestBrief;
      }
    }
  }

  // Manual generation
  async function handleGenerate() {
    setGenerating(true);
    setGenMessage(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/daily-brief?timezone=${encodeURIComponent(tz)}&force=true`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.status === "generated") {
        setGenMessage("Brief generated. Reload to see it.");
      } else if (data.status === "skipped") {
        setGenMessage("Brief already exists for today.");
      } else {
        setGenMessage(data.error ?? "Failed to generate brief.");
      }
    } catch (err) {
      setGenMessage("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Morning Brief</h1>
          {brief && (
            <p className="mt-1 text-sm text-slate-500">
              {new Date(brief.generatedAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {" · "}
              {brief.timezone}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white
                       transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Brief"}
          </button>
          <Link
            href="/command-center"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300
                       transition-colors hover:bg-slate-700 hover:text-white"
          >
            Command Center
          </Link>
        </div>
      </div>

      {genMessage && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <p className="text-sm text-slate-300">{genMessage}</p>
        </div>
      )}

      {/* Brief content */}
      {!brief ? (
        <NoDataState />
      ) : (
        <>
          {/* Trust banner */}
          <TrustBanner trustState={brief.trustState} trustMessage={brief.trustMessage} />

          {/* No data yesterday */}
          {brief.noDataYesterday ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-6 py-8 text-center">
              <p className="text-sm text-slate-400">No data from yesterday. Check sync status.</p>
              <Link
                href="/health"
                className="mt-3 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                Data Health
              </Link>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <BriefSummaryBar summary={brief.summary} />

              {/* Actions */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-slate-300">
                  Top Actions
                  {brief.actions.length > 0 && (
                    <span className="ml-2 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">
                      {brief.actions.length}
                    </span>
                  )}
                </h2>
                <BriefActionList actions={brief.actions} />
              </div>

              {/* Highlights grid */}
              <div className="grid gap-6 md:grid-cols-2">
                <WinnersSection winners={brief.winners} />
                <LosersSection losers={brief.losers} />
              </div>

              {/* Accounts */}
              <AccountsSection accounts={brief.accounts} />

              {/* Blocked */}
              <BlockedSection items={brief.blockedItems} />
            </>
          )}

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
            <Link href="/command-center" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
              Command Center
            </Link>
            <Link href="/creative-lab" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
              Creative Lab
            </Link>
            <Link href="/creative-lab/results" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
              Experiment Results
            </Link>
            <Link href="/pacing" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
              Pacing
            </Link>
            <Link href="/alerts" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
              Alerts
            </Link>
            <Link href="/health" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
              Data Health
            </Link>
          </div>
        </>
      )}

      {/* Brief archive */}
      {archive.length > 1 && (
        <div className="border-t border-slate-800 pt-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Brief Archive</h2>
          <div className="flex flex-wrap gap-2">
            {archive.map((entry) => {
              const isActive = selectedBriefId === entry.id || (!selectedBriefId && entry.id === archive[0]?.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedBriefId(entry.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "border-emerald-700 bg-emerald-900/20 text-emerald-400"
                      : "border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  }`}
                >
                  {entry.briefDate}
                  {entry.deliveryState === "failed" && (
                    <span className="ml-1 text-rose-400">(failed)</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
