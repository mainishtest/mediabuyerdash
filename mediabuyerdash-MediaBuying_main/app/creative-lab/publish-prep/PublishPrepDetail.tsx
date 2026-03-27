"use client";

// app/creative-lab/publish-prep/PublishPrepDetail.tsx
// Full detail panel for a single publish prep item.
//
// Sections:
//   status header | blockers summary | source context | target mapping |
//   readiness bar | ad mockup preview | validation checks | guardrail checks |
//   launch notes | action controls
//
// Actions:
//   approve for launch | hold | send back | publish now
//
// Responsive:
//   Mobile:  stacked sections, collapsible payload preview, large action buttons
//   Desktop: used inside the right panel of the split layout

import { useState }             from "react";
import Link                     from "next/link";
import type { PublishPrepItem } from "../../../types/publishPrep";
import {
  PREP_STATUS_LABEL,
  PREP_STATUS_COLOR,
  PREP_STATUS_BG,
  EXEC_MODE_LABEL,
}                               from "../../../types/publishPrep";
import { summarizePublishReadiness } from "../../../lib/publishPrep/validator";
import { SectionCard, Badge }   from "../../../components/ui";

// ---------------------------------------------------------------------------
// Ad mockup preview — shows how the ad will appear in Meta Ads Manager.
// Includes both a visual mockup and collapsible raw payload fields.
// ---------------------------------------------------------------------------

function AdMockupPreview({ item }: { item: PublishPrepItem }) {
  const [rawOpen, setRawOpen] = useState(false);
  const p = item.payloadPreview;
  const m = p?.metaPayloadShape;

  if (!p || !m) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 px-4 py-4">
        <p className="text-xs text-slate-600">Payload preview not yet assembled.</p>
      </div>
    );
  }

  const isImage = item.variantType === "image";

  return (
    <div className="space-y-3">
      {/* ── Visual ad mockup ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">

        {/* Simulated page/sponsor header */}
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3">
          <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-900/60 flex items-center justify-center">
            <span className="text-xs font-bold text-indigo-300">
              {item.clientName?.slice(0, 1).toUpperCase() ?? "A"}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">{item.clientName}</p>
            <p className="text-xs text-slate-600">
              Sponsored · {EXEC_MODE_LABEL[item.executionMode]}
            </p>
          </div>
          {item.status === "published" && (
            <span className="ml-auto shrink-0 rounded-md border border-emerald-700/40 bg-emerald-950/30 px-2 py-0.5 text-xs text-emerald-400">
              Live
            </span>
          )}
        </div>

        {/* Primary text (adMessage) */}
        {m.adMessage && (
          <div className="px-4 py-3">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
              {m.adMessage}
            </p>
          </div>
        )}

        {/* Image brief placeholder */}
        {isImage && (
          <div className="mx-4 mb-3 rounded-lg border border-dashed border-slate-700 bg-slate-800/40 px-4 py-6 text-center">
            <p className="text-xs font-semibold text-slate-500">IMAGE / CREATIVE ASSET</p>
            {m.imageNote && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Designer brief: {m.imageNote}
              </p>
            )}
          </div>
        )}

        {/* Destination URL bar */}
        {m.destinationUrl && (
          <div className="border-t border-slate-800 bg-slate-800/30 px-4 py-2">
            <p className="truncate text-xs text-slate-600">{m.destinationUrl}</p>
          </div>
        )}

        {/* Headline + CTA row */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
          <div className="min-w-0">
            {m.adHeadline && (
              <p className="truncate text-xs font-semibold text-slate-200">{m.adHeadline}</p>
            )}
            {m.adDescription && m.adDescription !== m.adMessage && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{m.adDescription}</p>
            )}
          </div>
          {(m.ctaText || m.ctaType) && (
            <span className="shrink-0 rounded-lg border border-indigo-600/50 bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-300">
              {m.ctaText ?? m.ctaType}
            </span>
          )}
        </div>
      </div>

      {/* Target entity IDs */}
      {(m.campaignId || m.adSetId) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Target IDs</p>
          <div className="space-y-1">
            {m.campaignId && (
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-slate-600">Campaign</span>
                <span className="font-mono text-xs text-slate-500 break-all">{m.campaignId}</span>
              </div>
            )}
            {m.adSetId && (
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-slate-600">Ad Set</span>
                <span className="font-mono text-xs text-slate-500 break-all">{m.adSetId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible raw API payload fields */}
      <div className="rounded-xl border border-slate-800">
        <button
          onClick={() => setRawOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <span className="text-xs text-slate-600">Raw API payload fields</span>
          <span className="text-xs text-slate-700">{rawOpen ? "▲" : "▼"}</span>
        </button>
        {rawOpen && (
          <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-2">
            {[
              { key: "adMessage",      label: "Primary Text" },
              { key: "adHeadline",     label: "Headline" },
              { key: "adDescription",  label: "Description" },
              { key: "ctaText",        label: "CTA Text" },
              { key: "ctaType",        label: "CTA Type" },
              { key: "destinationUrl", label: "Destination URL" },
              { key: "imageNote",      label: "Image Note" },
            ].map(({ key, label }) => {
              const val = m[key as keyof typeof m];
              if (!val) return null;
              return (
                <div key={key}>
                  <p className="text-xs text-slate-600">{label}</p>
                  <p className="mt-0.5 whitespace-pre-wrap break-all text-xs text-slate-400">
                    {val as string}
                  </p>
                </div>
              );
            })}
            <p className="mt-2 text-xs italic text-slate-700">
              For manual entry in Meta Ads Manager.
              Use guarded_publish execution mode to trigger automated API creation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Readiness summary bar
// ---------------------------------------------------------------------------

function ReadinessSummaryBar({ item }: { item: PublishPrepItem }) {
  const readiness = summarizePublishReadiness(
    item.validation,
    item.guardrails,
    item.approvedForLaunch,
  );

  const levelColor: Record<string, string> = {
    not_ready:          "text-rose-400",
    partially_ready:    "text-amber-400",
    ready_for_approval: "text-sky-400",
    ready_to_publish:   "text-emerald-400",
  };
  const barColor: Record<string, string> = {
    not_ready:          "bg-rose-600",
    partially_ready:    "bg-amber-500",
    ready_for_approval: "bg-sky-500",
    ready_to_publish:   "bg-emerald-500",
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs font-semibold ${levelColor[readiness.level] ?? "text-slate-400"}`}>
          {readiness.summary}
        </p>
        <span className="shrink-0 text-xs text-slate-600 tabular-nums">
          {readiness.checksPassedPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${barColor[readiness.level] ?? "bg-slate-600"}`}
          style={{ width: `${readiness.checksPassedPct}%` }}
        />
      </div>

      {/* Counts */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {readiness.blockerCount > 0 && (
          <span className="text-xs text-rose-400">
            {readiness.blockerCount} blocker{readiness.blockerCount !== 1 ? "s" : ""}
          </span>
        )}
        {readiness.warningCount > 0 && (
          <span className="text-xs text-amber-400">
            {readiness.warningCount} warning{readiness.warningCount !== 1 ? "s" : ""}
          </span>
        )}
        {readiness.guardrailFailCount > 0 && (
          <span className="text-xs text-violet-400">
            {readiness.guardrailFailCount} guardrail{readiness.guardrailFailCount !== 1 ? "s" : ""} failing
          </span>
        )}
        {readiness.blockerCount === 0 && readiness.warningCount === 0 && readiness.guardrailFailCount === 0 && (
          <span className="text-xs text-emerald-500">All checks passing</span>
        )}
      </div>

      {/* Next step */}
      <p className="text-xs text-slate-600">{readiness.nextStep}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation check list
// ---------------------------------------------------------------------------

function ValidationPanel({ item }: { item: PublishPrepItem }) {
  const v = item.validation;
  if (!v) return (
    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-4">
      <p className="text-xs text-slate-600">Validation not yet run.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {v.checks.map((c) => (
        <div key={c.key} className="flex items-start gap-2.5">
          <span className={`mt-0.5 shrink-0 text-sm ${c.passed ? "text-emerald-500" : "text-rose-500"}`}>
            {c.passed ? "✓" : "✕"}
          </span>
          <div>
            <p className="text-xs font-medium text-slate-300">{c.label}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{c.message}</p>
          </div>
        </div>
      ))}
      {v.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 text-sm text-amber-400">⚠</span>
          <p className="text-xs leading-relaxed text-amber-400">{w.message}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guardrail list
// ---------------------------------------------------------------------------

function GuardrailPanel({ item }: { item: PublishPrepItem }) {
  const gs = item.guardrails;
  if (!gs.length) return (
    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-4">
      <p className="text-xs text-slate-600">Guardrails not yet evaluated.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {gs.map((g) => (
        <div key={g.key} className="flex items-start gap-2.5">
          <span className={`mt-0.5 shrink-0 text-sm ${
            g.passed ? "text-emerald-500" : g.required ? "text-rose-500" : "text-amber-400"
          }`}>
            {g.passed ? "✓" : g.required ? "✕" : "⚠"}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-slate-300">{g.label}</p>
              {g.required && !g.passed && (
                <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-xs text-rose-400">
                  blocking
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{g.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blockers summary
// ---------------------------------------------------------------------------

function BlockersSummary({ item }: { item: PublishPrepItem }) {
  const blockers = [
    ...(item.validation?.blockers ?? []).map((b) => b.message),
    ...item.guardrails.filter((g) => g.required && !g.passed).map((g) => g.message),
  ];

  if (blockers.length === 0) return null;

  return (
    <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-rose-500">
        Launch Blockers ({blockers.length})
      </p>
      <ul className="space-y-1.5">
        {blockers.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-rose-300">
            <span className="shrink-0 mt-0.5">✕</span>{b}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Target mapping form section
// ---------------------------------------------------------------------------

function TargetMappingSection({
  item,
  onUpdateMapping,
}: {
  item:            PublishPrepItem;
  onUpdateMapping: (fields: Partial<PublishPrepItem["targetMapping"]>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields]   = useState({
    targetCampaignExternalId: item.targetMapping.targetCampaignExternalId ?? "",
    targetCampaignName:       item.targetMapping.targetCampaignName       ?? "",
    targetAdSetExternalId:    item.targetMapping.targetAdSetExternalId    ?? "",
    targetAdSetName:          item.targetMapping.targetAdSetName          ?? "",
    destinationUrl:           item.targetMapping.destinationUrl           ?? "",
    ctaType:                  item.targetMapping.ctaType                  ?? "",
  });

  const handleSave = () => {
    onUpdateMapping({
      targetCampaignExternalId: fields.targetCampaignExternalId || null,
      targetCampaignName:       fields.targetCampaignName       || null,
      targetAdSetExternalId:    fields.targetAdSetExternalId    || null,
      targetAdSetName:          fields.targetAdSetName          || null,
      destinationUrl:           fields.destinationUrl           || null,
      ctaType:                  fields.ctaType                  || null,
    });
    setEditing(false);
  };

  return (
    <div>
      {!editing ? (
        <div className="space-y-2">
          {[
            { label: "Campaign", value: item.targetMapping.targetCampaignName ?? item.targetMapping.targetCampaignExternalId },
            { label: "Ad Set",   value: item.targetMapping.targetAdSetName    ?? item.targetMapping.targetAdSetExternalId },
            { label: "URL",      value: item.targetMapping.destinationUrl },
            { label: "CTA Type", value: item.targetMapping.ctaType },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className="w-20 shrink-0 text-xs text-slate-600">{label}</span>
              <span className={`text-xs ${value ? "text-slate-300" : "text-slate-700"}`}>
                {value ?? "—"}
              </span>
            </div>
          ))}
          <button
            onClick={() => setEditing(true)}
            className="mt-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
              text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Edit Mapping
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { key: "targetCampaignExternalId", label: "Campaign ID (Meta)" },
            { key: "targetCampaignName",       label: "Campaign Name" },
            { key: "targetAdSetExternalId",    label: "Ad Set ID (Meta)" },
            { key: "targetAdSetName",          label: "Ad Set Name" },
            { key: "destinationUrl",           label: "Destination URL" },
            { key: "ctaType",                  label: "CTA Type (e.g. SHOP_NOW)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-slate-500">{label}</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2
                  text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
                value={fields[key as keyof typeof fields]}
                placeholder={`Enter ${label.toLowerCase()}…`}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Save Mapping
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props + action types
// ---------------------------------------------------------------------------

type PrepAction = "approve" | "reject" | "hold" | "publish" | "set_target" | "set_notes";

type Props = {
  item:            PublishPrepItem;
  onAction:        (action: PrepAction, data?: Record<string, unknown>) => void;
  actionPending?:  boolean;
};

// ---------------------------------------------------------------------------
// Main detail component
// ---------------------------------------------------------------------------

export function PublishPrepDetail({ item, onAction, actionPending = false }: Props) {
  const [notesValue, setNotesValue] = useState(item.launchNotes ?? "");

  const isPublishable = item.status === "ready_to_publish";
  const isPublished   = item.status === "published";
  const isBlocked     = item.status === "blocked";
  const isHeld        = item.status === "held";
  const isApproved    = item.approvedForLaunch;

  const statusColor = PREP_STATUS_COLOR[item.status];
  const statusBg    = PREP_STATUS_BG[item.status];

  return (
    <div className="space-y-5">

      {/* ── Status header ── */}
      <div className={`rounded-xl border p-4 ${statusBg}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-bold ${statusColor}`}>
              {PREP_STATUS_LABEL[item.status]}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {EXEC_MODE_LABEL[item.executionMode]} · {item.variantType} variant
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {isApproved && (
              <span className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-2 py-1 text-xs text-emerald-300">
                Approved
              </span>
            )}
            {isHeld && (
              <span className="rounded-md border border-violet-700/50 bg-violet-950/30 px-2 py-1 text-xs text-violet-300">
                On Hold
              </span>
            )}
          </div>
        </div>
        {item.approvedAt && (
          <p className="mt-2 text-xs text-slate-600">
            Approved {new Date(item.approvedAt).toLocaleString()}
          </p>
        )}
        {item.publishedAt && (
          <p className="mt-1 text-xs text-emerald-600">
            Published {new Date(item.publishedAt).toLocaleString()}
          </p>
        )}
        {item.publishError && (
          <p className="mt-1 text-xs text-rose-400">Error: {item.publishError}</p>
        )}
      </div>

      {/* ── Blockers ── */}
      <BlockersSummary item={item} />

      {/* ── Readiness summary bar ── */}
      <ReadinessSummaryBar item={item} />

      {/* ── Source context ── */}
      <SectionCard title="Source Context">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: "Client",   value: item.clientName },
            { label: "Campaign", value: item.campaignName ?? "—" },
            { label: "Creative", value: item.creativeName ?? "—" },
            { label: "Intent",   value: item.briefIntent.replace(/_/g, " ") },
            { label: "Type",     value: item.briefDraftType.replace(/_/g, " ") },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-600">{label}</p>
              <p className="text-xs font-medium text-slate-200 capitalize">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/creative-lab/review?briefId=${encodeURIComponent(item.briefId)}`}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ↗ Review page
          </Link>
          <Link
            href={`/creative-lab/generation?briefId=${encodeURIComponent(item.briefId)}`}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ↗ Generation
          </Link>
        </div>
      </SectionCard>

      {/* ── Target mapping ── */}
      <SectionCard title="Target Mapping" description="Map to a Meta campaign and ad set before approving.">
        {isPublished ? (
          <div className="space-y-2">
            {[
              { label: "Campaign", value: item.targetMapping.targetCampaignName ?? item.targetMapping.targetCampaignExternalId },
              { label: "Ad Set",   value: item.targetMapping.targetAdSetName    ?? item.targetMapping.targetAdSetExternalId },
              { label: "URL",      value: item.targetMapping.destinationUrl },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <span className="w-20 shrink-0 text-xs text-slate-600">{label}</span>
                <span className="text-xs text-slate-300">{value ?? "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <TargetMappingSection
            item={item}
            onUpdateMapping={(fields) => onAction("set_target", fields)}
          />
        )}
      </SectionCard>

      {/* ── Ad mockup preview ── */}
      <SectionCard title="Ad Preview" description="How this creative will appear in Meta Ads Manager.">
        <AdMockupPreview item={item} />
      </SectionCard>

      {/* ── Validation ── */}
      <SectionCard title="Validation Checks">
        <ValidationPanel item={item} />
      </SectionCard>

      {/* ── Guardrails ── */}
      <SectionCard title="Launch Guardrails">
        <GuardrailPanel item={item} />
      </SectionCard>

      {/* ── Launch notes ── */}
      <SectionCard title="Launch Notes">
        <textarea
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5
            text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
          rows={3}
          placeholder="Add context for the reviewer or publisher…"
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={() => {
            if (notesValue !== (item.launchNotes ?? "")) {
              onAction("set_notes", { notes: notesValue });
            }
          }}
        />
      </SectionCard>

      {/* ── Action controls ── */}
      {!isPublished && (
        <SectionCard title="Launch Actions">
          <div className="space-y-2">

            {/* Primary row: approve / send back / hold */}
            <div className="grid grid-cols-3 gap-2">
              {!isApproved ? (
                <button
                  onClick={() => onAction("approve")}
                  disabled={isBlocked || actionPending}
                  className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-3 py-3.5
                    text-xs font-medium text-emerald-300 hover:bg-emerald-950/50
                    active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Approve
                </button>
              ) : (
                <button
                  onClick={() => onAction("reject")}
                  disabled={actionPending}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-3.5
                    text-xs font-medium text-slate-300 hover:bg-slate-700
                    active:scale-95 transition-all disabled:opacity-40"
                >
                  Send Back
                </button>
              )}

              {/* Hold — pause without rejecting */}
              <button
                onClick={() => onAction("hold")}
                disabled={isHeld || isPublished || actionPending}
                title="Pause this item without rejecting it. Can be resumed later."
                className="rounded-xl border border-violet-700/40 bg-violet-950/20 px-3 py-3.5
                  text-xs font-medium text-violet-300 hover:bg-violet-950/40
                  active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isHeld ? "Held" : "Hold"}
              </button>

              {/* Publish now */}
              <button
                onClick={() => onAction("publish")}
                disabled={!isPublishable || actionPending}
                className="rounded-xl border border-sky-700/50 bg-sky-950/30 px-3 py-3.5
                  text-xs font-medium text-sky-200 hover:bg-sky-950/50
                  active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending ? "Working…" : "Publish Now"}
              </button>
            </div>

            {/* Hold explanation */}
            {isHeld && (
              <div className="rounded-xl border border-violet-700/30 bg-violet-950/10 px-3 py-2.5">
                <p className="text-xs text-violet-300">
                  This item is on hold. Re-approve to resume the launch workflow.
                </p>
                <button
                  onClick={() => onAction("approve")}
                  disabled={isBlocked || actionPending}
                  className="mt-2 text-xs text-violet-400 hover:text-violet-200 underline
                    disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  Resume — Approve for Launch
                </button>
              </div>
            )}

            <p className="text-xs text-slate-700">
              &ldquo;Publish Now&rdquo; is available once all checks and guardrails pass and the item is
              approved. Hold pauses the item without resetting its validation state.
              No Meta campaign mutations happen without explicit action here.
            </p>
          </div>
        </SectionCard>
      )}

      {isPublished && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-center">
          <p className="text-sm font-medium text-emerald-300">Published</p>
          <p className="mt-1 text-xs text-slate-500">
            This item has been marked as published. Use the ad preview above to complete
            manual entry in Meta Ads Manager if not yet done. Automated creation is triggered
            via guarded_publish execution mode.
          </p>
        </div>
      )}
    </div>
  );
}
