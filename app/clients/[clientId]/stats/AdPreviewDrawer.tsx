// Ad creative preview drawer — opens from the Stats table when clicking an ad row.
// Shows the ad image, copy, headline, CTA, and context (campaign/ad set names).
// Follows the TraceDrawer pattern: right panel on desktop, bottom sheet on mobile.

"use client";

import { useEffect } from "react";
import type { StatsRow } from "../../../../lib/stats/statsTypes";

interface Props {
  ad: StatsRow;
  campaignName?: string;
  adSetName?: string;
  open: boolean;
  onClose: () => void;
}

export function AdPreviewDrawer({ ad, campaignName, adSetName, open, onClose }: Props) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const cr = ad.creative;
  const hasImage = !!(cr?.imageUrl || cr?.thumbnailUrl);
  const imgSrc = cr?.imageUrl || cr?.thumbnailUrl || null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed z-50 bg-slate-950 border-slate-800 flex flex-col overflow-hidden
          bottom-0 left-0 right-0 rounded-t-2xl border-t max-h-[92vh]
          sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:w-[420px]
          sm:rounded-none sm:border-t-0 sm:border-l sm:max-h-full"
        role="dialog"
        aria-modal="true"
        aria-label={`Ad preview: ${ad.name}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3.5 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ad Preview</div>
            <h2 className="mt-0.5 text-sm font-semibold text-slate-100 leading-tight truncate">{ad.name}</h2>
            {(campaignName || adSetName) && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 truncate">
                {campaignName && <span>{campaignName}</span>}
                {campaignName && adSetName && <span className="text-slate-700">/</span>}
                {adSetName && <span>{adSetName}</span>}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close preview"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Image */}
          <div className="border-b border-slate-800">
            {hasImage ? (
              <div className="relative bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc!}
                  alt={ad.name}
                  className="w-full max-h-[300px] object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center bg-slate-900/50 py-12">
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                  <p className="mt-2 text-xs text-slate-600">No creative preview available</p>
                </div>
              </div>
            )}
          </div>

          {/* Ad copy sections */}
          <div className="px-4 py-3 space-y-3">
            {/* Primary text / body */}
            {cr?.body && (
              <Field label="Primary Text" value={cr.body} />
            )}

            {/* Headline */}
            {cr?.title && (
              <Field label="Headline" value={cr.title} />
            )}

            {/* CTA */}
            {cr?.callToAction && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Call to Action</div>
                <span className="inline-block rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {cr.callToAction.replace(/_/g, " ")}
                </span>
              </div>
            )}

            {/* Creative name (if different from ad name) */}
            {cr?.creativeName && cr.creativeName !== ad.name && (
              <Field label="Creative Name" value={cr.creativeName} />
            )}

            {/* No creative data at all */}
            {!cr && (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-500">No creative data synced for this ad.</p>
                <p className="mt-1 text-[11px] text-slate-600">Re-sync the Meta ad account to pull creative metadata.</p>
              </div>
            )}

            {/* Quick metrics */}
            <div className="border-t border-slate-800 pt-3 mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Performance</div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Spend" value={fmtC(ad.spend)} />
                <Metric label="ROAS" value={`${ad.roas.toFixed(2)}x`}
                  color={ad.roas >= 3 ? "text-emerald-400" : ad.roas >= 1 ? "text-amber-400" : undefined} />
                <Metric label="CTR" value={`${ad.ctr.toFixed(2)}%`} />
                <Metric label="Revenue" value={fmtC(ad.revenue)} />
                <Metric label="CPC" value={ad.cpc !== null ? fmtC(ad.cpc) : "-"} />
                <Metric label="Conv." value={ad.orders === 0 ? "-" : fmtN(ad.orders)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">{label}</div>
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded bg-slate-900/60 px-2 py-1.5">
      <div className="text-[9px] font-medium uppercase text-slate-600">{label}</div>
      <div className={`text-xs font-semibold tabular-nums ${color ?? "text-slate-200"}`}>{value}</div>
    </div>
  );
}

function fmtC(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtN(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toFixed(1);
}
