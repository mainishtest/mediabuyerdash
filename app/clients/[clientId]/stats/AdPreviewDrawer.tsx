// Ad creative preview drawer — click an ad row's eye icon to open.
// Right panel on desktop, bottom sheet on mobile.
// Close: Escape key, backdrop click, or close button.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StatsRow } from "../../../../lib/stats/statsTypes";

interface Props {
  ad: StatsRow;
  campaignName?: string;
  adSetName?: string;
  open: boolean;
  onClose: () => void;
}

export function AdPreviewDrawer({ ad, campaignName, adSetName, open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Focus trap — move focus into panel on open
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const cr = ad.creative;
  const imgSrc = cr?.imageUrl || cr?.thumbnailUrl || null;
  const hasCopy = !!(cr?.body || cr?.title || cr?.callToAction);

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="fixed z-50 flex flex-col overflow-hidden bg-slate-950 border-slate-800 outline-none
          bottom-0 left-0 right-0 rounded-t-xl border-t max-h-[90vh]
          sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:w-[400px]
          sm:rounded-none sm:border-t-0 sm:border-l sm:max-h-full"
        role="dialog"
        aria-modal="true"
        aria-label={`Ad preview: ${ad.name}`}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">Ad Preview</span>
              <StatusDot status={ad.status} />
            </div>
            <h2 className="mt-0.5 text-[13px] font-semibold text-slate-100 leading-snug line-clamp-2">
              {ad.name}
            </h2>
            {(campaignName || adSetName) && (
              <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                {[campaignName, adSetName].filter(Boolean).join(" / ")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 p-1.5 text-slate-500 hover:text-slate-200 rounded-md
              hover:bg-slate-800 transition-colors"
            aria-label="Close (Esc)"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable content ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Image */}
          {imgSrc ? (
            <div className="bg-slate-900 border-b border-slate-800">
              <ImageWithFallback src={imgSrc} alt={ad.name} />
            </div>
          ) : (
            <div className="flex items-center justify-center border-b border-slate-800 bg-slate-900/40 py-10">
              <div className="text-center">
                <svg className="mx-auto h-7 w-7 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
                </svg>
                <p className="mt-1.5 text-[11px] text-slate-600">No creative image available</p>
              </div>
            </div>
          )}

          {/* Copy */}
          {hasCopy && (
            <div className="border-b border-slate-800 px-4 py-3 space-y-2.5">
              {cr?.body && (
                <CopyBlock label="Primary Text">
                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {cr.body}
                  </p>
                </CopyBlock>
              )}

              {cr?.title && (
                <CopyBlock label="Headline">
                  <p className="text-[13px] font-medium text-slate-200">{cr.title}</p>
                </CopyBlock>
              )}

              {cr?.callToAction && (
                <CopyBlock label="CTA">
                  <span className="inline-block rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                    {cr.callToAction.replace(/_/g, " ")}
                  </span>
                </CopyBlock>
              )}

              {cr?.creativeName && cr.creativeName !== ad.name && (
                <CopyBlock label="Creative Name">
                  <p className="text-[12px] text-slate-400">{cr.creativeName}</p>
                </CopyBlock>
              )}
            </div>
          )}

          {/* No creative at all */}
          {!cr && (
            <div className="border-b border-slate-800 px-4 py-8 text-center">
              <p className="text-xs text-slate-500">No creative metadata synced for this ad.</p>
              <p className="mt-1 text-[11px] text-slate-600">Run a Full Sync to pull creative data from Meta.</p>
            </div>
          )}

          {/* Metrics */}
          <div className="px-4 py-3">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Performance</div>
            <div className="grid grid-cols-3 gap-1.5">
              <Metric label="Spend" value={fmtC(ad.spend)} />
              <Metric label="Revenue" value={fmtC(ad.revenue)} />
              <Metric label="ROAS" value={ad.roas > 0 ? `${ad.roas.toFixed(2)}x` : "-"}
                color={ad.roas >= 3 ? "text-emerald-400" : ad.roas >= 1 ? "text-amber-400" : undefined} />
              <Metric label="CTR" value={ad.ctr > 0 ? `${ad.ctr.toFixed(2)}%` : "-"} />
              <Metric label="CPC" value={ad.cpc !== null ? fmtC(ad.cpc) : "-"} />
              <Metric label="Conv." value={ad.orders > 0 ? fmtN(ad.orders) : "-"} />
            </div>
          </div>
        </div>

        {/* ── Footer — link to creative lab ─────────────────────── */}
        <div className="shrink-0 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-slate-600">
            Esc to close
          </span>
          <Link
            href="/creative-lab/performance"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400
              hover:text-slate-200 transition-colors"
            onClick={onClose}
          >
            Creative Performance
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  );
}

// ── Image with loading state and aspect-ratio containment ───────────────────

function ImageWithFallback({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-[11px] text-slate-600">Image failed to load</p>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-[120px]">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full max-h-[280px] object-contain transition-opacity duration-150
          ${loaded ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ACTIVE" ? "bg-emerald-400" :
    status === "PAUSED" ? "bg-amber-500" : "bg-slate-600";
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`}
      title={status.charAt(0) + status.slice(1).toLowerCase()} />
  );
}

function CopyBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded bg-slate-900/50 px-2 py-1.5">
      <div className="text-[8px] font-medium uppercase text-slate-600">{label}</div>
      <div className={`text-[12px] font-semibold tabular-nums ${color ?? "text-slate-200"}`}>{value}</div>
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
