"use client";

import Link from "next/link";
import type { WorkspaceAccount, IntegrationSetupState, AccountSetupChecklist } from "../../../lib/onboarding-types";

type Props = {
  workspace: WorkspaceAccount;
  integrations: IntegrationSetupState;
  checklist: AccountSetupChecklist;
  onComplete: () => Promise<void>;
  onBack: () => void;
  isPending: boolean;
};

function ChecklistRow({ label, description, done, actionLabel, actionHref }: {
  label: string;
  description: string;
  done: boolean;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-700 text-emerald-100" : "bg-slate-800 text-slate-500"
        }`}>
          {done ? "✓" : "·"}
        </div>
        <div>
          <span className={`text-sm font-medium ${done ? "text-slate-200" : "text-slate-400"}`}>
            {label}
          </span>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {!done && actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function ReviewStep({ workspace, integrations, checklist, onComplete, onBack, isPending }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Review your setup
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Here&apos;s a summary of your workspace. You can finish setup now and connect
        integrations at any time.
      </p>

      {/* Workspace summary */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Workspace
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Name</span>
            <span className="font-medium text-white">{workspace.name}</span>
          </div>
          {workspace.brandName && (
            <div className="flex justify-between">
              <span className="text-slate-400">Brand</span>
              <span className="font-medium text-white">{workspace.brandName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Timezone</span>
            <span className="font-medium text-white">{workspace.timezone.replace(/_/g, " ")}</span>
          </div>
          {workspace.industry && (
            <div className="flex justify-between">
              <span className="text-slate-400">Industry</span>
              <span className="font-medium text-white">{workspace.industry.replace(/_/g, " ")}</span>
            </div>
          )}
          {workspace.monthlyAdSpend && (
            <div className="flex justify-between">
              <span className="text-slate-400">Ad spend</span>
              <span className="font-medium text-white">{workspace.monthlyAdSpend.replace(/_/g, " ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Setup checklist */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Setup checklist
          </h3>
          <span className="text-xs text-slate-500">
            {checklist.completedCount}/{checklist.totalCount} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${(checklist.completedCount / checklist.totalCount) * 100}%` }}
          />
        </div>

        <div className="divide-y divide-slate-800/60">
          {checklist.items.map((item) => (
            <ChecklistRow key={item.id} {...item} />
          ))}
        </div>
      </div>

      {!checklist.isComplete && (
        <div className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3">
          <p className="text-xs text-amber-300">
            Some setup items are still pending. You can complete them anytime
            from Settings — they won&apos;t block you from exploring the platform.
          </p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onComplete}
          disabled={isPending}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Finishing…" : "Check Readiness & Go Live"}
        </button>
      </div>
    </div>
  );
}
