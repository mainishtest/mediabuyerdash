"use client";

// EntryDetailDrawer — Side panel showing full details for a selected timeline entry.
// Shows what happened, who did it, what entity, what status, linked outcome,
// and contextual action buttons.

import Link from "next/link";
import type { ActionHistoryEntry } from "../../../types/actionHistory";

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    success: "Success", failed: "Failed", blocked: "Blocked",
    pending: "Pending", in_progress: "In Progress", skipped: "Skipped",
  };
  return map[s] ?? s;
}

function statusColor(s: string): string {
  switch (s) {
    case "success":  return "text-emerald-400 bg-emerald-500/10";
    case "failed":   return "text-rose-400 bg-rose-500/10";
    case "blocked":  return "text-rose-400 bg-rose-500/10";
    case "pending":  return "text-amber-400 bg-amber-500/10";
    default:         return "text-slate-400 bg-slate-700/50";
  }
}

function actorIcon(type: string): string {
  switch (type) {
    case "operator": return "O";
    case "cron":     return "C";
    case "api":      return "A";
    default:         return "S";
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

// ── Action buttons — contextual based on entry data ─────────────────────────

type ActionBtn = { label: string; href: string };

function buildActionButtons(entry: ActionHistoryEntry): ActionBtn[] {
  const btns: ActionBtn[] = [];

  // Always link to the entity
  if (entry.entity.href && entry.entity.href !== "/automation/history") {
    btns.push({ label: `Open ${entry.entity.entityType}`, href: entry.entity.href });
  }

  // Client link
  if (entry.clientId) {
    btns.push({ label: "Open account", href: `/clients/${entry.clientId}/decision` });
  }

  // Outcome link
  if (entry.outcomeLink) {
    btns.push({ label: "View linked outcome", href: entry.outcomeLink.href });
  }

  // Source-specific buttons
  if (entry.source === "automation_audit" || entry.source === "proposed_action" || entry.source === "execution_log") {
    btns.push({ label: "Open audit log", href: "/automation/history" });
  }
  if (entry.source === "creative_lab") {
    btns.push({ label: "Open Creative Lab", href: "/creative-lab" });
  }
  if (entry.eventType === "scale_plan_created" || entry.eventType === "scale_executed") {
    btns.push({ label: "Open scale review", href: "/optimization" });
  }
  if (entry.eventType === "test_launched" || entry.eventType === "test_created") {
    btns.push({ label: "Open experiments", href: "/creative-lab/results" });
  }
  if (entry.eventType === "approval_requested" || entry.eventType === "approval_granted" || entry.eventType === "approval_rejected") {
    btns.push({ label: "Open approvals", href: "/command-center" });
  }

  // Deduplicate by href
  const seen = new Set<string>();
  return btns.filter((b) => {
    if (seen.has(b.href)) return false;
    seen.add(b.href);
    return true;
  });
}

// ── Detail field ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function EntryDetailDrawer({
  entry,
  onClose,
}: {
  entry:   ActionHistoryEntry;
  onClose: () => void;
}) {
  const actions = buildActionButtons(entry);
  const meta = entry.metadata ?? {};

  return (
    <div className="sticky top-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      {/* Close button */}
      <div className="mb-4 flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Entry Detail</p>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-300"
          aria-label="Close detail"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="mb-4">
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(entry.status)}`}>
          {statusLabel(entry.status)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white">{entry.title}</h3>
      <p className="mt-1 text-xs text-slate-400">{entry.description}</p>

      {/* Fields */}
      <div className="mt-4 space-y-3">
        <Field label="When">
          <p className="text-xs text-slate-300">{formatTimestamp(entry.occurredAt)}</p>
        </Field>

        <Field label="Actor">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[10px] font-bold text-slate-400">
              {actorIcon(entry.actor.type)}
            </span>
            <span className="text-xs text-slate-300">{entry.actor.label}</span>
            <span className="text-[10px] text-slate-600">({entry.actor.type})</span>
          </div>
        </Field>

        <Field label="Entity">
          <Link href={entry.entity.href} className="text-xs text-slate-300 underline decoration-slate-700 hover:text-white">
            {entry.entity.entityName}
          </Link>
          <span className="ml-1.5 text-[10px] text-slate-600">({entry.entity.entityType})</span>
        </Field>

        {entry.clientName && (
          <Field label="Client">
            <Link
              href={entry.clientId ? `/clients/${entry.clientId}/decision` : "#"}
              className="text-xs text-slate-300 underline decoration-slate-700 hover:text-white"
            >
              {entry.clientName}
            </Link>
          </Field>
        )}

        {entry.outcomeLink && (
          <Field label="Linked Outcome">
            <Link href={entry.outcomeLink.href} className="flex items-center gap-1.5">
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
                {entry.outcomeLink.outcomeType.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-slate-300">{entry.outcomeLink.label}</span>
            </Link>
          </Field>
        )}

        <Field label="Source">
          <p className="text-xs text-slate-400">{entry.source.replace(/_/g, " ")}</p>
        </Field>

        {/* Metadata — show key fields */}
        {Object.keys(meta).length > 0 && (
          <Field label="Details">
            <div className="space-y-0.5">
              {Object.entries(meta)
                .filter(([, v]) => v != null && v !== "")
                .slice(0, 6)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-600">{k.replace(/([A-Z])/g, " $1").toLowerCase()}:</span>
                    <span className="text-slate-400">{String(v)}</span>
                  </div>
                ))}
            </div>
          </Field>
        )}
      </div>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="mt-5 space-y-1.5 border-t border-slate-800 pt-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-600">Actions</p>
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40
                         px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            >
              <span>{a.label}</span>
              <svg className="h-3.5 w-3.5 text-slate-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
