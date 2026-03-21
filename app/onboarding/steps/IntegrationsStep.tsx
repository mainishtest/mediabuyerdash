"use client";

import Link from "next/link";
import type { IntegrationStatus } from "../../../lib/onboarding-types";

type Props = {
  integrations: IntegrationStatus;
  onContinue: () => Promise<void>;
  onBack: () => void;
  isPending: boolean;
};

function IntegrationCard({
  title,
  description,
  connected,
  detail,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  connected: boolean;
  detail: string | null;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {connected ? (
              <span className="rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                Connected
              </span>
            ) : (
              <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                Not connected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
          {detail && (
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          )}
        </div>
        <Link
          href={actionHref}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
        >
          {connected ? "Manage" : actionLabel}
        </Link>
      </div>
    </div>
  );
}

export function IntegrationsStep({ integrations, onContinue, onBack, isPending }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Connect your accounts
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect your ad platforms and revenue source. You can skip this for now
        and connect them later from Settings.
      </p>

      <div className="mt-6 space-y-3">
        <IntegrationCard
          title="Meta Ads"
          description="Connect your Facebook & Instagram ad accounts to sync campaign performance data."
          connected={integrations.metaConnected}
          detail={integrations.metaConnected ? `${integrations.metaAccountCount} account(s) connected` : null}
          actionLabel="Connect Meta"
          actionHref="/integrations/meta"
        />

        <IntegrationCard
          title="Shopify"
          description="Connect your Shopify store to reconcile ad performance against real CRM revenue."
          connected={integrations.shopifyConnected}
          detail={integrations.shopifyDomain}
          actionLabel="Connect Shopify"
          actionHref="/integrations/shopify"
        />
      </div>

      {/* Client creation prompt */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">First client</h3>
              {integrations.clientCount > 0 ? (
                <span className="rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  {integrations.clientCount} created
                </span>
              ) : (
                <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  None yet
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Create a client to organize campaigns and integrations by brand or advertiser.
            </p>
          </div>
          <Link
            href="/clients"
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
          >
            {integrations.clientCount > 0 ? "Manage" : "Add Client"}
          </Link>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        You can always connect integrations and add clients later from the Settings and Clients pages.
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
          {isPending ? "Saving…" : "Continue to Review"}
        </button>
      </div>
    </div>
  );
}
