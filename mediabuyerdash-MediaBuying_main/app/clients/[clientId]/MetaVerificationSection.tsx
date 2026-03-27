"use client";

// app/clients/[clientId]/MetaVerificationSection.tsx
// Always-visible user-facing Meta import verification section.
//
// Shows at a glance whether Meta data has been:
//   1. Connected     2. Selected     3. Mapped
//   4. Synced        5. Dashboard-visible
//
// Then surfaces import counts, detected issues, and one clear next action.
//
// Responsive:
//   Mobile  — everything stacks; next-action CTA is full-width and obvious
//   Desktop — checkpoint strip + counts side-by-side; issues in a list below

import Link from "next/link";
import type {
  ClientMetaValidation,
  ClientMetaImportIssue,
  IssueSeverity,
} from "../../../lib/meta/clientMetaValidation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month:  "short",
    day:    "numeric",
    hour:   "numeric",
    minute: "2-digit",
  });
}

function severityStyles(severity: IssueSeverity) {
  if (severity === "error")   return { border: "border-rose-800/50",   bg: "bg-rose-950/30",   text: "text-rose-400",   badge: "bg-rose-900/40 text-rose-300" };
  if (severity === "warning") return { border: "border-amber-800/50",  bg: "bg-amber-950/20",  text: "text-amber-400",  badge: "bg-amber-900/40 text-amber-300" };
  return                             { border: "border-slate-700",     bg: "bg-slate-800/20",  text: "text-slate-400",  badge: "bg-slate-700/60 text-slate-400" };
}

// ── Checkpoint strip ──────────────────────────────────────────────────────────

interface Checkpoint {
  label: string;
  done:  boolean;
  hint:  string;
}

function CheckpointStrip({ checkpoints }: { checkpoints: Checkpoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {checkpoints.map((cp, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${
            cp.done
              ? "border-emerald-800/40 bg-emerald-950/20"
              : "border-slate-800 bg-slate-900/30"
          }`}
        >
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              cp.done
                ? "bg-emerald-700 text-emerald-100"
                : "bg-slate-700 text-slate-400"
            }`}
          >
            {cp.done ? "✓" : i + 1}
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-medium leading-tight ${cp.done ? "text-slate-200" : "text-slate-500"}`}>
              {cp.label}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-600">{cp.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Counts grid ───────────────────────────────────────────────────────────────

function CountsGrid({ counts }: { counts: ClientMetaValidation["counts"] }) {
  const items = [
    { label: "Campaigns",    value: counts.campaignsCount },
    { label: "Ad Sets",      value: counts.adSetsCount },
    { label: "Ads",          value: counts.adsCount },
    { label: "Creatives",    value: counts.creativesCount },
    { label: "Insight Rows", value: counts.insightRowsCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-lg border px-3 py-2.5 ${
            item.value > 0
              ? "border-emerald-800/40 bg-emerald-950/20"
              : "border-slate-800 bg-slate-900/30"
          }`}
        >
          <p className="text-[11px] text-slate-500">{item.label}</p>
          <p className={`mt-0.5 text-lg font-semibold tabular-nums ${
            item.value > 0 ? "text-emerald-400" : "text-slate-600"
          }`}>
            {item.value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Issue row ─────────────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: ClientMetaImportIssue }) {
  const s = severityStyles(issue.severity);
  const isAnchor = issue.actionHref.startsWith("#");

  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} px-4 py-3`}>
      <div className="flex flex-wrap items-start gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.badge}`}>
          {issue.severity}
        </span>
        <p className={`text-sm font-medium ${s.text}`}>{issue.label}</p>
      </div>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed">{issue.description}</p>
      <div className="mt-2">
        {isAnchor ? (
          <a
            href={issue.actionHref}
            className="text-xs font-medium text-slate-400 underline hover:text-slate-200"
          >
            {issue.actionLabel} →
          </a>
        ) : (
          <Link
            href={issue.actionHref}
            className="text-xs font-medium text-slate-400 underline hover:text-slate-200"
          >
            {issue.actionLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Next best action banner ───────────────────────────────────────────────────

function NextActionBanner({ action }: { action: ClientMetaValidation["nextBestAction"] }) {
  if (!action) return null;

  const isAnchor = action.href.startsWith("#");

  return (
    <div className="rounded-xl border border-sky-800/50 bg-sky-950/20 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">
        Next Best Action
      </p>
      <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{action.description}</p>
      <div className="mt-3">
        {isAnchor ? (
          <a
            href={action.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-sm
              font-medium text-white transition-colors hover:bg-sky-600"
          >
            {action.label} →
          </a>
        ) : (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-sm
              font-medium text-white transition-colors hover:bg-sky-600"
          >
            {action.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Sync status badge ─────────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-500">Never synced</span>;
  const styles =
    status === "completed" ? "text-emerald-400" :
    status === "partial"   ? "text-amber-400" :
    status === "failed"    ? "text-rose-400" :
    "text-slate-400";
  return <span className={`capitalize font-medium ${styles}`}>{status}</span>;
}

// ── Main section ──────────────────────────────────────────────────────────────

interface Props {
  clientId:   string;
  validation: ClientMetaValidation;
}

export function MetaVerificationSection({ clientId, validation }: Props) {
  const { status, counts, issues, nextBestAction, isHealthy } = validation;

  const checkpoints: Checkpoint[] = [
    {
      label: "Meta Connected",
      done:  status.metaConnected,
      hint:  status.metaConnected ? "Workspace OAuth active" : "Connect at Integrations → Meta",
    },
    {
      label: "Accounts Selected",
      done:  status.selectedAccountsCount > 0,
      hint:  status.selectedAccountsCount > 0
        ? `${status.selectedAccountsCount} selected`
        : "Select ad accounts in Meta Integration",
    },
    {
      label: "Account Mapped",
      done:  status.mappedAccountsCount > 0,
      hint:  status.mappedAccountsCount > 0
        ? `${status.mappedAccountsCount} mapped to client`
        : "Assign an account to this client",
    },
    {
      label: "Sync Complete",
      done:  status.hasSuccessfulSync,
      hint:  status.hasSuccessfulSync
        ? `Last: ${fmtDate(status.lastSyncAt)}`
        : "Run a Meta sync",
    },
    {
      label: "Data Visible",
      done:  status.dataVisibleInDashboard,
      hint:  status.dataVisibleInDashboard
        ? `${counts.campaignsCount} campaigns available`
        : "Complete stages above first",
    },
  ];

  return (
    <section id="meta-verification" className="mb-10">
      {/* Section header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">
            Meta Data Verification
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">
            End-to-end pipeline status for this client&apos;s Meta import.
          </p>
        </div>

        {/* Overall health pill */}
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            isHealthy
              ? "bg-emerald-900/40 text-emerald-300"
              : issues.some((i) => i.severity === "error")
              ? "bg-rose-900/40 text-rose-300"
              : "bg-amber-900/40 text-amber-300"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {isHealthy
            ? "Pipeline healthy"
            : issues.some((i) => i.severity === "error")
            ? `${issues.filter((i) => i.severity === "error").length} error${issues.filter((i) => i.severity === "error").length !== 1 ? "s" : ""}`
            : `${issues.length} warning${issues.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Desktop: checkpoints + counts side-by-side ── */}
      {/* ── Mobile: stack vertically ── */}
      <div className="space-y-4">

        {/* Checkpoint strip (spans full width on all breakpoints) */}
        <CheckpointStrip checkpoints={checkpoints} />

        {/* Sync line */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-2.5 text-xs">
          <span className="text-slate-500">Last sync status:</span>
          <SyncStatusBadge status={status.lastSyncStatus} />
          {status.lastSyncAt && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">{fmtDate(status.lastSyncAt)}</span>
            </>
          )}
          <span className="ml-auto text-slate-600">
            {status.selectedAccountsCount} selected · {status.mappedAccountsCount} mapped to client
          </span>
        </div>

        {/* Import counts */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Imported Entity Counts (this client)
          </p>
          <CountsGrid counts={counts} />
        </div>

        {/* Issues */}
        {issues.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Issues Detected ({issues.length})
            </p>
            <div className="space-y-2">
              {issues.map((issue) => (
                <IssueRow key={issue.code} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {/* Healthy state */}
        {isHealthy && (
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
            All pipeline stages passing. Meta data is connected, synced, and visible in the dashboard.
          </div>
        )}

        {/* Next best action */}
        <NextActionBanner action={nextBestAction} />

        {/* Link to dedicated status page */}
        <div className="text-right">
          <Link
            href={`/clients/${clientId}/meta-status`}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Open full Meta status page →
          </Link>
        </div>
      </div>
    </section>
  );
}
