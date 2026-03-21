"use client";

import Link from "next/link";
import type { IntegrationSetupState } from "../../../lib/onboarding-types";

type Props = {
  integrations: IntegrationSetupState;
  onContinue: () => Promise<void>;
  onBack: () => void;
  isPending: boolean;
};

export function ConnectMetaStep({ integrations, onContinue, onBack, isPending }: Props) {
  const meta = integrations.meta;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Connect Meta Ads
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect your Facebook & Instagram ad accounts to sync campaign
        performance data automatically.
      </p>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              {/* Meta icon placeholder */}
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

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Once connected, we&apos;ll sync your ad accounts, campaigns, and
              performance metrics. This powers the dashboard, alerts, and
              optimization features.
            </p>
          </div>
        </div>

        <div className="mt-4">
          {meta.connected ? (
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-emerald-100">
                ✓
              </div>
              <span className="text-sm text-emerald-300">Meta Ads is connected</span>
              <Link
                href="/integrations/meta"
                className="ml-auto text-xs text-slate-400 hover:text-white"
              >
                Manage
              </Link>
            </div>
          ) : (
            <Link
              href="/integrations/meta"
              className="inline-flex w-full items-center justify-center rounded-lg border border-blue-700/50 bg-blue-600/10 px-4 py-2.5 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-600/20 hover:text-blue-200"
            >
              Connect Meta Ads
            </Link>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        You can skip this step and connect Meta later from the Integrations page.
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
          {isPending ? "Saving…" : meta.connected ? "Continue" : "Skip for Now"}
        </button>
      </div>
    </div>
  );
}
