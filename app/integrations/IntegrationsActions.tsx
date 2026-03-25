"use client";

// app/integrations/IntegrationsActions.tsx
// Inline action buttons for the integrations overview table.
// Handles reconnect + disconnect for both Meta and Shopify connections.

import { useTransition } from "react";
import { useRouter }     from "next/navigation";

type Props =
  | { type: "meta";    connectionId: string; metaConfigured?: boolean; shopDomain?: never }
  | { type: "shopify"; connectionId: string; shopDomain: string; metaConfigured?: never };

export function IntegrationsActions({ type, connectionId, metaConfigured, shopDomain }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleDisconnect() {
    if (!confirm(
      type === "meta"
        ? "Disconnect this Meta account? Ad account selections will be removed."
        : "Disconnect this Shopify store? All synced order data will be deleted."
    )) return;

    startTransition(async () => {
      await fetch("/api/integrations/disconnect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, connectionId }),
      });
      router.refresh();
    });
  }

  if (type === "meta") {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/integrations/meta"
          className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs
            font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          Manage
        </a>
        {metaConfigured && (
          <a
            href="/api/auth/meta/start"
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs
              font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            Reconnect
          </a>
        )}
        <button
          onClick={handleDisconnect}
          disabled={isPending}
          className="rounded-md border border-rose-800/50 bg-rose-950/30 px-2.5 py-1 text-xs
            font-medium text-rose-300 transition-colors hover:bg-rose-950/50 disabled:opacity-50"
        >
          {isPending ? "…" : "Disconnect"}
        </button>
      </div>
    );
  }

  // Shopify
  return (
    <div className="flex items-center gap-2">
      <a
        href="/integrations/shopify"
        className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs
          font-medium text-slate-300 transition-colors hover:bg-slate-700"
      >
        Manage
      </a>
      <a
        href="/integrations/shopify/sync"
        className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs
          font-medium text-slate-300 transition-colors hover:bg-slate-700"
      >
        Sync
      </a>
      <button
        onClick={handleDisconnect}
        disabled={isPending}
        className="rounded-md border border-rose-800/50 bg-rose-950/30 px-2.5 py-1 text-xs
          font-medium text-rose-300 transition-colors hover:bg-rose-950/50 disabled:opacity-50"
      >
        {isPending ? "…" : "Disconnect"}
      </button>
    </div>
  );
}
