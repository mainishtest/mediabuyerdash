"use client";

// app/clients/[clientId]/ClientIntegrationsSection.tsx
// Integration mapping UI for the client detail page.
// Shows Meta and Shopify connection status, mapped accounts, and assignment controls.

import { useTransition } from "react";
import Link from "next/link";
import { SectionCard }  from "../../../components/ui/SectionCard";
import { Badge }        from "../../../components/ui/Badge";
import { ActionButton } from "../../../components/ui/ActionButton";
import { EmptyState }   from "../../../components/ui/EmptyState";
import type { BadgeVariant } from "../../../components/ui/Badge";
import type {
  ClientIntegrationStatus,
  MappedMetaAccount,
  AvailableMetaAccount,
  ShopifyConnectionSummary,
  IntegrationState,
} from "../../../lib/clientIntegrations";
import {
  assignMetaAccountToClientAction,
  unmapMetaAccountFromClientAction,
  assignShopifyConnectionToClientAction,
  unmapShopifyFromClientAction,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:     string;
  integrations: ClientIntegrationStatus;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function stateVariant(state: IntegrationState): BadgeVariant {
  if (state === "mapped")         return "success";
  if (state === "available")      return "warning";
  return "neutral";
}

function stateLabel(state: IntegrationState): string {
  if (state === "mapped")    return "Mapped";
  if (state === "available") return "Not Mapped";
  return "Not Connected";
}

// ── Client Readiness Strip ────────────────────────────────────────────────────

function ReadinessStrip({
  metaState,
  shopifyState,
  readyForSync,
}: Pick<ClientIntegrationStatus, "metaState" | "shopifyState" | "readyForSync">) {
  const items = [
    {
      label: "Meta Account",
      done:  metaState === "mapped",
      hint:  metaState === "mapped" ? "Account mapped" : "Not mapped yet",
    },
    {
      label: "Shopify Store",
      done:  shopifyState === "mapped",
      hint:  shopifyState === "mapped" ? "Store mapped" : "Not mapped yet",
    },
    {
      label: "Ready for Sync",
      done:  readyForSync,
      hint:  readyForSync ? "All sources mapped" : "Map Meta + Shopify first",
    },
  ];

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Client Readiness
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
              <p
                className={`text-sm font-medium ${
                  item.done ? "text-slate-200" : "text-slate-500"
                }`}
              >
                {item.label}
              </p>
              <p className="text-xs text-slate-600">{item.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {readyForSync && (
        <div className="mt-4 flex items-center gap-2.5">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-emerald-400 font-medium">
            Ready for first sync
          </span>
          <span className="ml-auto text-xs text-slate-500">
            Go to Integrations to run a sync.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Mapped Meta Account row ───────────────────────────────────────────────────

function MappedMetaRow({
  account,
  clientId,
}: {
  account:  MappedMetaAccount;
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(() =>
      unmapMetaAccountFromClientAction(clientId, account.selectedAccountId)
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-800/40 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {account.accountName}
        </p>
        <p className="text-xs text-slate-500 font-mono">
          {account.externalAdAccountId}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="neutral">{account.currency}</Badge>
        <Badge variant="success">Mapped</Badge>
        <ActionButton
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleRemove}
        >
          {isPending ? "Removing…" : "Remove"}
        </ActionButton>
      </div>
    </div>
  );
}

// ── Available Meta Account row ────────────────────────────────────────────────

function AvailableMetaRow({
  account,
  clientId,
}: {
  account:  AvailableMetaAccount;
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isMappedElsewhere = account.mappedToClientId !== null;

  function handleAdd() {
    if (isMappedElsewhere) return;
    startTransition(() =>
      assignMetaAccountToClientAction(clientId, account.selectedAccountId)
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg px-4 py-3 sm:flex-row sm:items-center sm:gap-3 ${
        isMappedElsewhere ? "opacity-50" : "bg-slate-800/20"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-300 truncate">
          {account.accountName}
        </p>
        <p className="text-xs text-slate-500 font-mono">
          {account.externalAdAccountId}
        </p>
        {isMappedElsewhere && account.mappedToClientName && (
          <p className="mt-0.5 text-xs text-slate-600">
            Mapped to: {account.mappedToClientName}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="neutral">{account.currency}</Badge>
        {isMappedElsewhere ? (
          <Badge variant="warning">Mapped Elsewhere</Badge>
        ) : (
          <ActionButton
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={handleAdd}
          >
            {isPending ? "Adding…" : "Add"}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ── Meta Integration Card ─────────────────────────────────────────────────────

function MetaIntegrationCard({
  clientId,
  metaState,
  mappedMetaAccounts,
  availableMetaAccounts,
}: {
  clientId:              string;
  metaState:             IntegrationState;
  mappedMetaAccounts:    MappedMetaAccount[];
  availableMetaAccounts: AvailableMetaAccount[];
}) {
  const hasMapped    = mappedMetaAccounts.length > 0;
  const hasAvailable = availableMetaAccounts.filter(
    (a) => a.mappedToClientId === null
  ).length > 0;

  return (
    <SectionCard
      title="Meta Ad Accounts"
      description="Assign selected Meta ad accounts to this client for scoped reporting and optimization."
      actions={<Badge variant={stateVariant(metaState)}>{stateLabel(metaState)}</Badge>}
    >
      {metaState === "not_connected" ? (
        <EmptyState
          title="No Meta connection in workspace"
          description="Connect a Meta account from the Integrations page, then select ad accounts to make them available here."
          icon="□"
          action={
            <Link
              href="/integrations/meta"
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200
                transition-colors hover:bg-slate-600"
            >
              Go to Meta Integration →
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* Mapped accounts */}
          {hasMapped && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Mapped to this client
              </p>
              <div className="space-y-2">
                {mappedMetaAccounts.map((a) => (
                  <MappedMetaRow
                    key={a.selectedAccountId}
                    account={a}
                    clientId={clientId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available accounts */}
          {availableMetaAccounts.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {hasMapped ? "Add more accounts" : "Available in workspace"}
              </p>
              <div className="space-y-2">
                {availableMetaAccounts.map((a) => (
                  <AvailableMetaRow
                    key={a.selectedAccountId}
                    account={a}
                    clientId={clientId}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasMapped && !hasAvailable && (
            <EmptyState
              title="No accounts available to map"
              description="All selected accounts in this workspace are assigned to other clients."
              icon="□"
              action={
                <Link
                  href="/integrations/meta"
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Manage Meta accounts →
                </Link>
              }
            />
          )}

          {!hasMapped && hasAvailable && (
            <p className="text-xs text-slate-500">
              Select ad accounts above to map them to this client.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Shopify Connection row ────────────────────────────────────────────────────

function ShopifyConnectionRow({
  connection,
  clientId,
  isMapped,
}: {
  connection: ShopifyConnectionSummary;
  clientId:   string;
  isMapped:   boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isMappedElsewhere =
    !isMapped &&
    connection.mappedToClientId !== null;

  function handleAssign() {
    if (isMappedElsewhere) return;
    startTransition(() =>
      assignShopifyConnectionToClientAction(clientId, connection.id)
    );
  }

  function handleUnmap() {
    startTransition(() =>
      unmapShopifyFromClientAction(clientId, connection.id)
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg px-4 py-3 sm:flex-row sm:items-center sm:gap-3 ${
        isMapped
          ? "bg-emerald-950/20 border border-emerald-900/40"
          : isMappedElsewhere
          ? "opacity-50 bg-slate-800/20"
          : "bg-slate-800/20"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {connection.shopDomain}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Connected{" "}
          {new Date(connection.installedAt).toLocaleDateString("en-US", {
            month: "short",
            day:   "numeric",
            year:  "numeric",
          })}
        </p>
        {isMappedElsewhere && connection.mappedToClientName && (
          <p className="mt-0.5 text-xs text-slate-600">
            Mapped to: {connection.mappedToClientName}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant={
            connection.connectionStatus === "active" ? "success" : "warning"
          }
        >
          {connection.connectionStatus}
        </Badge>
        {isMapped ? (
          <ActionButton
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleUnmap}
          >
            {isPending ? "Removing…" : "Unmap"}
          </ActionButton>
        ) : isMappedElsewhere ? (
          <Badge variant="warning">Mapped Elsewhere</Badge>
        ) : (
          <ActionButton
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={handleAssign}
          >
            {isPending ? "Assigning…" : "Assign"}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ── Shopify Integration Card ──────────────────────────────────────────────────

function ShopifyIntegrationCard({
  clientId,
  shopifyState,
  mappedShopifyConnection,
  availableShopifyConnections,
}: {
  clientId:                    string;
  shopifyState:                IntegrationState;
  mappedShopifyConnection:     ShopifyConnectionSummary | null;
  availableShopifyConnections: ShopifyConnectionSummary[];
}) {
  return (
    <SectionCard
      title="Shopify Store"
      description="Assign a Shopify store to this client. Orders from this store will be used as the CRM source of truth for ROAS and CPA."
      actions={
        <Badge variant={stateVariant(shopifyState)}>
          {stateLabel(shopifyState)}
        </Badge>
      }
    >
      {shopifyState === "not_connected" ? (
        <EmptyState
          title="No Shopify store in workspace"
          description="Connect a Shopify store from the Integrations page to make it available for client mapping."
          icon="□"
          action={
            <Link
              href="/integrations/shopify"
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200
                transition-colors hover:bg-slate-600"
            >
              Go to Shopify Integration →
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* Mapped store */}
          {mappedShopifyConnection && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Mapped to this client
              </p>
              <ShopifyConnectionRow
                connection={mappedShopifyConnection}
                clientId={clientId}
                isMapped
              />
            </div>
          )}

          {/* Available stores */}
          {availableShopifyConnections.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {mappedShopifyConnection ? "Other stores in workspace" : "Available in workspace"}
              </p>
              <div className="space-y-2">
                {availableShopifyConnections.map((c) => (
                  <ShopifyConnectionRow
                    key={c.id}
                    connection={c}
                    clientId={clientId}
                    isMapped={false}
                  />
                ))}
              </div>
            </div>
          )}

          {!mappedShopifyConnection && availableShopifyConnections.length === 0 && (
            <EmptyState
              title="No stores available to map"
              description="All Shopify stores in this workspace are assigned to other clients."
              icon="□"
              action={
                <Link
                  href="/integrations/shopify"
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Manage Shopify connections →
                </Link>
              }
            />
          )}

          {!mappedShopifyConnection && availableShopifyConnections.length > 0 && (
            <p className="text-xs text-slate-500">
              Assign a store above. Each client supports one Shopify store for CRM reconciliation.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ClientIntegrationsSection({ clientId, integrations }: Props) {
  return (
    <section className="mb-10">
      <h2 className="mb-1 text-lg font-semibold text-slate-50">
        Client Integrations
      </h2>
      <p className="mb-5 text-sm text-slate-400">
        Map data sources to this client. Meta ad accounts provide delivery metrics.
        Shopify provides order revenue — the source of truth for ROAS and CPA.
      </p>

      <ReadinessStrip
        metaState={integrations.metaState}
        shopifyState={integrations.shopifyState}
        readyForSync={integrations.readyForSync}
      />

      <div className="space-y-5">
        <MetaIntegrationCard
          clientId={clientId}
          metaState={integrations.metaState}
          mappedMetaAccounts={integrations.mappedMetaAccounts}
          availableMetaAccounts={integrations.availableMetaAccounts}
        />
        <ShopifyIntegrationCard
          clientId={clientId}
          shopifyState={integrations.shopifyState}
          mappedShopifyConnection={integrations.mappedShopifyConnection}
          availableShopifyConnections={integrations.availableShopifyConnections}
        />
      </div>
    </section>
  );
}
