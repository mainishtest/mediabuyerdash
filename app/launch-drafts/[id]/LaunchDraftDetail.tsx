"use client";

import { useState, useTransition } from "react";
import {
  renameLaunchDraftAction,
  toggleVariantSelectionAction,
  markDraftReadyAction,
  archiveLaunchDraftAction,
} from "../actions";
import type { LaunchDraftWithVariants } from "../../../types/launchDraft";

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-amber-900/60 text-amber-300",
  ready:    "bg-emerald-900/60 text-emerald-300",
  archived: "bg-slate-700 text-slate-400",
};

const SOURCE_LABELS: Record<string, string> = {
  generated_copy:  "Copy variants from AI generation",
  generated_image: "Image concepts from AI generation",
  generated_both:  "Copy + Image concepts from AI generation",
  manual:          "Manually assembled",
};

export function LaunchDraftDetail({ draft }: { draft: LaunchDraftWithVariants }) {
  const [isPending, startTransition] = useTransition();

  // Rename state
  const [renaming, setRenaming]   = useState(false);
  const [nameInput, setNameInput] = useState(draft.draftName);

  // Archive confirmation
  const [confirmArchive, setConfirmArchive] = useState(false);

  function handleRename() {
    if (!nameInput.trim() || nameInput.trim() === draft.draftName) {
      setRenaming(false);
      return;
    }
    startTransition(async () => {
      await renameLaunchDraftAction(draft.id, nameInput.trim());
      setRenaming(false);
    });
  }

  function handleToggleVariant(variantId: string, current: boolean) {
    startTransition(async () => {
      await toggleVariantSelectionAction(variantId, !current, draft.id);
    });
  }

  function handleMarkReady() {
    startTransition(async () => {
      await markDraftReadyAction(draft.id);
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveLaunchDraftAction(draft.id);
    });
  }

  const { summary } = draft;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {renaming ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-base text-white focus:border-sky-600 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
                />
                <button onClick={handleRename} disabled={isPending} className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-600 disabled:opacity-50">Save</button>
                <button onClick={() => setRenaming(false)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{draft.draftName}</h1>
                {draft.status !== "archived" && (
                  <button onClick={() => setRenaming(true)} className="text-xs text-slate-500 hover:text-slate-300 underline">rename</button>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[draft.status] ?? ""}`}>{draft.status}</span>
              <span>{SOURCE_LABELS[draft.source] ?? draft.source}</span>
              <span>Base ad: <strong className="text-slate-300">{draft.baseAdName}</strong></span>
              <span>Created: {new Date(draft.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          {draft.status === "draft" && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                onClick={handleMarkReady}
                disabled={!summary.isReadyToLaunch || isPending}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark as Ready
              </button>
              {!confirmArchive ? (
                <button onClick={() => setConfirmArchive(true)} className="text-xs text-slate-500 hover:text-slate-300 underline">Archive</button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400">Archive this draft?</span>
                  <button onClick={handleArchive} disabled={isPending} className="text-xs text-rose-400 underline hover:text-rose-300">Yes</button>
                  <button onClick={() => setConfirmArchive(false)} className="text-xs text-slate-500 underline">No</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Readiness Summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Launch Readiness</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReadinessTile label="Copy variants"     ok={summary.hasApprovedCopy}  value={summary.hasApprovedCopy ? "Present" : "Missing"} />
          <ReadinessTile label="Image concepts"    ok={summary.hasApprovedImage} value={summary.hasApprovedImage ? "Present" : "Missing"} />
          <ReadinessTile label="Total variants"    ok={summary.totalVariants > 0} value={String(summary.totalVariants)} />
          <ReadinessTile label="Selected for test" ok={summary.selectedVariants > 0} value={String(summary.selectedVariants)} />
        </div>
        {summary.missingPieces.length > 0 && (
          <ul className="mt-3 space-y-1">
            {summary.missingPieces.map((m) => (
              <li key={m} className="text-xs text-amber-400">⚠ {m}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Variants */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Variants ({draft.variants.length})
        </h2>
        {draft.variants.length === 0 ? (
          <p className="text-sm text-slate-500">No variants in this draft.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.variants.map((v) => {
              const isCopy  = !!(v.hook || v.body);
              const isImage = !!(v.imageConceptTitle || v.imageConceptSummary);
              return (
                <div
                  key={v.id}
                  className={`relative rounded-xl border p-4 transition-opacity ${
                    v.selectedForLaunch
                      ? isCopy
                        ? "border-violet-700/50 bg-violet-950/20"
                        : "border-blue-700/50 bg-blue-950/20"
                      : "border-slate-700/40 bg-slate-900/40 opacity-50"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-semibold ${isCopy ? "text-violet-300" : "text-blue-300"}`}>
                        {v.variantName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isCopy && isImage ? "Copy + Image" : isCopy ? "Copy" : "Image"}
                      </p>
                    </div>
                    {draft.status !== "archived" && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={v.selectedForLaunch}
                          onChange={() => handleToggleVariant(v.id, v.selectedForLaunch)}
                          disabled={isPending}
                          className="accent-emerald-500"
                        />
                        Selected
                      </label>
                    )}
                  </div>

                  {isCopy && (
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {v.hook         && <p><span className="text-slate-500">Hook:</span> {v.hook}</p>}
                      {v.body         && <p className="line-clamp-2"><span className="text-slate-500">Body:</span> {v.body}</p>}
                      {v.callToAction && <p><span className="text-slate-500">CTA:</span> {v.callToAction}</p>}
                    </div>
                  )}

                  {isImage && (
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {v.imageConceptTitle   && <p className="font-medium text-blue-200">{v.imageConceptTitle}</p>}
                      {v.imageConceptSummary && <p className="line-clamp-3 text-slate-400">{v.imageConceptSummary}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Meta publishing note */}
      <p className="text-center text-xs text-slate-600">
        Meta publishing is not connected yet. This draft is preparation only.
      </p>
    </div>
  );
}

function ReadinessTile({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? "border-emerald-800/40 bg-emerald-950/20" : "border-slate-700 bg-slate-900"}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${ok ? "text-emerald-300" : "text-rose-400"}`}>{value}</p>
    </div>
  );
}
