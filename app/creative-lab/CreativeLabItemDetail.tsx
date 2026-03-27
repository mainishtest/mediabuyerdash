"use client";

// app/creative-lab/CreativeLabItemDetail.tsx
// Detail panel for a selected Creative Lab item.
// Shown as a sticky right panel on desktop, inline section on mobile.
//
// Sections:
//   Header         — status + source badges, headline, campaign, client, close
//   Rationale      — recommendation text + suggested action
//   Creative       — thumbnail preview (if available) + ad copy + CTA
//   Performance    — 14-day metrics snapshot (CRM source of truth for ROAS/CPA)
//   Fatigue        — signals and recommended action (if fatigue context exists)
//   Notes          — buyer textarea, saved on blur (persisted to DB)
//   Activity       — append-only log of state transitions
//   Linked Entities — quick links to campaign, creative generator, fatigue page
//   Actions        — status transition buttons

import { useState, useCallback }                      from "react";
import Link                                           from "next/link";
import type { CreativeLabItem, CreativeLabStatus }    from "../../types/creativeLab";
import { Badge, SectionCard }                         from "../../components/ui";
import { formatCurrency }                             from "../../lib/metricUtils";
import { STATUS_LABEL, STATUS_VARIANT, SOURCE_LABEL, SOURCE_VARIANT } from "./CreativeLabItemCard";

// ---------------------------------------------------------------------------
// Button helpers
// ---------------------------------------------------------------------------

const BTN_BASE =
  "w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors sm:py-2.5 active:scale-95";

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`${BTN_BASE} bg-indigo-600 text-white hover:bg-indigo-500`}>
      {children}
    </button>
  );
}

function SecondaryBtn({
  onClick,
  children,
  className = "",
}: {
  onClick:    () => void;
  children:   React.ReactNode;
  className?: string;
}) {
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
    <button
      onClick={onClick}
      className={`${BTN_BASE} border border-rose-800/50 bg-rose-950/30 text-rose-300 hover:bg-rose-950/50`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Metric row
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  highlight,
  sub,
}: {
  label:      string;
  value:      string;
  highlight?: "good" | "warn" | "bad";
  sub?:       string;
}) {
  const color =
    highlight === "good" ? "text-emerald-400" :
    highlight === "warn" ? "text-amber-300"   :
    highlight === "bad"  ? "text-rose-400"    : "text-slate-200";

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div>
        <span className="text-slate-500">{label}</span>
        {sub && <span className="ml-1 text-xs text-slate-600">({sub})</span>}
      </div>
      <span className={`font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  item:           CreativeLabItem;
  onStatusChange: (id: string, status: CreativeLabStatus, note?: string) => void;
  onNotesSave:    (id: string, notes: string) => void;
  onClose:        () => void;
};

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

export function CreativeLabItemDetail({ item, onStatusChange, onNotesSave, onClose }: Props) {
  const pc = item.performanceContext;
  const fc = item.fatigueContext;

  const [localNotes, setLocalNotes] = useState(item.notes ?? "");

  // Save notes on blur (debounced at the point of usage)
  const handleNotesBlur = useCallback(() => {
    onNotesSave(item.id, localNotes);
  }, [item.id, localNotes, onNotesSave]);

  const canReview  = item.status === "queued"     || item.status === "draft";
  const canApprove = item.status === "in_review"  || item.status === "needs_revision";
  const canRevise  = item.status === "in_review"  || item.status === "queued";
  const canReject  = item.status !== "rejected"   && item.status !== "archived";
  const canRequeue = item.status === "rejected"   || item.status === "blocked" || item.status === "needs_revision";

  const hasThumbnail = !!(pc?.thumbnailUrl);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80">

      {/* ── Header ── */}
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
            <p className="mt-0.5 text-xs text-slate-500">Campaign: {item.campaignName}</p>
          )}
          {item.clientName && (
            <p className="text-xs text-slate-600">{item.clientName}</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          aria-label="Close detail"
        >
          ✕
        </button>
      </div>

      <div className="space-y-0 divide-y divide-slate-800/60">

        {/* ── Rationale ── */}
        <div className="px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Why This Item
          </p>
          <p className="text-sm leading-relaxed text-slate-300">
            {item.recommendationRationale}
          </p>
          {item.suggestedNextAction && (
            <div className="mt-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2">
              <p className="text-xs font-medium text-indigo-300">Suggested action</p>
              <p className="mt-0.5 text-xs text-slate-300">{item.suggestedNextAction}</p>
            </div>
          )}
        </div>

        {/* ── Creative preview ── */}
        {(hasThumbnail || pc?.adCopy) && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Creative
            </p>

            {/* Thumbnail */}
            {hasThumbnail ? (
              <div className="mb-3 overflow-hidden rounded-xl border border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pc!.thumbnailUrl!}
                  alt={item.creativeName ?? "Creative preview"}
                  className="w-full max-h-52 object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="mb-3 flex h-20 items-center justify-center rounded-xl
                              border border-slate-800 bg-slate-900/40">
                <p className="text-xs text-slate-600">No image synced for this creative</p>
              </div>
            )}

            {/* Ad copy */}
            {pc?.adCopy && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
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
            {item.creativeName && (
              <p className="mt-1.5 text-xs text-slate-600">Creative: {item.creativeName}</p>
            )}
          </div>
        )}

        {/* ── Performance snapshot ── */}
        {pc && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Performance Snapshot <span className="normal-case font-normal text-slate-600">(14 days)</span>
            </p>
            <div className="divide-y divide-slate-800/40">
              <MetricRow label="Ad Spend"       value={formatCurrency(pc.spend)} />
              <MetricRow label="Impressions"    value={pc.impressions.toLocaleString()} />
              <MetricRow label="Clicks"         value={pc.clicks.toLocaleString()} />
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
                  label="Campaign ROAS"
                  value={`${pc.campaignRoas.toFixed(2)}x`}
                  highlight={pc.campaignRoas >= 2 ? "good" : pc.campaignRoas < 1 ? "bad" : undefined}
                  sub="CRM-verified"
                />
              )}
              {pc.campaignCpa != null && (
                <MetricRow
                  label="Campaign CPA"
                  value={formatCurrency(pc.campaignCpa)}
                  sub="CRM-verified"
                />
              )}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              ROAS and CPA are Shopify/CRM data — not Meta self-reported.
            </p>
          </div>
        )}

        {/* ── Missing performance context ── */}
        {!pc && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Performance
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center">
              <p className="text-xs text-slate-600">
                No performance data available. Run a Meta sync and reconciliation to populate metrics.
              </p>
            </div>
          </div>
        )}

        {/* ── Fatigue signals ── */}
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
                <span className="text-slate-300">{fc.recommendedAction.replaceAll("_", " ")}</span>
              </p>
            )}
          </div>
        )}

        {/* ── Buyer notes ── */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Notes
          </p>
          <textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add notes for this creative item…"
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800/60
                       px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600
                       focus:border-slate-600 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-600">Saved automatically when you click away.</p>
        </div>

        {/* ── Activity log ── */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Activity
          </p>
          {item.activityLog.length === 0 ? (
            <p className="text-xs text-slate-600">No activity yet — take an action below.</p>
          ) : (
            <ul className="space-y-2">
              {[...item.activityLog].reverse().map((entry) => (
                <li key={entry.id} className="text-xs">
                  <span className="text-slate-300">{entry.action}</span>
                  {entry.note && (
                    <span className="ml-1 text-slate-500">— {entry.note}</span>
                  )}
                  <span className="ml-2 text-slate-600">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Post-approval: Next Step workflow ── */}
        {item.status === "approved" && (
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Next Steps
            </p>

            {/* Workflow stepper */}
            <div className="mb-4 flex items-center gap-1 text-xs">
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-white">Approved</span>
              <span className="text-slate-600">→</span>
              <span className="rounded-full border border-indigo-500 bg-indigo-950/40 px-2 py-0.5 text-indigo-300">Generate</span>
              <span className="text-slate-600">→</span>
              <span className="text-slate-600">Review</span>
              <span className="text-slate-600">→</span>
              <span className="text-slate-600">Launch</span>
            </div>

            <Link
              href={`/creative-lab/creative-engine?clientId=${encodeURIComponent(item.clientAccountId)}${item.creativeId ? `&creativeId=${encodeURIComponent(item.creativeId)}` : ""}${item.campaignId ? `&campaignId=${encodeURIComponent(item.campaignId)}` : ""}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600
                         px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500
                         active:scale-95"
            >
              Generate Creative Concepts →
            </Link>

            <p className="mt-2 text-xs text-slate-500">
              AI will generate copy variations and image concept briefs based on this creative&apos;s performance data.
            </p>
          </div>
        )}

        {/* ── Linked entities ── */}
        {(item.campaignId || item.creativeId || item.clientAccountId) && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Linked Entities
            </p>
            <div className="flex flex-wrap gap-2">
              {item.campaignId && (
                <Link
                  href={`/optimization?clientId=${encodeURIComponent(item.clientAccountId)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700
                    bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  ↗ Open Campaign
                </Link>
              )}
              {item.creativeId && (
                <Link
                  href={`/creative-lab/generate?clientId=${encodeURIComponent(item.clientAccountId)}`}
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
                  ↗ Fatigue Analysis
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
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
