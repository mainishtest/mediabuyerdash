"use client";

import { useState, useTransition } from "react";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { StatCard }     from "../../../../components/ui/StatCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { runShopifySyncAction } from "./actions";
import type { ShopifySyncSummary } from "../../../../lib/shopify/sync";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Connection {
  id:               string;
  shopDomain:       string;
  connectionStatus: string;
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
  id:            string;
  orderNumber:   string;
  orderCreatedAt: Date;
  currency:      string;
  totalPrice:    number;
  customerEmail: string | null;
  utmSource:     string | null;
  utmCampaign:   string | null;
  landingPage:   string | null;
}

interface LineItem {
  id:            string;
  title:         string;
  sku:           string | null;
  quantity:      number;
  price:         number;
  order: { orderNumber: string };
}

interface Props {
  connection:      Connection | null;
  syncLog:         SyncLog | null;
  orderCount:      number;
  lineItemCount:   number;
  recentOrders:    Order[];
  recentLineItems: LineItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "partial")   return "warning";
  if (status === "failed")    return "danger";
  return "neutral";
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShopifySyncView({
  connection,
  syncLog,
  orderCount,
  lineItemCount,
  recentOrders,
  recentLineItems,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult]  = useState<ShopifySyncSummary | null>(null);

  function handleSync() {
    if (!connection) return;
    startTransition(async () => {
      const result = await runShopifySyncAction(connection.id);
      setLastResult(result);
    });
  }

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
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      <PageHeader
        title="Shopify Order Sync"
        description="Read-only sync of Shopify order revenue, line items, and UTM attribution for the last 30 days."
        badge={
          connection
            ? <Badge variant="success">Connected</Badge>
            : <Badge variant="neutral">Not Connected</Badge>
        }
      />

      {/* No connection state */}
      {!connection && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">
            No Shopify store connected.{" "}
            <a
              href="/integrations/shopify"
              className="font-medium text-emerald-400 hover:underline"
            >
              Connect a store →
            </a>
          </p>
        </div>
      )}

      {connection && (
        <>
          {/* Stats strip */}
          <section className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Connected Store"  value={connection.shopDomain} />
            <StatCard label="Orders Synced"    value={orderCount.toLocaleString()} />
            <StatCard label="Line Items"        value={lineItemCount.toLocaleString()} />
            <StatCard
              label="Last Sync"
              value={
                activeSyncLog?.completedAt
                  ? new Date(activeSyncLog.completedAt).toLocaleDateString()
                  : "Never"
              }
            />
          </section>

          {/* Sync control */}
          <SectionCard
            title="Sync Control"
            description="Fetches orders created in the last 30 days. Existing records are updated; new ones are created."
          >
            <div className="flex items-center gap-4">
              <ActionButton
                variant="primary"
                onClick={handleSync}
                disabled={isPending}
              >
                {isPending ? "Syncing…" : "Run Order Sync"}
              </ActionButton>
              <span className="text-xs text-slate-500">
                Last 30 days · read-only · no changes made to your Shopify store
              </span>
            </div>

            {/* Live result banner */}
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
                {lastResult.ordersSynced} orders, {lastResult.lineItemsSynced} line items synced.
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
          </SectionCard>

          {/* Last sync log from DB */}
          {activeSyncLog && !lastResult && (
            <SectionCard title="Last Sync Summary">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Badge variant={statusVariant(activeSyncLog.status)}>
                  {activeSyncLog.status}
                </Badge>
                <span className="text-slate-300">
                  {activeSyncLog.ordersSynced} orders · {activeSyncLog.lineItemsSynced} line items
                </span>
                {activeSyncLog.completedAt && (
                  <span className="ml-auto text-slate-500">
                    {new Date(activeSyncLog.completedAt).toLocaleString()}
                  </span>
                )}
              </div>
              {activeSyncLog.errorMessages && (
                <div className="mt-3 rounded border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-400">
                  {(JSON.parse(activeSyncLog.errorMessages) as string[]).slice(0, 5).join("\n")}
                </div>
              )}
            </SectionCard>
          )}

          {/* Recent orders table */}
          <SectionCard
            title="Recent Orders"
            description="Up to 20 most-recent orders from the last sync."
          >
            {recentOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No orders synced yet. Run a sync to populate this table.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      <th className="py-2 text-left">Order</th>
                      <th className="py-2 text-left">Date</th>
                      <th className="py-2 text-right">Revenue</th>
                      <th className="py-2 text-left">Email</th>
                      <th className="py-2 text-left">UTM Source</th>
                      <th className="py-2 text-left">UTM Campaign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="text-slate-300 hover:bg-slate-800/40"
                      >
                        <td className="py-2 font-medium text-slate-100">
                          {order.orderNumber}
                        </td>
                        <td className="py-2 text-slate-400">
                          {new Date(order.orderCreatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right font-medium text-emerald-400">
                          {formatCurrency(order.totalPrice, order.currency)}
                        </td>
                        <td className="py-2 text-slate-400 text-xs">
                          {order.customerEmail ?? <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-2 text-slate-400">
                          {order.utmSource ?? <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-2 text-slate-400">
                          {order.utmCampaign ?? <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Line items preview */}
          <SectionCard
            title="Recent Line Items"
            description="Up to 20 most-recent line items from the last sync."
          >
            {recentLineItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No line items synced yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      <th className="py-2 text-left">Order</th>
                      <th className="py-2 text-left">Product</th>
                      <th className="py-2 text-left">SKU</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {recentLineItems.map((item) => (
                      <tr
                        key={item.id}
                        className="text-slate-300 hover:bg-slate-800/40"
                      >
                        <td className="py-2 text-slate-400 text-xs">
                          {item.order.orderNumber}
                        </td>
                        <td className="py-2 text-slate-100">{item.title}</td>
                        <td className="py-2 text-slate-400 font-mono text-xs">
                          {item.sku ?? <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-2 text-right text-slate-300">{item.quantity}</td>
                        <td className="py-2 text-right font-medium text-slate-200">
                          {formatCurrency(item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
