"use client";

import { useState, useTransition } from "react";
import { PageHeader }   from "../../../components/ui/PageHeader";
import { SectionCard }  from "../../../components/ui/SectionCard";
import { Badge }        from "../../../components/ui/Badge";
import { ActionButton } from "../../../components/ui/ActionButton";
import { StatCard }     from "../../../components/ui/StatCard";
import {
  startShopifyOAuthAction,
  disconnectShopifyAction,
  connectShopifyClientCredentialsAction,
} from "./actions";

// ── Error label map ────────────────────────────────────────────────────────────

const ERROR_LABELS: Record<string, string> = {
  oauth_denied:    "You cancelled the Shopify authorisation.",
  invalid_state:   "Security check failed. Please try connecting again.",
  shop_mismatch:   "Shop domain mismatch. Please try connecting again.",
  invalid_hmac:    "Shopify signature verification failed.",
  callback_failed: "OAuth callback failed. Check server logs.",
  config_missing:  "Shopify credentials are not configured on this server.",
  missing_domain:  "Please enter a shop domain.",
  invalid_domain:  "That does not look like a valid Shopify domain.",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface Connection {
  id:               string;
  shopDomain:       string;
  connectionStatus: string;
  scopes:           string | null;
  installedAt:      Date;
  clientAccountId:  string | null;
  clientAccount:    { id: string; name: string } | null;
}

interface SyncLog {
  status:       string;
  ordersSynced: number;
  startedAt:    Date;
  completedAt:  Date | null;
}

interface Props {
  isConfigured:  boolean;
  connection:    Connection | null;
  syncLog:       SyncLog | null;
  orderCount:    number;
  errorMessage:  string | null;
  justConnected: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShopifyIntegrationView({
  isConfigured,
  connection,
  syncLog,
  orderCount,
  errorMessage,
  justConnected,
}: Props) {
  const [shopInput,      setShopInput]      = useState("");
  const [clientIdInput,  setClientIdInput]  = useState("");
  const [clientSecInput, setClientSecInput] = useState("");
  const [connectMode,    setConnectMode]    = useState<"credentials" | "oauth">("credentials");
  const [credsError,     setCredsError]     = useState<string | null>(null);
  const [isPending,      startTransition]   = useTransition();
  const [credsPending,   startCreds]        = useTransition();

  const humanError = errorMessage ? (ERROR_LABELS[errorMessage] ?? errorMessage) : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      <PageHeader
        title="Shopify Integration"
        description="Connect your Shopify store to ingest order revenue, UTM attribution, and CRM data for reconciliation."
        badge={
          connection
            ? <Badge variant="success">Connected</Badge>
            : <Badge variant="neutral">Not Connected</Badge>
        }
      />

      {/* Status banners */}
      {justConnected && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          Shopify store connected successfully. You can now run an order sync.
        </div>
      )}
      {humanError && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {humanError}
        </div>
      )}

      {/* Credentials warning — only shown when OAuth is unconfigured AND we're on OAuth tab */}
      {!isConfigured && connectMode === "oauth" && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-400">
          <strong className="font-semibold">OAuth not configured.</strong>
          {" "}Set{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-200">SHOPIFY_APP_KEY</code>
          ,{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-200">SHOPIFY_APP_SECRET</code>
          , and{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-200">SHOPIFY_REDIRECT_URI</code>{" "}
          to use the OAuth flow.
        </div>
      )}

      {/* Summary strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Connection Status"
          value={connection ? "Connected" : "Not Connected"}
        />
        <StatCard
          label="Orders Synced"
          value={orderCount.toLocaleString()}
        />
        <StatCard
          label="Last Sync"
          value={
            syncLog?.completedAt
              ? new Date(syncLog.completedAt).toLocaleDateString()
              : "Never"
          }
        />
      </section>

      {/* Connection management */}
      {connection ? (
        <SectionCard
          title="Connected Store"
          actions={<Badge variant="success">Active</Badge>}
        >
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="w-36 shrink-0 text-slate-500">Shop domain</dt>
              <dd className="font-medium text-slate-100">{connection.shopDomain}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="w-36 shrink-0 text-slate-500">Status</dt>
              <dd>
                <Badge variant={connection.connectionStatus === "active" ? "success" : "warning"}>
                  {connection.connectionStatus}
                </Badge>
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="w-36 shrink-0 text-slate-500">Installed</dt>
              <dd className="text-slate-300">
                {new Date(connection.installedAt).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="w-36 shrink-0 text-slate-500">Client account</dt>
              <dd className="text-slate-300">
                {connection.clientAccount
                  ? <span className="font-medium text-slate-100">{connection.clientAccount.name}</span>
                  : <span className="text-slate-500 text-xs italic">Not mapped — assign a client account in Settings</span>
                }
              </dd>
            </div>
            {connection.scopes && (
              <div className="flex items-baseline gap-2">
                <dt className="w-36 shrink-0 text-slate-500">Scopes</dt>
                <dd className="text-xs text-slate-400 break-all">{connection.scopes}</dd>
              </div>
            )}
          </dl>

          <div className="mt-5 flex items-center gap-3">
            <a
              href="/integrations/shopify/sync"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Go to Sync →
            </a>
            <form action={disconnectShopifyAction}>
              <input type="hidden" name="connectionId" value={connection.id} />
              <ActionButton type="submit" variant="danger" size="sm">
                Disconnect
              </ActionButton>
            </form>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Connect a Shopify Store">
          {/* Method tabs */}
          <div className="mb-5 flex gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-1 w-fit">
            {(["credentials", "oauth"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setConnectMode(mode); setCredsError(null); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  connectMode === mode
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {mode === "credentials" ? "Client Credentials" : "OAuth"}
              </button>
            ))}
          </div>

          {credsError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {credsError}
            </div>
          )}

          {/* ── Client Credentials (default) ── */}
          {connectMode === "credentials" && (
            <>
              <p className="mb-4 text-sm text-slate-400">
                Enter the store domain along with the{" "}
                <strong className="font-medium text-slate-300">Client ID</strong> and{" "}
                <strong className="font-medium text-slate-300">Client Secret</strong>{" "}
                from your Shopify custom app. An access token will be fetched automatically.
              </p>

              <form
                action={async (fd) => {
                  setCredsError(null);
                  startCreds(async () => {
                    const result = await connectShopifyClientCredentialsAction(fd);
                    if (result?.error) setCredsError(result.error);
                  });
                }}
                className="flex flex-col gap-4"
              >
                <div>
                  <label htmlFor="cc-shopDomain" className="mb-1.5 block text-xs font-medium text-slate-400">
                    Shop domain
                  </label>
                  <input
                    id="cc-shopDomain"
                    name="shopDomain"
                    type="text"
                    placeholder="your-store.myshopify.com"
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    disabled={credsPending}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                      text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none
                      disabled:opacity-50"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cc-clientId" className="mb-1.5 block text-xs font-medium text-slate-400">
                      Client ID
                    </label>
                    <input
                      id="cc-clientId"
                      name="clientId"
                      type="text"
                      placeholder="5e78fcc4c4e4f43c…"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      disabled={credsPending}
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                        text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none
                        disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="cc-clientSecret" className="mb-1.5 block text-xs font-medium text-slate-400">
                      Client Secret
                    </label>
                    <input
                      id="cc-clientSecret"
                      name="clientSecret"
                      type="password"
                      placeholder="shpss_xxxxxxxxxxxx…"
                      value={clientSecInput}
                      onChange={(e) => setClientSecInput(e.target.value)}
                      disabled={credsPending}
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                        text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none
                        disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <ActionButton
                    type="submit"
                    variant="primary"
                    disabled={credsPending || !shopInput.trim() || !clientIdInput.trim() || !clientSecInput.trim()}
                  >
                    {credsPending ? "Connecting…" : "Connect Shopify"}
                  </ActionButton>
                </div>
              </form>

              <p className="mt-3 text-xs text-slate-500">
                Credentials are exchanged server-side. The app needs{" "}
                <strong className="font-medium text-slate-400">read_orders</strong> and{" "}
                <strong className="font-medium text-slate-400">read_customers</strong> scopes.
              </p>
            </>
          )}

          {/* ── OAuth flow ── */}
          {connectMode === "oauth" && (
            <>
              <p className="mb-4 text-sm text-slate-400">
                You will be redirected to Shopify to authorise read-only access to orders
                and customer data.
              </p>

              <form
                action={(formData) => {
                  startTransition(() => { startShopifyOAuthAction(formData); });
                }}
                className="flex flex-col gap-4 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <label htmlFor="oauth-shopDomain" className="mb-1.5 block text-xs font-medium text-slate-400">
                    Shop domain
                  </label>
                  <input
                    id="oauth-shopDomain"
                    name="shopDomain"
                    type="text"
                    placeholder="your-store.myshopify.com"
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    disabled={!isConfigured || isPending}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                      text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none
                      disabled:opacity-50"
                  />
                </div>
                <ActionButton
                  type="submit"
                  variant="primary"
                  disabled={!isConfigured || isPending || !shopInput.trim()}
                >
                  {isPending ? "Redirecting…" : "Connect via OAuth"}
                </ActionButton>
              </form>

              <p className="mt-3 text-xs text-slate-500">
                Only <strong className="font-medium text-slate-400">read_orders</strong> and{" "}
                <strong className="font-medium text-slate-400">read_customers</strong> scopes
                are requested. No write access is granted.
              </p>
            </>
          )}
        </SectionCard>
      )}

      {/* Latest sync summary (if exists) */}
      {syncLog && (
        <SectionCard title="Latest Sync Result">
          <div className="flex items-center gap-3 text-sm">
            <Badge
              variant={
                syncLog.status === "completed" ? "success"
                : syncLog.status === "partial"  ? "warning"
                : "danger"
              }
            >
              {syncLog.status}
            </Badge>
            <span className="text-slate-400">
              {syncLog.ordersSynced} order{syncLog.ordersSynced !== 1 ? "s" : ""} synced
            </span>
            {syncLog.completedAt && (
              <span className="ml-auto text-slate-500">
                {new Date(syncLog.completedAt).toLocaleString()}
              </span>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
