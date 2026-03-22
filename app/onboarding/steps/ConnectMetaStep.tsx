"use client";

import Link from "next/link";
import type { IntegrationSetupState } from "../../../lib/onboarding-types";
import type { MetaSetupChecklistItem } from "../../../lib/meta/types";

type Props = {
  integrations: IntegrationSetupState;
  metaChecklist: MetaSetupChecklistItem[];
  metaConfigured: boolean;
  onContinue: () => Promise<void>;
  onBack: () => void;
  isPending: boolean;
};

export function ConnectMetaStep({
  integrations,
  metaChecklist,
  metaConfigured,
  onContinue,
  onBack,
  isPending,
}: Props) {
  const meta = integrations.meta;
  const hasAccounts = meta.accountCount > 0;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Connect Meta Ads
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect your Facebook & Instagram ad accounts to sync campaign
        performance data automatically.
      </p>

      {/* Connection card */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-sm font-bold text-blue-400">
            f
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Meta Business Suite</h3>
            {meta.connected ? (
              <span className="text-xs text-emerald-400">
                {meta.accountCount} ad account{meta.accountCount !== 1 ? "s" : ""} connected
              </span>
            ) : (
              <span className="text-xs text-slate-500">Not connected yet</span>
            )}
          </div>
        </div>

        <div className="mt-4">
          {meta.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-emerald-100">
                  ✓
                </div>
                <span className="text-sm text-emerald-300">Meta Ads is connected</span>
              </div>

              {!hasAccounts && (
                <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2.5">
                  <p className="text-xs text-amber-300">
                    Connected but no ad accounts selected yet. Select accounts to start syncing data.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/integrations/meta"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {hasAccounts ? "Manage Accounts" : "Select Ad Accounts"}
                </Link>
                <Link
                  href="/integrations/meta/sync"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  Sync Status
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Once connected, we&apos;ll discover your ad accounts, sync campaigns, and
                power the dashboard, alerts, and optimization features.
              </p>

              {metaConfigured ? (
                <a
                  href="/api/auth/meta/start"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Connect Meta Account
                </a>
              ) : (
                <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2.5">
                  <p className="text-xs text-amber-300">
                    Meta credentials not configured. Add META_APP_ID and META_APP_SECRET to your environment.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Setup checklist */}
      {metaChecklist.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Meta Setup Checklist
          </h4>
          <div className="space-y-2">
            {metaChecklist.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5">
                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  item.done
                    ? "bg-emerald-700 text-emerald-100"
                    : item.severity === "error"
                    ? "bg-rose-800 text-rose-200"
                    : "bg-slate-700 text-slate-400"
                }`}>
                  {item.done ? "✓" : "·"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium ${item.done ? "text-slate-300" : "text-slate-400"}`}>
                    {item.label}
                  </span>
                  {!item.done && item.actionLabel && item.actionHref && (
                    <Link
                      href={item.actionHref}
                      className="ml-2 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      {item.actionLabel}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        You can skip this step and connect Meta later from Settings &gt; Integrations.
      </p>

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
          onClick={onContinue}
          disabled={isPending}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : meta.connected && hasAccounts ? "Continue" : "Skip for Now"}
        </button>
      </div>
    </div>
  );
}
