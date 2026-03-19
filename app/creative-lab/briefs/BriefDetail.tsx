"use client";

// app/creative-lab/briefs/BriefDetail.tsx
// Full brief detail panel — shown right of queue list on desktop, inline on mobile.
//
// Sections:
//   Header        — status badges + draft type + creative context + close
//   Source context — performance snapshot + fatigue/eval status
//   Brief sections — collapsible structured brief document
//   Draft variants — each variant with review action buttons
//   Brief actions  — approve/reject/revision at brief level

import { useState, useCallback }          from "react";
import Link                               from "next/link";
import type {
  CreativeBrief,
  CreativeBriefStatus,
  CreativeReviewDecision,
  CreativeDraftVariant,
}                                         from "../../../types/creativeBrief";
import { Badge, SectionCard }             from "../../../components/ui";
import { formatCurrency }                 from "../../../lib/metricUtils";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  DRAFT_TYPE_LABEL,
  DRAFT_TYPE_VARIANT,
  INTENT_LABEL,
}                                         from "./BriefCard";

// ---------------------------------------------------------------------------
// Button helpers
// ---------------------------------------------------------------------------

const BTN_BASE = "w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors active:scale-95 sm:py-2.5";

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`${BTN_BASE} bg-indigo-600 text-white hover:bg-indigo-500`}>{children}</button>;
}
function SuccessBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`${BTN_BASE} border border-emerald-700/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50`}>{children}</button>;
}
function WarnBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`${BTN_BASE} border border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50`}>{children}</button>;
}
function DangerBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`${BTN_BASE} border border-rose-800/50 bg-rose-950/30 text-rose-300 hover:bg-rose-950/50`}>{children}</button>;
}
function SecondaryBtn({ onClick, children, className = "" }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return <button onClick={onClick} className={`${BTN_BASE} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 ${className}`}>{children}</button>;
}

// ---------------------------------------------------------------------------
// Collapsible brief section
// ---------------------------------------------------------------------------

function BriefSection({ heading, content, defaultOpen = false }: { heading: string; content: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{heading}</span>
        <span className="text-xs text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3">
          {content.split("\n").map((line, i) => {
            if (!line.trim()) return <div key={i} className="h-2" />;
            const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
            const isListItem = line.startsWith("- ");
            const displayLine = isListItem ? bold.slice(2) : bold;
            return isListItem
              ? <div key={i} className="flex gap-2 text-xs leading-relaxed text-slate-300"><span className="shrink-0 text-slate-600">–</span><span dangerouslySetInnerHTML={{ __html: displayLine }} /></div>
              : <p key={i} className="text-xs leading-relaxed text-slate-300" dangerouslySetInnerHTML={{ __html: bold }} />;
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft variant card
// ---------------------------------------------------------------------------

function VariantCard({
  variant,
  onReview,
}: {
  variant:  CreativeDraftVariant;
  onReview: (variantId: string, decision: CreativeReviewDecision, note?: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  const decide = useCallback(async (decision: CreativeReviewDecision) => {
    setSaving(true);
    await onReview(variant.id, decision);
    setSaving(false);
  }, [variant.id, onReview]);

  const decisionVariant =
    variant.reviewDecision === "approve"          ? "success" :
    variant.reviewDecision === "reject"           ? "danger"  :
    variant.reviewDecision === "request_revision" ? "warning" : "neutral";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      {/* Variant title + review status */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-300">{variant.title}</p>
        {variant.reviewDecision && (
          <Badge variant={decisionVariant}>
            {variant.reviewDecision === "approve"          ? "Approved"          :
             variant.reviewDecision === "reject"           ? "Rejected"          :
             "Needs Revision"}
          </Badge>
        )}
      </div>

      {/* Copy content */}
      {variant.variantType === "copy" && (
        <div className="mt-3 space-y-2">
          {variant.hook && (
            <div>
              <p className="text-xs text-slate-600">Hook</p>
              <p className="mt-0.5 text-sm font-medium leading-snug text-slate-100">&ldquo;{variant.hook}&rdquo;</p>
            </div>
          )}
          {variant.body && (
            <div>
              <p className="text-xs text-slate-600">Body</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{variant.body}</p>
            </div>
          )}
          {variant.callToAction && (
            <div>
              <p className="text-xs text-slate-600">CTA</p>
              <p className="mt-0.5 text-xs font-medium text-indigo-300">{variant.callToAction}</p>
            </div>
          )}
        </div>
      )}

      {/* Image brief content */}
      {variant.variantType === "image" && (
        <div className="mt-3 space-y-2">
          {variant.conceptSummary && (
            <div>
              <p className="text-xs text-slate-600">Concept</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{variant.conceptSummary}</p>
            </div>
          )}
          {variant.visualChanges && (
            <div>
              <p className="text-xs text-slate-600">Visual changes</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{variant.visualChanges}</p>
            </div>
          )}
          {variant.goal && (
            <div>
              <p className="text-xs text-slate-600">Goal</p>
              <p className="mt-0.5 text-xs text-slate-400">{variant.goal}</p>
            </div>
          )}
        </div>
      )}

      {/* Review actions */}
      {!variant.reviewDecision && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SuccessBtn onClick={() => !saving && decide("approve")}>Approve</SuccessBtn>
          <WarnBtn    onClick={() => !saving && decide("request_revision")}>Revise</WarnBtn>
          <DangerBtn  onClick={() => !saving && decide("reject")}>Reject</DangerBtn>
        </div>
      )}

      {variant.reviewDecision && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => !saving && decide(
              variant.reviewDecision === "approve" ? "reject" : "approve"
            )}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Change decision
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  brief:             CreativeBrief;
  onStatusChange:    (briefId: string, status: CreativeBriefStatus, notes?: string) => void;
  onVariantReview:   (briefId: string, variantId: string, decision: CreativeReviewDecision) => void;
  onClose:           () => void;
};

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

export function BriefDetail({ brief, onStatusChange, onVariantReview, onClose }: Props) {
  const pc = brief.input;

  const handleVariantReview = useCallback(
    (variantId: string, decision: CreativeReviewDecision) => {
      onVariantReview(brief.id, variantId, decision);
    },
    [brief.id, onVariantReview],
  );

  const canStartReview = brief.status === "draft";
  const canApprove     = brief.status === "in_review";
  const canRevise      = brief.status === "in_review" || brief.status === "draft";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={STATUS_VARIANT[brief.status]}>{STATUS_LABEL[brief.status]}</Badge>
            <Badge variant={DRAFT_TYPE_VARIANT[brief.draftType]}>{DRAFT_TYPE_LABEL[brief.draftType]}</Badge>
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-snug text-white">
            {brief.creativeName ?? brief.campaignName ?? brief.clientName}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {INTENT_LABEL[brief.intent]} · {brief.clientName}
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300">✕</button>
      </div>

      <div className="divide-y divide-slate-800/60">

        {/* ── Performance context ── */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Source Context <span className="normal-case font-normal text-slate-600">(14-day window)</span>
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {[
              { label: "Spend",      value: formatCurrency(pc.spend) },
              { label: "CTR",        value: `${pc.avgCtr.toFixed(2)}%` },
              { label: "Frequency",  value: pc.avgFrequency != null ? `${pc.avgFrequency.toFixed(1)}x` : "—" },
              { label: "ROAS (CRM)", value: pc.campaignRoas != null ? `${pc.campaignRoas.toFixed(2)}x` : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-600">{label}</p>
                <p className="text-sm font-medium text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          {/* Signal summary */}
          {pc.signalSummary.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-slate-600">Signals that triggered this brief</p>
              <ul className="space-y-0.5">
                {pc.signalSummary.slice(0, 4).map((sig, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <span className="mt-0.5 shrink-0 text-amber-400">◐</span>{sig}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-600">ROAS sourced from CRM — not Meta self-reported.</p>
        </div>

        {/* ── Brief sections ── */}
        <div className="px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Creative Brief
          </p>
          <div className="space-y-2">
            {brief.sections.map((section, i) => (
              <BriefSection
                key={section.key}
                heading={section.heading}
                content={section.content}
                defaultOpen={i < 2}
              />
            ))}
          </div>
        </div>

        {/* ── Draft variants ── */}
        <div className="px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Generated Drafts
            <span className="ml-2 normal-case font-normal text-slate-600">
              ({brief.draftSet.variants.filter((v) => v.reviewDecision !== null).length}/{brief.draftSet.variants.length} reviewed)
            </span>
          </p>

          {brief.draftSet.variants.length === 0 ? (
            <p className="text-xs text-slate-600">No variants generated for this brief.</p>
          ) : (
            <div className="space-y-3">
              {brief.draftSet.variants.map((v) => (
                <VariantCard key={v.id} variant={v} onReview={handleVariantReview} />
              ))}
            </div>
          )}
        </div>

        {/* ── Brief-level actions ── */}
        <div className="px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Brief Actions
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {canStartReview && (
              <PrimaryBtn onClick={() => onStatusChange(brief.id, "in_review")}>
                Start Review
              </PrimaryBtn>
            )}
            {canApprove && (
              <SuccessBtn onClick={() => onStatusChange(brief.id, "approved")}>
                Approve Brief
              </SuccessBtn>
            )}
            {canRevise && (
              <WarnBtn onClick={() => onStatusChange(brief.id, "revision_requested")}>
                Request Revision
              </WarnBtn>
            )}
            {brief.status !== "rejected" && (
              <DangerBtn onClick={() => onStatusChange(brief.id, "rejected")}>
                Reject Brief
              </DangerBtn>
            )}
            <SecondaryBtn
              onClick={() => onStatusChange(brief.id, "draft")}
              className="text-slate-500 sm:col-span-2"
            >
              Return to Draft
            </SecondaryBtn>
          </div>

          {/* AI generation entry point */}
          <div className="mt-4 rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-3">
            <p className="text-xs font-semibold text-indigo-300">Generate AI Drafts</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Turn this brief into AI-generated copy and image direction using performance context.
            </p>
            <Link
              href={`/creative-lab/generation?briefId=${encodeURIComponent(brief.id)}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5
                text-xs font-medium text-white hover:bg-indigo-500 active:scale-95 transition-colors"
            >
              ◉ Generate AI Drafts →
            </Link>
          </div>

          {/* Linked entity navigation */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/creative-lab?clientId=${encodeURIComponent(brief.clientAccountId)}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
            >
              ↗ Creative Lab
            </Link>
            <Link
              href={`/creative-lab/refresh-queue?clientId=${encodeURIComponent(brief.clientAccountId)}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
            >
              ↗ Refresh Queue
            </Link>
            {brief.campaignId && (
              <Link
                href={`/optimization?clientId=${encodeURIComponent(brief.clientAccountId)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                ↗ Campaign
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
