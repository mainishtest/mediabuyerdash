"use client";

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";
import Link                        from "next/link";
import {
  PageHeader,
  PageContainer,
  SectionCard,
  Badge,
  EmptyState,
} from "../../components/ui";
import {
  updateClientAction,
  deleteClientAction,
  disconnectMetaConnectionAction,
  disconnectShopifyConnectionAction,
} from "../clients/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info" | "purple";

type ClientRow = {
  id:        string;
  name:      string;
  brandName: string | null;
  platform:  string;
  currency:  string;
  timezone:  string;
  status:    string;
  notes:     string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    campaigns:               number;
    utmPerformanceRows:      number;
    reconciliationSummaries: number;
    alertEvents:             number;
    metaSelectedAccounts:    number;
    shopifyConnections:      number;
  };
};

type MetaConn = {
  id:               string;
  userDisplayName:  string | null;
  connectionStatus: string;
  tokenExpiresAt:   string | null;
  createdAt:        string;
  selectedAccounts: Array<{
    id:              string;
    clientAccountId: string | null;
    accessibleAdAccount: {
      externalAdAccountId: string;
      accountName:         string | null;
    } | null;
  }>;
};

type ShopifyConn = {
  id:               string;
  shopDomain:       string;
  connectionStatus: string;
  clientAccountId:  string | null;
  installedAt:      string;
};

type Props = {
  clients:            ClientRow[];
  metaConnections:    MetaConn[];
  shopifyConnections: ShopifyConn[];
  workspaceId:        string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(status: string): BadgeVariant {
  if (status === "active")   return "success";
  if (status === "paused")   return "warning";
  if (status === "archived") return "neutral";
  return "neutral";
}

const TH = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500";
const TD = "px-4 py-3 text-sm text-slate-300";

// ---------------------------------------------------------------------------
// Edit Client Modal
// ---------------------------------------------------------------------------

function EditClientModal({
  client,
  onClose,
  onSuccess,
}: {
  client:    ClientRow;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [name,      setName]      = useState(client.name);
  const [brandName, setBrandName] = useState(client.brandName ?? "");
  const [status,    setStatus]    = useState(client.status);
  const [notes,     setNotes]     = useState(client.notes ?? "");
  const [currency,  setCurrency]  = useState(client.currency);
  const [timezone,  setTimezone]  = useState(client.timezone);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Client name is required."); return; }

    startTransition(async () => {
      try {
        await updateClientAction({
          clientId: client.id,
          name,
          brandName: brandName || null,
          status,
          notes: notes || null,
          currency,
          timezone,
        });
        onSuccess();
      } catch {
        setError("Failed to update client.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Client</h2>
            <p className="mt-0.5 text-xs text-slate-500">{client.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Client Name <span className="text-rose-400">*</span></label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-600 focus:outline-none" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Brand Name</label>
            <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Optional"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-600 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-600 focus:outline-none">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-600 focus:outline-none">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-600 focus:outline-none">
              <option value="America/New_York">Eastern (New York)</option>
              <option value="America/Chicago">Central (Chicago)</option>
              <option value="America/Denver">Mountain (Denver)</option>
              <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Berlin">Berlin</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Australia/Sydney">Sydney</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes..."
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-600 focus:outline-none" />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirm Modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  clientName,
  onConfirm,
  onClose,
}: {
  clientName: string;
  onConfirm:  () => void;
  onClose:    () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText === clientName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-rose-800/50 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-semibold text-rose-400">Delete Client</h2>
          <p className="mt-1 text-sm text-slate-400">
            This will permanently delete <strong className="text-white">{clientName}</strong> and all associated data
            (campaigns, performance rows, reconciliation data, alerts, sync runs, etc.). This cannot be undone.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Type <strong className="text-slate-200">{clientName}</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={clientName}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-rose-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-200">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canDelete}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clients Section
// ---------------------------------------------------------------------------

function ClientsSection({
  clients,
  onRefresh,
}: {
  clients:   ClientRow[];
  onRefresh: () => void;
}) {
  const [editClient,   setEditClient]   = useState<ClientRow | null>(null);
  const [deleteClient,  setDeleteClient] = useState<ClientRow | null>(null);
  const [isPending, startTransition]     = useTransition();

  function handleDelete() {
    if (!deleteClient) return;
    startTransition(async () => {
      try {
        await deleteClientAction(deleteClient.id);
        setDeleteClient(null);
        onRefresh();
      } catch {
        // Keep modal open on error
      }
    });
  }

  return (
    <>
      <SectionCard
        title="Clients"
        description={`${clients.length} client${clients.length !== 1 ? "s" : ""} in workspace. Edit, archive, or remove clients.`}
        flush
      >
        {clients.length === 0 ? (
          <EmptyState icon="○" title="No clients" description="Add your first client from the Clients page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className={TH}>Client</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Currency</th>
                  <th className={TH}>Campaigns</th>
                  <th className={TH}>Meta</th>
                  <th className={TH}>Shopify</th>
                  <th className={TH}>Alerts</th>
                  <th className={TH}>Created</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {clients.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-slate-800/20">
                    <td className={TD}>
                      <Link href={`/clients/${c.id}`} className="font-medium text-white hover:text-emerald-400">
                        {c.name}
                      </Link>
                      {c.brandName && <p className="text-xs text-slate-500">{c.brandName}</p>}
                    </td>
                    <td className={TD}>
                      <Badge variant={statusVariant(c.status)}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </Badge>
                    </td>
                    <td className={`${TD} text-slate-400`}>{c.currency}</td>
                    <td className={`${TD} text-slate-400`}>{c._count.campaigns}</td>
                    <td className={TD}>
                      {c._count.metaSelectedAccounts > 0
                        ? <Badge variant="info">{c._count.metaSelectedAccounts} linked</Badge>
                        : <span className="text-slate-600">None</span>}
                    </td>
                    <td className={TD}>
                      {c._count.shopifyConnections > 0
                        ? <Badge variant="info">{c._count.shopifyConnections} linked</Badge>
                        : <span className="text-slate-600">None</span>}
                    </td>
                    <td className={TD}>
                      {c._count.alertEvents > 0
                        ? <Badge variant="warning">{c._count.alertEvents}</Badge>
                        : <span className="text-slate-600">0</span>}
                    </td>
                    <td className={`${TD} text-slate-500`}>{c.createdAt}</td>
                    <td className={`${TD} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditClient(c)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteClient(c)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-rose-400/70 hover:bg-rose-950/30 hover:text-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {editClient && (
        <EditClientModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onSuccess={() => { setEditClient(null); onRefresh(); }}
        />
      )}

      {deleteClient && (
        <DeleteConfirmModal
          clientName={deleteClient.name}
          onConfirm={handleDelete}
          onClose={() => setDeleteClient(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Connections Section
// ---------------------------------------------------------------------------

function ConnectionsSection({
  metaConnections,
  shopifyConnections,
  clients,
  onRefresh,
}: {
  metaConnections:    MetaConn[];
  shopifyConnections: ShopifyConn[];
  clients:            ClientRow[];
  onRefresh:          () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  function handleDisconnectMeta(id: string) {
    if (!confirm("Disconnect this Meta connection? Mapped ad accounts will be unlinked.")) return;
    startTransition(async () => {
      await disconnectMetaConnectionAction(id);
      onRefresh();
    });
  }

  function handleDisconnectShopify(id: string) {
    if (!confirm("Disconnect this Shopify store?")) return;
    startTransition(async () => {
      await disconnectShopifyConnectionAction(id);
      onRefresh();
    });
  }

  return (
    <>
      {/* Meta */}
      <SectionCard
        title="Meta Connections"
        description="OAuth connections to Meta Ads accounts. Disconnect to remove access."
        flush
      >
        {metaConnections.length === 0 ? (
          <EmptyState icon="◎" title="No Meta connections" description="Connect Meta from a client's setup page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className={TH}>User</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Mapped Accounts</th>
                  <th className={TH}>Token Expires</th>
                  <th className={TH}>Connected</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {metaConnections.map((conn) => {
                  const isActive  = conn.connectionStatus === "active";
                  const isExpired = conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) < new Date();
                  const mapped    = conn.selectedAccounts.filter((a) => a.clientAccountId);
                  return (
                    <tr key={conn.id} className="transition-colors hover:bg-slate-800/20">
                      <td className={`${TD} font-medium text-white`}>{conn.userDisplayName || "Unknown"}</td>
                      <td className={TD}>
                        <Badge variant={isActive && !isExpired ? "success" : "danger"}>
                          {isExpired ? "Expired" : (isActive ? "Active" : conn.connectionStatus)}
                        </Badge>
                      </td>
                      <td className={TD}>
                        {mapped.length === 0
                          ? <span className="text-slate-600">None</span>
                          : (
                            <div className="space-y-0.5">
                              {mapped.map((a) => (
                                <div key={a.id} className="text-xs">
                                  <span className="text-slate-400">{a.accessibleAdAccount?.accountName ?? a.accessibleAdAccount?.externalAdAccountId}</span>
                                  {a.clientAccountId && (
                                    <span className="ml-1.5 text-slate-600">
                                      &rarr; {clientNameById.get(a.clientAccountId) ?? a.clientAccountId}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )
                        }
                      </td>
                      <td className={TD}>
                        {conn.tokenExpiresAt
                          ? new Date(conn.tokenExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className={`${TD} text-slate-500`}>{conn.createdAt}</td>
                      <td className={`${TD} text-right`}>
                        <button
                          onClick={() => handleDisconnectMeta(conn.id)}
                          disabled={isPending}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-rose-400/70 hover:bg-rose-950/30 hover:text-rose-300 disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Shopify */}
      <SectionCard
        title="Shopify Connections"
        description="Connected Shopify stores used as CRM source of truth."
        flush
      >
        {shopifyConnections.length === 0 ? (
          <EmptyState icon="◎" title="No Shopify connections" description="Connect Shopify from a client's setup page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className={TH}>Store</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Client</th>
                  <th className={TH}>Connected</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shopifyConnections.map((conn) => {
                  const isActive = conn.connectionStatus === "active";
                  return (
                    <tr key={conn.id} className="transition-colors hover:bg-slate-800/20">
                      <td className={`${TD} font-medium text-white`}>{conn.shopDomain}</td>
                      <td className={TD}>
                        <Badge variant={isActive ? "success" : "neutral"}>
                          {isActive ? "Active" : conn.connectionStatus}
                        </Badge>
                      </td>
                      <td className={TD}>
                        {conn.clientAccountId ? (
                          <Link href={`/clients/${conn.clientAccountId}`} className="text-indigo-400 hover:text-indigo-300 underline">
                            {clientNameById.get(conn.clientAccountId) ?? conn.clientAccountId}
                          </Link>
                        ) : (
                          <span className="text-slate-600">Unmapped</span>
                        )}
                      </td>
                      <td className={`${TD} text-slate-500`}>{conn.installedAt}</td>
                      <td className={`${TD} text-right`}>
                        <button
                          onClick={() => handleDisconnectShopify(conn.id)}
                          disabled={isPending}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-rose-400/70 hover:bg-rose-950/30 hover:text-rose-300 disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export function AdminView({ clients, metaConnections, shopifyConnections, workspaceId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"clients" | "connections">("clients");

  function handleRefresh() {
    router.refresh();
  }

  const tabs = [
    { key: "clients"     as const, label: "Clients",     count: clients.length },
    { key: "connections" as const, label: "Connections",  count: metaConnections.length + shopifyConnections.length },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Admin"
        description="Manage clients, connections, and workspace settings."
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-slate-500">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {tab === "clients" && (
          <ClientsSection clients={clients} onRefresh={handleRefresh} />
        )}
        {tab === "connections" && (
          <ConnectionsSection
            metaConnections={metaConnections}
            shopifyConnections={shopifyConnections}
            clients={clients}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </PageContainer>
  );
}
