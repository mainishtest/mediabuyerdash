"use client";

// app/clients/ClientsView.tsx
// Client list page view. Handles state for the Create Client modal.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  SectionCard,
  Badge,
  EmptyState,
} from "../../components/ui";
import { createClientAction } from "./actions";

// ---------------------------------------------------------------------------
// Serialized client type (Dates converted to strings for the client boundary)
// ---------------------------------------------------------------------------

export type SerializedClient = {
  id:        string;
  name:      string;
  brandName: string | null;
  status:    string;
  notes:     string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info" | "purple";

function statusVariant(status: string): BadgeVariant {
  if (status === "active")   return "success";
  if (status === "paused")   return "warning";
  if (status === "archived") return "neutral";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Create Client Modal
// ---------------------------------------------------------------------------

type ModalProps = {
  onClose:   () => void;
  onSuccess: () => void;
};

function CreateClientModal({ onClose, onSuccess }: ModalProps) {
  const [name,      setName]      = useState("");
  const [brandName, setBrandName] = useState("");
  const [status,    setStatus]    = useState("active");
  const [notes,     setNotes]     = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Client name is required."); return; }

    startTransition(async () => {
      try {
        await createClientAction({ name, brandName: brandName || undefined, status, notes: notes || undefined });
        onSuccess();
      } catch {
        setError("Failed to create client. Please try again.");
      }
    });
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog */}
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Add Client</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Create a new client in your workspace
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Client name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Client Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Brand name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Brand Name <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Acme — fitness brand"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 focus:border-emerald-600 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Notes <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this client…"
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400
                hover:border-slate-600 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client card
// ---------------------------------------------------------------------------

function ClientCard({ client }: { client: SerializedClient }) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="group flex flex-col rounded-xl border border-slate-800 bg-slate-800/30 p-5
        transition-colors hover:border-slate-600 hover:bg-slate-800/60"
    >
      {/* Name row */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-100 group-hover:text-white">
          {client.name}
        </h3>
        <Badge variant={statusVariant(client.status)}>
          {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
        </Badge>
      </div>

      {/* Brand name */}
      {client.brandName && (
        <p className="mb-1 text-sm text-slate-400">{client.brandName}</p>
      )}

      {/* Notes preview */}
      {client.notes && (
        <p className="mb-3 line-clamp-2 text-xs text-slate-500">{client.notes}</p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="text-xs text-slate-600">Added {client.createdAt}</span>
        <span className="text-xs font-medium text-emerald-400 group-hover:text-emerald-300">
          Open →
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

type Props = {
  clients:     SerializedClient[];
  workspaceId: string | null;
};

export function ClientsView({ clients, workspaceId }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  function handleSuccess() {
    setModalOpen(false);
    router.refresh();
  }

  const noWorkspace = !workspaceId;

  return (
    <div className="space-y-0">
      <PageHeader
        title="Clients"
        description="Manage client accounts in your workspace. Each client has its own Meta connections, Shopify integration, and campaign data."
        badge={
          <Badge variant="neutral">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </Badge>
        }
        actions={
          !noWorkspace && (
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                transition-colors hover:bg-emerald-500"
            >
              + Add Client
            </button>
          )
        }
      />

      {/* No workspace */}
      {noWorkspace && (
        <SectionCard>
          <EmptyState
            icon="◎"
            title="No workspace found"
            description="Sign out and sign back in to set up your workspace automatically."
          />
        </SectionCard>
      )}

      {/* No clients yet */}
      {!noWorkspace && clients.length === 0 && (
        <SectionCard>
          <EmptyState
            icon="○"
            title="No clients yet"
            description="Add your first client to start managing campaigns and performance data."
            action={
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                  transition-colors hover:bg-emerald-500"
              >
                + Add your first client
              </button>
            }
          />
        </SectionCard>
      )}

      {/* Client grid */}
      {clients.length > 0 && (
        <SectionCard
          title="All Clients"
          description="Click a client to view their workspace, connections, and performance."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Create client modal */}
      {modalOpen && (
        <CreateClientModal
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
