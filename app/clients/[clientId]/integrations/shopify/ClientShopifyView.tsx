"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader }   from "../../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../../components/ui/SectionCard";
import { Badge }        from "../../../../../components/ui/Badge";
import { ActionButton } from "../../../../../components/ui/ActionButton";
import { StatCard }     from "../../../../../components/ui/StatCard";
import {
  startClientShopifyOAuthAction,
  connectShopifyManuallyAction,
  unmapShopifyFromClientPageAction,
  runClientShopifySyncAction,
} from "./actions";
import type { ShopifySyncSummary } from "../../../../../lib/shopify/sync";

// ── Error label map ────────────────────────────────────────────────────────────

const ERROR_LABELS: Record<string, string> = {
  oauth_denied:    "You cancelled the Shopify authorisation.",
  invalid_state:   "Security check failed — please try again.",
  shop_mismatch:   "Shop domain mismatch — please try again.",
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
}

interface SyncLog {
  status:          string;
  ordersSynced:    number;
  lineItemsSynced: number;
  errorMessages:   string | null;
  startedAt:       Date;
  completedAt:     Date | null;
}

interface Order {
  id:             string;
  orderNumber:    string;
  orderCreatedAt: Date;
  currency:       string;
  totalPrice:     number;
  customerEmail:  string | null;
  utmSource:      string | null;
  utmMedium:      string | null;
  utmCampaign:    string | null;
  utmContent:     string | null;
  utmTerm:        string | null;
  lineItemCount:  number;
}

interface Props {
  clientId:      string;
  clientName:    string;
  isConfigured:  boolean;
  connection:    Connection | null;
  syncLog:       SyncLog | null;
  orderCount:    number;
  lineItemCount: number;
  totalRevenue:  number;
  recentOrders:  Order[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function statusVariant(s: string): "success" | "warning" | "danger" | "neutral" {
  if (s === "completed") return "success";
  if (s === "partial")   return "warning";
  if (s === "failed")    return "danger";
  return "neutral";
}

// ── Readiness strip ────────────────────────────────────────────────────────────

function ReadinessStrip({
  connected,
  synced,
  orderCount,
}: {
  connected:  boolean;
  synced:     boolean;
  orderCount: number;
}) {
  const items = [
    {
      label: "Shopify Connected",
      done:  connected,
      hint:  connected ? "Store linked to this client" : "Connect a store below",
    },
    {
      label: "Orders Synced",
      done:  synced,
      hint:  synced ? `${orderCount} orders available` : "Run a sync after connecting",
    },
    {
      label: "Source-of-Truth Ready",
      done:  synced && orderCount > 0,
      hint:
        synced && orderCount > 0
          ? "Revenue data available for reconciliation"
          : "Sync orders to unlock reconciliation",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Source-of-Truth Status
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
                rounded-full text-xs font-bold ${
                  item.done
                    ? "bg-emerald-700 text-emerald-100"
                    : "bg-slate-800 text-slate-500"
                }`}
            >
              {item.done ? "✓" : "○"}
            </span>
            <div>
              <p className={`text-sm font-medium ${item.done ? "text-slate-200" : "text-slate-500"}`}>
                {item.label}
              </p>
              <p className="text-xs text-slate-600">{item.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ClientShopifyView({
  clientId,
  clientName,
  isConfigured,
  connection,
  syncLog,
  orderCount,
  lineItemCount,
  totalRevenue,
  recentOrders,
}: Props) {
  const [shopInput,      setShopInput]      = useState("");
  const [tokenInput,     setTokenInput]     = useState("");
  const [manualError,    setManualError]    = useState<string | null>(null);
  const [lastResult,     setLastResult]     = useState<ShopifySyncSummary | null>(null);
  const [oauthPending,   startOAuth]        = useTransition();
  const [manualPending,  startManual]       = useTransition();
  const [syncPending,    startSync]         = useTransition();
  const [unmapPending,   startUnmap]        = useTransition();

  // Read error / success from URL (server-rendered, so use window.location on client)
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const errorParam   = searchParams?.get("error");
  const justConnected = searchParams?.get("connected") === "1";
  const humanError   = errorParam ? (ERROR_LABELS[errorParam] ?? errorParam) : null;

  const hasSynced     = (syncLog?.completedAt ?? null) !== null || (lastResult !== null);
  const activeSyncLog = lastResult
    ? {
        status:          lastResult.status,
        ordersSynced:    lastResult.ordersSynced,
        lineItemsSynced: lastResult.lineItemsSynced,
        errorMessages:   lastResult.errors.length > 0 ? JSON.stringify(lastResult.errors) : null,
        startedAt:       new Date(lastResult.startedAt),
        completedAt:     new Date(lastResult.completedAt),
      }
    : syncLog;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/clients/${clientId}`} className="hover:text-slate-300">
          {clientName}
        </Link>
        <span>/</span>
        <span className="text-slate-400">Shopify</span>
      </nav>

      <PageHeader
        title="Shopify Integration"
        description={`Connect ${clientName}'s Shopify store to ingest order revenue and UTM attribution as source-of-truth CRM data.`}
        badge={
          connection
            ? <Badge variant="success">Connected</Badge>
            : <Badge variant="neutral">Not Connected</Badge>
        }
      />

      {/* Banners */}
      {justConnected && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          Shopify store connected and mapped to {clientName}. Run a sync to import orders.
        </div>
      )}
      {humanError && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {humanError}
        </div>
      )}

      {/* Readiness */}
      <ReadinessStrip
        connected={!!connection}
        synced={hasSynced}
        orderCount={orderCount}
      />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Orders Synced"  value={orderCount.toLocaleString()} />
        <StatCard label="Line Items"      value={lineItemCount.toLocaleString()} />
        <StatCard
          label="Total Revenue"
          value={totalRevenue > 0 ? fmt(totalRevenue) : "—"}
        />
        <StatCard
          label="Last Sync"
          value={
            activeSyncLog?.completedAt
              ? new Date(activeSyncLog.completedAt).toLocaleDateString()
              : "Never"
          }
        />
      </section>

      {/* Connection management */}
      {connection ? (
        <SectionCard
          title="Connected Store"
          actions={
            <Badge variant={connection.connectionStatus === "active" ? "success" : "warning"}>
              {connection.connectionStatus}
            </Badge>
          }
        >
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="w-32 shrink-0 text-slate-500">Shop domain</dt>
              <dd className="font-medium text-slate-100">{connection.shopDomain}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="w-32 shrink-0 text-slate-500">Installed</dt>
              <dd className="text-slate-300">
                {new Date(connection.installedAt).toLocaleDateString()}
              </dd>
            </div>
            {connection.scopes && (
              <div className="flex items-baseline gap-2">
                <dt className="w-32 shrink-0 text-slate-500">Scopes</dt>
                <dd className="text-xs text-slate-400 break-all">{connection.scopes}</dd>
              </div>
            )}
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {/* Sync button */}
            <ActionButton
              variant="primary"
              disabled={syncPending}
              onClick={() => {
                startSync(async () => {
                  const result = await runClientShopifySyncAction(clientId);
                  setLastResult(result);
                });
              }}
            >
              {syncPending ? "Syncing…" : "Run Order Sync"}
            </ActionButton>

            {/* Unmap */}
            <ActionButton
              variant="ghost"
              size="sm"
              disabled={unmapPending}
              onClick={() => {
                startUnmap(() =>
                  unmapShopifyFromClientPageAction(clientId, connection.id)
                );
              }}
            >
              {unmapPending ? "Removing…" : "Unmap store"}
            </ActionButton>

            <Link
              href="/integrations/shopify"
              className="ml-auto text-xs text-slate-500 hover:text-slate-300"
            >
              Manage all connections →
            </Link>
          </div>

          {/* Sync result banner */}
          {lastResult && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                lastResult.status === "completed"
                  ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                  : lastResult.status === "partial"
                  ? "border-amber-700 bg-amber-950/40 text-amber-300"
                  : "border-red-800 bg-red-950/40 text-red-400"
              }`}
            >
              <span className="font-medium capitalize">{lastResult.status}:</span>{" "}
              {lastResult.ordersSynced} orders · {lastResult.lineItemsSynced} line items synced.
              {lastResult.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs opacity-80">
                  {lastResult.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {lastResult.errors.length > 5 && (
                    <li>…and {lastResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* DB sync log summary */}
          {activeSyncLog && !lastResult && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3 text-sm">
              <Badge variant={statusVariant(activeSyncLog.status)}>
                {activeSyncLog.status}
              </Badge>
              <span className="text-slate-400">
                {activeSyncLog.ordersSynced} orders · {activeSyncLog.lineItemsSynced} line items
              </span>
              {activeSyncLog.completedAt && (
                <span className="ml-auto text-xs text-slate-500">
                  {new Date(activeSyncLog.completedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </SectionCard>
      ) : (
        /* ── Connect form ── */
        <SectionCard title="Connect a Shopify Store">
          {isConfigured ? (
            <>
              <p className="mb-5 text-sm text-slate-400">
                Connect a Shopify store to map it directly to{" "}
                <strong className="font-medium text-slate-300">{clientName}</strong>.
                You will be redirected to Shopify to authorise read-only access to orders and customer data.
              </p>

              <form
                action={(fd) => {
                  startOAuth(() => startClientShopifyOAuthAction(clientId, fd));
                }}
                className="flex flex-col gap-4 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <label
                    htmlFor="shopDomain"
                    className="mb-1.5 block text-xs font-medium text-slate-400"
                  >
                    Shop domain
                  </label>
                  <input
                    id="shopDomain"
                    name="shopDomain"
                    type="text"
                    placeholder="your-store.myshopify.com"
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    disabled={oauthPending}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                      text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none
                      disabled:opacity-50"
                  />
                </div>
                <ActionButton
                  type="submit"
                  variant="primary"
                  disabled={oauthPending || !shopInput.trim()}
                >
                  {oauthPending ? "Redirecting…" : "Connect Shopify"}
                </ActionButton>
              </form>

              <p className="mt-3 text-xs text-slate-500">
                Only{" "}
                <strong className="font-medium text-slate-400">read_orders</strong> and{" "}
                <strong className="font-medium text-slate-400">read_customers</strong>{" "}
                scopes are requested. No write access is granted.
              </p>
            </>
          ) : (
            <>
              <p className="mb-5 text-sm text-slate-400">
                Enter your client&apos;s Shopify store domain and a{" "}
                <strong className="font-medium text-slate-300">private-app access token</strong>{" "}
                to connect without OAuth. You can create a token in your Shopify admin under{" "}
                <em>Apps → Develop apps</em>.
              </p>

              {manualError && (
                <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                  {manualError}
                </div>
              )}

              <form
                action={async (fd) => {
                  setManualError(null);
                  startManual(async () => {
                    const result = await connectShopifyManuallyAction(clientId, fd);
                    if (result?.error) setManualError(result.error);
                  });
                }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label
                      htmlFor="shopDomain"
                      className="mb-1.5 block text-xs font-medium text-slate-400"
                    >
                      Shop domain
                    </label>
                    <input
                      id="shopDomain"
                      name="shopDomain"
                      type="text"
                      placeholder="your-store.myshopify.com"
                      value={shopInput}
                      onChange={(e) => setShopInput(e.target.value)}
                      disabled={manualPending}
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                        text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none
                        disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="accessToken"
                    className="mb-1.5 block text-xs font-medium text-slate-400"
                  >
                    Admin API access token
                  </label>
                  <input
                    id="accessToken"
                    name="accessToken"
                    type="password"
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={manualPending}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                      text-slate-100 placeholder-slate-500 focus:border-emerald-600 focus:outline-none
                      disabled:opacity-50"
                  />
                </div>
                <div>
                  <ActionButton
                    type="submit"
                    variant="primary"
                    disabled={manualPending || !shopInput.trim() || !tokenInput.trim()}
                  >
                    {manualPending ? "Connecting…" : "Connect Shopify"}
                  </ActionButton>
                </div>
              </form>

              <p className="mt-3 text-xs text-slate-500">
                The token needs <strong className="font-medium text-slate-400">read_orders</strong> and{" "}
                <strong className="font-medium text-slate-400">read_customers</strong> scopes.
                No write access is used.
              </p>
            </>
          )}

          <p className="mt-2 text-xs text-slate-500">
            Already connected a store?{" "}
            <Link
              href={`/clients/${clientId}`}
              className="text-slate-400 underline hover:text-slate-200"
            >
              Assign it from the client integrations tab.
            </Link>
          </p>
        </SectionCard>
      )}

      {/* Recent orders preview */}
      {recentOrders.length > 0 && (
        <SectionCard
          title="Recent Orders"
          description="Last 20 orders synced from this client's Shopify store."
        >
          {/* Mobile: cards */}
          <div className="space-y-3 sm:hidden">
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{o.orderNumber}</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    {fmt(o.totalPrice, o.currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(o.orderCreatedAt).toLocaleDateString()} ·{" "}
                  {o.lineItemCount} item{o.lineItemCount !== 1 ? "s" : ""}
                </p>
                {(o.utmCampaign || o.utmSource) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {[o.utmSource, o.utmMedium, o.utmCampaign]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <th className="py-2 text-left">Order</th>
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Items</th>
                  <th className="py-2 text-left">UTM Source</th>
                  <th className="py-2 text-left">UTM Campaign</th>
                  <th className="py-2 text-left">UTM Content</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="text-slate-300 hover:bg-slate-800/40">
                    <td className="py-2 font-medium text-slate-100">{o.orderNumber}</td>
                    <td className="py-2 text-slate-400">
                      {new Date(o.orderCreatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right font-semibold text-emerald-400">
                      {fmt(o.totalPrice, o.currency)}
                    </td>
                    <td className="py-2 text-right text-slate-400">{o.lineItemCount}</td>
                    <td className="py-2 text-slate-400">
                      {o.utmSource ?? <span className="text-slate-700">—</span>}
                    </td>
                    <td className="py-2 text-slate-400 max-w-[160px] truncate">
                      {o.utmCampaign ?? <span className="text-slate-700">—</span>}
                    </td>
                    <td className="py-2 text-slate-400 max-w-[140px] truncate">
                      {o.utmContent ?? <span className="text-slate-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Empty state after sync */}
      {connection && !lastResult && orderCount === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/20 px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            No orders synced yet. Click{" "}
            <strong className="text-slate-400">Run Order Sync</strong> above to fetch
            the last 30 days of orders from {connection.shopDomain}.
          </p>
        </div>
      )}
    </div>
  );
}
