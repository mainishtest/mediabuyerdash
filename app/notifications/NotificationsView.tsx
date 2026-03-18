"use client";
// app/notifications/NotificationsView.tsx
// Notification preferences and delivery history.
//
// Layout:
//   Mobile  → stacked sections, large toggle touch targets, history cards
//   Desktop → 2-col (preferences | history) on lg+, history table
//
// v1: email only. SMTP must be configured to enable delivery.

import { useState, useTransition } from "react";
import type {
  NotificationPreferenceRow,
  NotificationLogRow,
} from "../../lib/notifications/types";

// ── Style constants ───────────────────────────────────────────────────────────

const CARD = "rounded-xl border border-slate-800 bg-slate-900";
const TH   = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD   = "px-4 py-3 text-sm text-slate-300";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const STATUS_BADGE: Record<string, string> = {
  sent:    "bg-emerald-500/20 text-emerald-400",
  pending: "bg-blue-500/20    text-blue-400",
  failed:  "bg-rose-500/20    text-rose-400",
  skipped: "bg-slate-700      text-slate-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  high:   "bg-rose-500/20  text-rose-400",
  medium: "bg-amber-500/20 text-amber-400",
  low:    "bg-slate-700    text-slate-400",
};

const EVENT_LABELS: Record<string, string> = {
  immediate_alert: "Immediate Alert",
  daily_digest:    "Daily Digest",
};

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  sub,
}: {
  checked:  boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label:    string;
  sub?:     string;
}) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 py-3
      ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative shrink-0 h-6 w-11 rounded-full transition-colors focus:outline-none
          ${checked ? "bg-emerald-600" : "bg-slate-700"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow
            transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </label>
  );
}

// ── V1 scope notice ───────────────────────────────────────────────────────────

function V1Notice({ email }: { email: string }) {
  return (
    <div className="mb-6 rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
      <p className="text-xs font-medium text-slate-300">Email notifications — v1</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Notifications are sent to <span className="text-slate-400 font-medium">{email}</span>.
        {" "}Slack and SMS are not available yet. Requires SMTP configuration in server environment variables.
      </p>
    </div>
  );
}

// ── History card (mobile) ─────────────────────────────────────────────────────

function HistoryCard({ log }: { log: NotificationLogRow }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-200 truncate">{log.subject}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {EVENT_LABELS[log.eventType] ?? log.eventType}
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[log.status] ?? "bg-slate-700 text-slate-400"}`}>
          {log.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[log.priority] ?? "bg-slate-700 text-slate-400"}`}>
          {log.priority}
        </span>
        <span className="text-xs text-slate-500">{fmtDate(log.sentAt ?? log.createdAt)}</span>
      </div>
      {log.errorMessage && (
        <p className="mt-1.5 text-xs text-rose-400">{log.errorMessage}</p>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function NotificationsView({
  userId,
  userEmail,
  userName,
  workspaceId,
  preferences: initialPrefs,
  history: initialHistory,
}: {
  userId:      string;
  userEmail:   string;
  userName:    string | null;
  workspaceId: string | null;
  preferences: NotificationPreferenceRow;
  history:     NotificationLogRow[];
}) {
  const [prefs, setPrefs]             = useState(initialPrefs);
  const [history, setHistory]         = useState(initialHistory);
  const [saveStatus, setSaveStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [actionMsg, setActionMsg]     = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // ── Save preferences ────────────────────────────────────────────────────────

  async function savePrefs(updated: NotificationPreferenceRow) {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/notifications/preferences", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function updatePref<K extends keyof NotificationPreferenceRow>(
    key: K,
    val: NotificationPreferenceRow[K]
  ) {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    savePrefs(updated);
  }

  // ── Trigger actions ─────────────────────────────────────────────────────────

  function handleSendTest() {
    startTransition(async () => {
      setActionMsg(null);
      const res = await fetch("/api/notifications/send-test", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setActionMsg(json.message ?? (res.ok ? "Test email triggered." : "Failed."));
      if (res.ok) refreshHistory();
    });
  }

  function handleSendDigest() {
    startTransition(async () => {
      setActionMsg(null);
      const res = await fetch("/api/notifications/send-digest", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setActionMsg(json.message ?? (res.ok ? "Digest triggered." : "Failed."));
      if (res.ok) refreshHistory();
    });
  }

  async function refreshHistory() {
    const res = await fetch("/api/notifications/preferences");
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.history)) setHistory(data.history);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 lg:px-8">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Notifications</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage email alerts and delivery preferences. Actions are recommendations only — no Meta changes are triggered automatically.
        </p>
      </div>

      <V1Notice email={userEmail} />

      {/* 2-col on lg+ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* Preferences — 2 cols on lg */}
        <div className="lg:col-span-2 space-y-4">

          {/* Master email toggle */}
          <div className={`${CARD} px-5 py-4`}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-100">Email Notifications</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Master switch. Disabling stops all email delivery.
              </p>
            </div>
            <Toggle
              checked={prefs.emailEnabled}
              onChange={(v) => updatePref("emailEnabled", v)}
              label="Enable email notifications"
            />
          </div>

          {/* Immediate alerts */}
          <div className={`${CARD} px-5 py-4`}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-100">Immediate Alerts</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Sent as issues are detected (on-demand, not scheduled).
              </p>
            </div>
            <div className="space-y-0 divide-y divide-slate-800">
              <Toggle
                checked={prefs.immediateAlerts}
                onChange={(v) => updatePref("immediateAlerts", v)}
                disabled={!prefs.emailEnabled}
                label="Enable immediate alerts"
                sub="Master switch for all immediate emails"
              />
              <Toggle
                checked={prefs.alertHighPriority}
                onChange={(v) => updatePref("alertHighPriority", v)}
                disabled={!prefs.emailEnabled || !prefs.immediateAlerts}
                label="High-priority alerts"
                sub="ROAS drop, CPA spike, spend anomalies"
              />
              <Toggle
                checked={prefs.alertSyncFailure}
                onChange={(v) => updatePref("alertSyncFailure", v)}
                disabled={!prefs.emailEnabled || !prefs.immediateAlerts}
                label="Sync failure alerts"
                sub="Stale or failed Meta data sync"
              />
              <Toggle
                checked={prefs.alertBelowGoal}
                onChange={(v) => updatePref("alertBelowGoal", v)}
                disabled={!prefs.emailEnabled || !prefs.immediateAlerts}
                label="Campaigns below goal"
                sub="Campaigns with ROAS or CPA off-target"
              />
              <Toggle
                checked={prefs.alertPacing}
                onChange={(v) => updatePref("alertPacing", v)}
                disabled={!prefs.emailEnabled || !prefs.immediateAlerts}
                label="Pacing alerts"
                sub="Over- or under-pacing budget this month"
              />
            </div>
          </div>

          {/* Daily digest */}
          <div className={`${CARD} px-5 py-4`}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-100">Daily Digest</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Once-per-day summary covering all active issues, opportunities, and
                pacing status.
              </p>
            </div>
            <div className="space-y-0 divide-y divide-slate-800">
              <Toggle
                checked={prefs.dailyDigest}
                onChange={(v) => updatePref("dailyDigest", v)}
                disabled={!prefs.emailEnabled}
                label="Enable daily digest"
                sub="Includes below-goal campaigns, pacing, stale syncs, top opportunities, missing goals"
              />
              <Toggle
                checked={prefs.alertMissingGoals}
                onChange={(v) => updatePref("alertMissingGoals", v)}
                disabled={!prefs.emailEnabled || !prefs.dailyDigest}
                label="Include missing goals"
                sub="Campaigns with spend but no ROAS/CPA goal set"
              />
            </div>
          </div>

          {/* Save status */}
          <div className="h-5">
            {saveStatus === "saving" && (
              <p className="text-xs text-slate-500">Saving…</p>
            )}
            {saveStatus === "saved" && (
              <p className="text-xs text-emerald-500">Preferences saved.</p>
            )}
            {saveStatus === "error" && (
              <p className="text-xs text-rose-400">Failed to save. Try again.</p>
            )}
          </div>

          {/* Manual trigger actions */}
          <div className={`${CARD} px-5 py-4`}>
            <h2 className="mb-1 text-sm font-semibold text-slate-100">Manual Actions</h2>
            <p className="mb-4 text-xs text-slate-500">
              Trigger a delivery now. Requires SMTP configured in server env vars.
              Deduplication prevents duplicate sends for the same day.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                disabled={isPending}
                onClick={handleSendTest}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800
                  px-4 py-2.5 text-sm font-medium text-slate-300
                  hover:bg-slate-700 hover:text-white disabled:opacity-50
                  transition-colors active:scale-95"
              >
                Send Test Email
              </button>
              <button
                disabled={isPending || !prefs.emailEnabled || !prefs.dailyDigest}
                onClick={handleSendDigest}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5
                  text-sm font-medium text-white
                  hover:bg-emerald-600 disabled:opacity-50
                  transition-colors active:scale-95"
              >
                Send Digest Now
              </button>
            </div>
            {actionMsg && (
              <p className="mt-3 text-xs text-slate-400">{actionMsg}</p>
            )}
          </div>
        </div>

        {/* Notification history — 3 cols on lg */}
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Delivery History</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Last {history.length} notification attempts.
              </p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className={`${CARD} px-6 py-14 text-center`}>
              <p className="text-2xl text-slate-700 mb-2">○</p>
              <p className="text-sm font-medium text-slate-300">No notifications sent yet</p>
              <p className="mt-1.5 mx-auto max-w-xs text-xs leading-relaxed text-slate-500">
                Notifications appear here after they are triggered. Use "Send Test Email"
                above to create your first entry.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cards (hidden on lg+) */}
              <div className="space-y-3 lg:hidden">
                {history.map((log) => (
                  <HistoryCard key={log.id} log={log} />
                ))}
              </div>

              {/* Desktop: table (hidden below lg) */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-800">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/60">
                      <th className={TH}>Subject</th>
                      <th className={TH}>Type</th>
                      <th className={TH}>Priority</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Sent</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-900/40">
                    {history.map((log, i) => (
                      <tr
                        key={log.id}
                        className={`hover:bg-slate-800/20 transition-colors ${
                          i < history.length - 1 ? "border-b border-slate-800" : ""
                        }`}
                      >
                        <td className={`${TD} max-w-[260px]`}>
                          <p className="truncate text-slate-200">{log.subject}</p>
                          {log.errorMessage && (
                            <p className="mt-0.5 text-xs text-rose-400 truncate">
                              {log.errorMessage}
                            </p>
                          )}
                        </td>
                        <td className={TD}>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                            {EVENT_LABELS[log.eventType] ?? log.eventType}
                          </span>
                        </td>
                        <td className={TD}>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[log.priority] ?? "bg-slate-700 text-slate-400"}`}>
                            {log.priority}
                          </span>
                        </td>
                        <td className={TD}>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[log.status] ?? "bg-slate-700 text-slate-400"}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className={`${TD} text-slate-500 whitespace-nowrap`}>
                          {fmtDate(log.sentAt ?? log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
