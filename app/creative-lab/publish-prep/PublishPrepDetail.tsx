"use client";

// app/creative-lab/publish-prep/PublishPrepDetail.tsx
// Full detail panel for a single publish prep item.
// Sections: status header | source context | target mapping | payload preview |
//           validation checks | guardrail checks | blockers | action controls.
//
// Responsive:
//   Mobile:  stacked sections, collapsible payload preview, large action buttons
//   Desktop: used inside the right panel of the split layout

import { useState } from "react";
import Link         from "next/link";
import type { PublishPrepItem }  from "../../../types/publishPrep";
import {
  PREP_STATUS_LABEL,
  PREP_STATUS_COLOR,
  PREP_STATUS_BG,
  EXEC_MODE_LABEL,
}                                from "../../../types/publishPrep";
import { SectionCard, Badge }    from "../../../components/ui";

// ---------------------------------------------------------------------------
// Collapsible payload preview
// ---------------------------------------------------------------------------

function PayloadPreview({ item }: { item: PublishPrepItem }) {
  const [open, setOpen] = useState(false);
  const p = item.payloadPreview;
  const m = p?.metaPayloadShape;

  if (!p || !m) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 px-4 py-4">
        <p className="text-xs text-slate-600">Payload preview not yet assembled.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold text-slate-300">Meta Payload Preview</span>
        <span className="text-xs text-slate-600">{open ? "▲ collapse" : "▼ expand"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
          {m.adMessage && (
            <div>
              <p className="text-xs text-slate-600">Primary Text (adMessage)</p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{m.adMessage}</p>
            </div>
          )}
          {m.adHeadline && (
            <div>
              <p className="text-xs text-slate-600">Headline</p>
              <p className="mt-0.5 text-xs font-medium text-slate-200">{m.adHeadline}</p>
            </div>
          )}
          {m.ctaText && (
            <div>
              <p className="text-xs text-slate-600">CTA</p>
              <p className="mt-0.5 text-xs text-indigo-300">
                {m.ctaText} <span className="text-slate-600">({m.ctaType})</span>
              </p>
            </div>
          )}
          {m.destinationUrl && (
            <div>
              <p className="text-xs text-slate-600">Destination URL</p>
              <p className="mt-0.5 break-all text-xs text-sky-400">{m.destinationUrl}</p>
            </div>
          )}
          {m.imageNote && (
            <div>
              <p className="text-xs text-slate-600">Image Concept (for designer)</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{m.imageNote}</p>
            </div>
          )}
          {(m.campaignId || m.adSetId) && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-600">Target IDs</p>
              {m.campaignId && <p className="mt-0.5 font-mono text-xs text-slate-500">campaign: {m.campaignId}</p>}
              {m.adSetId    && <p className="font-mono text-xs text-slate-500">ad_set: {m.adSetId}</p>}
            </div>
          )}
          <p className="text-xs italic text-slate-700">
            This payload preview is for human review. Actual Meta ad creation requires manual entry in Meta Ads Manager or a future automated step.
          </p>
        </div>
      )}
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
          <span className={`mt-0.5 shrink-0 text-sm ${g.passed ? "text-emerald-500" : g.required ? "text-rose-500" : "text-amber-400"}`}>
            {g.passed ? "✓" : g.required ? "✕" : "⚠"}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-slate-300">{g.label}</p>
              {g.required && !g.passed && (
                <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-xs text-rose-400">blocking</span>
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
            { label: "Campaign",  value: item.targetMapping.targetCampaignName ?? item.targetMapping.targetCampaignExternalId },
            { label: "Ad Set",    value: item.targetMapping.targetAdSetName    ?? item.targetMapping.targetAdSetExternalId },
            { label: "URL",       value: item.targetMapping.destinationUrl },
            { label: "CTA Type",  value: item.targetMapping.ctaType },
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

type PrepAction = "approve" | "reject" | "publish" | "set_target" | "set_notes";

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
          {isApproved && (
            <span className="shrink-0 rounded-md border border-emerald-700/50 bg-emerald-950/30 px-2 py-1 text-xs text-emerald-300">
              Approved
            </span>
          )}
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

      {/* ── Source context ── */}
      <SectionCard title="Source Context">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: "Client",    value: item.clientName },
            { label: "Campaign",  value: item.campaignName ?? "—" },
            { label: "Creative",  value: item.creativeName ?? "—" },
            { label: "Intent",    value: item.briefIntent.replace(/_/g, " ") },
            { label: "Type",      value: item.briefDraftType.replace(/_/g, " ") },
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

      {/* ── Payload preview ── */}
      <SectionCard title="Payload Preview" description="What will be submitted to Meta Ads Manager.">
        <PayloadPreview item={item} />
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
            {/* Primary actions */}
            <div className="grid grid-cols-2 gap-2">
              {!isApproved ? (
                <button
                  onClick={() => onAction("approve")}
                  disabled={isBlocked || actionPending}
                  className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-3 py-3.5
                    text-xs font-medium text-emerald-300 hover:bg-emerald-950/50
                    active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Approve for Launch
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
            <p className="text-xs text-slate-700">
              &ldquo;Publish Now&rdquo; is available once all validation checks and guardrails pass and the item is approved.
              No Meta campaign mutations are made without explicit action here.
            </p>
          </div>
        </SectionCard>
      )}

      {isPublished && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-center">
          <p className="text-sm font-medium text-emerald-300">Published</p>
          <p className="mt-1 text-xs text-slate-500">
            This item has been marked as published. Use the payload preview to create the ad in Meta Ads Manager if not yet done.
          </p>
        </div>
      )}
    </div>
  );
}
