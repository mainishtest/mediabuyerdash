"use client";

// app/creative-lab/CreativeLabItemDetail.tsx
// Detail panel for a selected Creative Lab item.
// Shown as a right-side panel on desktop, inline section on mobile.

import Link from "next/link";
import type { CreativeLabItem, CreativeLabStatus } from "../../types/creativeLab";
import { Badge } from "../../components/ui";
import { SectionCard } from "../../components/ui";
import { formatCurrency } from "../../lib/metricUtils";
import { STATUS_LABEL, STATUS_VARIANT, SOURCE_LABEL, SOURCE_VARIANT } from "./CreativeLabItemCard";

// ---------------------------------------------------------------------------
// Action button helpers
// ---------------------------------------------------------------------------

const BTN_BASE =
  "w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors sm:py-2.5";

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`${BTN_BASE} bg-indigo-600 text-white hover:bg-indigo-500`}>
      {children}
    </button>
  );
}

function SecondaryBtn({ onClick, children, className = "" }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`${BTN_BASE} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 ${className}`}
    >
      {children}
    </button>
  );
}

function DangerBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`${BTN_BASE} border border-rose-800/50 bg-rose-950/30 text-rose-300 hover:bg-rose-950/50`}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Metric row — used in performance snapshot table
// ---------------------------------------------------------------------------

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "warn" | "bad" }) {
  const color =
    highlight === "good" ? "text-emerald-400" :
    highlight === "warn" ? "text-amber-300"   :
    highlight === "bad"  ? "text-rose-400"    : "text-slate-200";

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

type Props = {
  item:               CreativeLabItem;
  onStatusChange:     (id: string, status: CreativeLabStatus, note?: string) => void;
  onClose:            () => void;
};

export function CreativeLabItemDetail({ item, onStatusChange, onClose }: Props) {
  const pc = item.performanceContext;
  const fc = item.fatigueContext;

  const canReview       = item.status === "queued"     || item.status === "draft";
  const canApprove      = item.status === "in_review"  || item.status === "needs_revision";
  const canRevise       = item.status === "in_review"  || item.status === "queued";
  const canReject       = item.status !== "rejected"   && item.status !== "archived";
  const canRequeue      = item.status === "rejected"   || item.status === "blocked" || item.status === "needs_revision";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[item.status]}>
              {STATUS_LABEL[item.status]}
            </Badge>
            <Badge variant={SOURCE_VARIANT[item.sourceType]}>
              {SOURCE_LABEL[item.sourceType]}
            </Badge>
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-snug text-white">
            {item.recommendationHeadline}
          </h3>
          {item.campaignName && (
            <p className="mt-0.5 text-xs text-slate-500">
              Campaign: {item.campaignName}
            </p>
          )}
          {item.clientName && (
            <p className="text-xs text-slate-600">{item.clientName}</p>
          )}
        </div>

        {/* Close — useful on mobile */}
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          aria-label="Close detail"
        >
          ✕
        </button>
      </div>

      <div className="space-y-0 divide-y divide-slate-800/60">

        {/* Rationale */}
        <div className="px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Why This Item
          </p>
          <p className="text-sm leading-relaxed text-slate-300">
            {item.recommendationRationale}
          </p>
          {item.suggestedNextAction && (
            <div className="mt-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2">
              <p className="text-xs font-medium text-indigo-300">
                Suggested action
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {item.suggestedNextAction}
              </p>
            </div>
          )}
        </div>

        {/* Performance snapshot */}
        {pc && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Performance Snapshot
            </p>
            <div className="divide-y divide-slate-800/40">
              <MetricRow
                label="Ad Spend (14d)"
                value={formatCurrency(pc.spend)}
              />
              <MetricRow
                label="Impressions"
                value={pc.impressions.toLocaleString()}
              />
              <MetricRow
                label="Clicks"
                value={pc.clicks.toLocaleString()}
              />
              <MetricRow
                label="CTR"
                value={`${pc.avgCtr.toFixed(2)}%`}
                highlight={pc.avgCtr >= 1.5 ? "good" : pc.avgCtr < 0.8 ? "bad" : undefined}
              />
              {pc.avgFrequency != null && (
                <MetricRow
                  label="Avg. Frequency"
                  value={`${pc.avgFrequency.toFixed(1)}x`}
                  highlight={pc.avgFrequency > 5 ? "bad" : pc.avgFrequency > 3.5 ? "warn" : undefined}
                />
              )}
              {pc.campaignRoas != null && (
                <MetricRow
                  label="Campaign ROAS (CRM)"
                  value={`${pc.campaignRoas.toFixed(2)}x`}
                  highlight={pc.campaignRoas >= 2 ? "good" : pc.campaignRoas < 1 ? "bad" : undefined}
                />
              )}
              {pc.campaignCpa != null && (
                <MetricRow
                  label="Campaign CPA (CRM)"
                  value={formatCurrency(pc.campaignCpa)}
                />
              )}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              ROAS and CPA sourced from Shopify/CRM — not Meta self-reported.
            </p>
          </div>
        )}

        {/* Ad copy preview */}
        {pc?.adCopy && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Ad Copy
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {pc.adCopy}
            </p>
            {pc.callToAction && (
              <p className="mt-2 text-xs text-slate-500">
                CTA: <span className="text-slate-400">{pc.callToAction}</span>
              </p>
            )}
          </div>
        )}

        {/* Fatigue signals */}
        {fc && fc.fatigueSignals.length > 0 && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Fatigue Signals
            </p>
            <ul className="space-y-1.5">
              {fc.fatigueSignals.map((sig, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span
                    className={`mt-0.5 shrink-0 text-base leading-none ${
                      sig.severity === "critical" ? "text-rose-400" : "text-amber-400"
                    }`}
                  >
                    {sig.severity === "critical" ? "●" : "◐"}
                  </span>
                  <span className="text-slate-300">{sig.label}</span>
                </li>
              ))}
            </ul>
            {fc.recommendedAction && (
              <p className="mt-3 text-xs text-slate-500">
                Recommended:{" "}
                <span className="text-slate-300">
                  {fc.recommendedAction.replaceAll("_", " ")}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Activity log */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Activity
          </p>
          {item.activityLog.length === 0 ? (
            <p className="text-xs text-slate-600">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {item.activityLog.map((entry) => (
                <li key={entry.id} className="text-xs text-slate-400">
                  <span className="text-slate-300">{entry.action}</span>
                  {entry.note && <span className="ml-1 text-slate-500">— {entry.note}</span>}
                  <span className="ml-2 text-slate-600">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Links to linked entities */}
        {(item.campaignId || item.creativeId) && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Linked Entities
            </p>
            <div className="flex flex-wrap gap-2">
              {item.campaignId && (
                <Link
                  href={`/operations?campaignId=${encodeURIComponent(item.campaignId)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700
                    bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  ↗ Open Campaign
                </Link>
              )}
              {item.creativeId && (
                <Link
                  href={`/creative-lab/generate`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700
                    bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  ↗ Open in Generator
                </Link>
              )}
              {item.clientAccountId && (
                <Link
                  href={`/creative-fatigue?clientId=${encodeURIComponent(item.clientAccountId)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700
                    bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  ↗ Creative Fatigue
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Actions
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {canReview && (
              <PrimaryBtn onClick={() => onStatusChange(item.id, "in_review")}>
                Start Review
              </PrimaryBtn>
            )}
            {canApprove && (
              <PrimaryBtn onClick={() => onStatusChange(item.id, "approved")}>
                Approve for Next Step
              </PrimaryBtn>
            )}
            {canRevise && (
              <SecondaryBtn onClick={() => onStatusChange(item.id, "needs_revision")}>
                Mark Needs Revision
              </SecondaryBtn>
            )}
            {canRequeue && (
              <SecondaryBtn onClick={() => onStatusChange(item.id, "queued")}>
                Re-queue
              </SecondaryBtn>
            )}
            {item.status !== "blocked" && item.status !== "archived" && (
              <SecondaryBtn onClick={() => onStatusChange(item.id, "blocked")}>
                Mark Blocked
              </SecondaryBtn>
            )}
            {canReject && (
              <DangerBtn onClick={() => onStatusChange(item.id, "rejected")}>
                Reject Item
              </DangerBtn>
            )}
            {item.status !== "archived" && (
              <SecondaryBtn
                onClick={() => onStatusChange(item.id, "archived")}
                className="sm:col-span-2 text-slate-500"
              >
                Archive
              </SecondaryBtn>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
