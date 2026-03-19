"use client";

// app/creative-lab/refresh-queue/RefreshQueueItemDetail.tsx
// Detail panel for a selected Creative Refresh Queue item.
//
// Sections:
//   Header        — priority + action badges, headline, entity context, close
//   Rationale     — recommendation rationale + priority reason
//   Signals       — source signals table (what triggered this item)
//   Performance   — 14-day snapshot (CRM-verified ROAS/CPA)
//   Creative      — thumbnail + ad copy
//   Actions       — thumb-friendly action buttons

import Link                           from "next/link";
import type { CreativeRefreshQueueItem } from "../../../types/creativeRefreshQueue";
import { Badge }                      from "../../../components/ui";
import { formatCurrency }             from "../../../lib/metricUtils";
import {
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  ACTION_LABEL,
  ACTION_VARIANT,
  FATIGUE_LABEL,
  FATIGUE_VARIANT,
} from "./RefreshQueueItemCard";

// ---------------------------------------------------------------------------
// Button helpers
// ---------------------------------------------------------------------------

const BTN_BASE =
  "w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors active:scale-95 sm:py-2.5";

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`${BTN_BASE} bg-violet-600 text-white hover:bg-violet-500`}>
      {children}
    </button>
  );
}

function SecondaryBtn({
  onClick,
  children,
  className = "",
}: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`${BTN_BASE} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Signal row
// ---------------------------------------------------------------------------

function SignalRow({ label, value, severity }: { label: string; value: string; severity: "warning" | "critical" }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span
        className={`mt-0.5 shrink-0 text-sm leading-none ${
          severity === "critical" ? "text-rose-400" : "text-amber-400"
        }`}
      >
        {severity === "critical" ? "●" : "◐"}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      <span className="shrink-0 text-xs font-mono text-slate-400">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric row
// ---------------------------------------------------------------------------

function MetricRow({
  label, value, highlight, sub,
}: { label: string; value: string; highlight?: "good" | "warn" | "bad"; sub?: string }) {
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
  item:    CreativeRefreshQueueItem;
  onAction: (id: string, action: string) => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

export function RefreshQueueItemDetail({ item, onAction, onClose }: Props) {
  const hasThumbnail = !!(item.thumbnailUrl);
  const rec          = item.recommendation;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PRIORITY_VARIANT[item.priority]}>
              {PRIORITY_LABEL[item.priority]} Priority
            </Badge>
            <Badge variant={ACTION_VARIANT[rec.actionType]}>
              {ACTION_LABEL[rec.actionType]}
            </Badge>
            {item.fatigueStatus && (
              <Badge variant={FATIGUE_VARIANT[item.fatigueStatus] ?? "neutral"}>
                {FATIGUE_LABEL[item.fatigueStatus] ?? item.fatigueStatus}
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-snug text-white">
            {rec.headline}
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
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-0 divide-y divide-slate-800/60">

        {/* ── Recommendation rationale ── */}
        <div className="px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Recommendation
          </p>
          <p className="text-sm leading-relaxed text-slate-300">{rec.rationale}</p>

          <div className="mt-3 rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2">
            <p className="text-xs font-medium text-violet-300">Priority reason</p>
            <p className="mt-0.5 text-xs text-slate-300">{item.priorityReason}</p>
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Confidence:</span>
            <span
              className={
                rec.confidence === "high"   ? "font-medium text-emerald-400" :
                rec.confidence === "medium" ? "font-medium text-slate-300"   : "text-slate-500"
              }
            >
              {rec.confidence}
            </span>
          </div>
        </div>

        {/* ── Source signals ── */}
        {item.sourceSignals.length > 0 && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Signals
            </p>
            <div className="divide-y divide-slate-800/40">
              {item.sourceSignals.map((sig, i) => (
                <SignalRow
                  key={i}
                  label={sig.label}
                  value={sig.value}
                  severity={sig.severity}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── No signals ── */}
        {item.sourceSignals.length === 0 && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Signals</p>
            <p className="text-xs text-slate-600">
              No strong signals detected. Item is in monitor-only mode.
            </p>
          </div>
        )}

        {/* ── Performance snapshot ── */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Performance <span className="normal-case font-normal text-slate-600">(14 days)</span>
          </p>
          <div className="divide-y divide-slate-800/40">
            <MetricRow label="Ad Spend"    value={formatCurrency(item.spend)} />
            <MetricRow label="Impressions" value={item.impressions.toLocaleString()} />
            <MetricRow label="Clicks"      value={item.clicks.toLocaleString()} />
            <MetricRow
              label="CTR"
              value={`${item.avgCtr.toFixed(2)}%`}
              highlight={item.avgCtr >= 1.5 ? "good" : item.avgCtr < 0.8 ? "bad" : undefined}
            />
            {item.avgFrequency != null && (
              <MetricRow
                label="Avg. Frequency"
                value={`${item.avgFrequency.toFixed(1)}x`}
                highlight={item.avgFrequency > 5 ? "bad" : item.avgFrequency > 3.5 ? "warn" : undefined}
              />
            )}
            {item.campaignRoas != null && (
              <MetricRow
                label="Campaign ROAS"
                value={`${item.campaignRoas.toFixed(2)}x`}
                highlight={item.campaignRoas >= 2 ? "good" : item.campaignRoas < 1 ? "bad" : undefined}
                sub="CRM-verified"
              />
            )}
            {item.campaignCpa != null && (
              <MetricRow
                label="Campaign CPA"
                value={formatCurrency(item.campaignCpa)}
                sub="CRM-verified"
              />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            ROAS and CPA are Shopify/CRM data — not Meta self-reported.
          </p>
        </div>

        {/* ── Creative preview ── */}
        {(hasThumbnail || item.adCopy) && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Creative
            </p>
            {hasThumbnail && (
              <div className="mb-3 overflow-hidden rounded-xl border border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailUrl!}
                  alt={item.creativeName ?? "Creative preview"}
                  className="w-full max-h-48 object-cover"
                  loading="lazy"
                />
              </div>
            )}
            {!hasThumbnail && (
              <div className="mb-3 flex h-16 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40">
                <p className="text-xs text-slate-600">No image synced for this creative</p>
              </div>
            )}
            {item.adCopy && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                  {item.adCopy}
                </p>
                {item.callToAction && (
                  <p className="mt-2 text-xs text-slate-500">
                    CTA: <span className="text-slate-400">{item.callToAction}</span>
                  </p>
                )}
              </div>
            )}
            {item.creativeName && (
              <p className="mt-1.5 text-xs text-slate-600">Creative: {item.creativeName}</p>
            )}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Actions
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rec.actionType !== "monitor_only" && (
              <PrimaryBtn onClick={() => onAction(item.id, rec.actionType)}>
                {rec.actionType === "generate_new_copy_variations"  && "Generate 3 New Copy Variations"}
                {rec.actionType === "generate_new_image_variations" && "Generate 3 Image Variation Briefs"}
                {rec.actionType === "generate_full_refresh_brief"   && "Generate Full Refresh Brief"}
                {rec.actionType === "pause_creative_candidate"      && "Mark as Pause Candidate"}
                {rec.actionType === "review_creative"               && "Open in Creative Lab"}
              </PrimaryBtn>
            )}

            {/* Secondary actions always available */}
            <SecondaryBtn onClick={() => onAction(item.id, "generate_new_copy_variations")}>
              3 New Copy Variations
            </SecondaryBtn>
            <SecondaryBtn onClick={() => onAction(item.id, "generate_new_image_variations")}>
              3 Image Variation Briefs
            </SecondaryBtn>
            <SecondaryBtn onClick={() => onAction(item.id, "generate_full_refresh_brief")}>
              Full Refresh Brief
            </SecondaryBtn>
            <SecondaryBtn onClick={() => onAction(item.id, "monitor_only")} className="text-slate-500">
              Mark as Monitor Only
            </SecondaryBtn>
          </div>

          {/* Linked entity nav */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/creative-lab?clientId=${encodeURIComponent(item.clientAccountId)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700
                bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
            >
              ↗ Review in Creative Lab
            </Link>
            {item.campaignId && (
              <Link
                href={`/optimization?clientId=${encodeURIComponent(item.clientAccountId)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700
                  bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                ↗ Open Campaign
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

      </div>
    </div>
  );
}
