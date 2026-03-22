"use client";

import Link from "next/link";
import type { IntegrationSetupState } from "../../../lib/onboarding-types";
import type { ShopifySetupChecklistItem } from "../../../lib/shopify/types";

type Props = {
  integrations: IntegrationSetupState;
  shopifyChecklist: ShopifySetupChecklistItem[];
  onContinue: () => Promise<void>;
  onBack: () => void;
  isPending: boolean;
};

export function ConnectShopifyStep({
  integrations,
  shopifyChecklist,
  onContinue,
  onBack,
  isPending,
}: Props) {
  const shopify = integrations.shopify;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Connect Shopify
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect your Shopify store to reconcile ad performance against real
        CRM revenue — see true ROAS, not just pixel-reported.
      </p>

      {/* Connection card */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600/20 text-sm font-bold text-green-400">
            S
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Shopify</h3>
            {shopify.connected ? (
              <span className="text-xs text-emerald-400">{shopify.shopDomain}</span>
            ) : (
              <span className="text-xs text-slate-500">Not connected yet</span>
            )}
          </div>
        </div>

        <div className="mt-4">
          {shopify.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-emerald-100">
                  ✓
                </div>
                <span className="text-sm text-emerald-300">Shopify is connected</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/integrations/shopify"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  Manage Store
                </Link>
                <Link
                  href="/integrations/shopify/sync"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  Sync Status
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                We&apos;ll match your Shopify orders to ad campaigns using UTM
                parameters. CRM revenue is the source of truth for ROAS and CPA.
              </p>

              <Link
                href="/integrations/shopify"
                className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-500"
              >
                Connect Shopify Store
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Setup checklist */}
      {shopifyChecklist.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Shopify Setup Checklist
          </h4>
          <div className="space-y-2">
            {shopifyChecklist.map((item) => (
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
        You can skip this and connect Shopify later from Settings &gt; Integrations.
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
          {isPending ? "Saving…" : shopify.connected ? "Continue" : "Skip for Now"}
        </button>
      </div>
    </div>
  );
}
