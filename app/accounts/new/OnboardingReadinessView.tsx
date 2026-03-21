"use client";

// app/accounts/new/OnboardingReadinessView.tsx
// Full onboarding readiness UI — account creation, checklist, readiness summary, go-live.
// Mobile-first layout with desktop-enhanced two-column view.

import { useState, useTransition }    from "react";
import { useRouter }                  from "next/navigation";
import Link                           from "next/link";
import { createAccountAction }        from "./actions";
import type {
  OnboardingAccount,
  OnboardingChecklistItem,
  OnboardingBlocker,
  OnboardingReadinessState,
} from "../../../types/onboarding";

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  accounts:      OnboardingAccount[];
  workspaceName: string;
};

// ── Constants ───────────────────────────────────────────────────────────────

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

// ── Readiness badge ─────────────────────────────────────────────────────────

const STATE_STYLES: Record<OnboardingReadinessState, { bg: string; text: string }> = {
  not_started:       { bg: "bg-slate-800",         text: "text-slate-400" },
  in_progress:       { bg: "bg-sky-950/60",        text: "text-sky-300" },
  blocked:           { bg: "bg-rose-950/60",       text: "text-rose-300" },
  needs_review:      { bg: "bg-amber-950/60",      text: "text-amber-300" },
  ready_for_go_live: { bg: "bg-emerald-950/60",    text: "text-emerald-300" },
  live:              { bg: "bg-emerald-700",        text: "text-emerald-100" },
};

function ReadinessBadge({ state, label }: { state: OnboardingReadinessState; label: string }) {
  const s = STATE_STYLES[state];
  return (
    <span className={`inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {label}
    </span>
  );
}

// ── Checklist item row ──────────────────────────────────────────────────────

function ChecklistRow({ item }: { item: OnboardingChecklistItem }) {
  const icon =
    item.status === "complete"  ? "✓" :
    item.status === "blocked"   ? "!" :
    item.status === "optional"  ? "○" :
                                  "–";

  const iconColor =
    item.status === "complete"  ? "text-emerald-400" :
    item.status === "blocked"   ? "text-rose-400" :
    item.status === "optional"  ? "text-slate-600" :
                                  "text-amber-400";

  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${iconColor} ${
        item.status === "complete" ? "bg-emerald-950/60" :
        item.status === "blocked"  ? "bg-rose-950/60" :
                                     "bg-slate-800"
      }`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${
          item.status === "complete" ? "text-slate-300" : "text-slate-200"
        }`}>
          {item.label}
          {item.status === "optional" && (
            <span className="ml-1.5 text-xs text-slate-600">(optional)</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
      </div>
      {item.actionLabel && item.actionHref && (
        <Link
          href={item.actionHref}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
            font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
        >
          {item.actionLabel}
        </Link>
      )}
    </div>
  );
}

// ── Blocker row ─────────────────────────────────────────────────────────────

function BlockerRow({ blocker }: { blocker: OnboardingBlocker }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
      blocker.severity === "required"
        ? "border-rose-800/50 bg-rose-950/20"
        : "border-amber-800/50 bg-amber-950/20"
    }`}>
      <span className={`mt-0.5 text-xs font-bold ${
        blocker.severity === "required" ? "text-rose-400" : "text-amber-400"
      }`}>
        {blocker.severity === "required" ? "Required" : "Optional"}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${
          blocker.severity === "required" ? "text-rose-200" : "text-amber-200"
        }`}>
          {blocker.message}
        </p>
      </div>
      {blocker.actionLabel && blocker.actionHref && (
        <Link
          href={blocker.actionHref}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
            font-medium text-slate-200 transition-colors hover:bg-slate-700"
        >
          {blocker.actionLabel}
        </Link>
      )}
    </div>
  );
}

// ── Account card (list view) ────────────────────────────────────────────────

function AccountCard({
  account,
  onSelect,
}: {
  account:  OnboardingAccount;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left
        transition-colors hover:border-slate-700 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{account.clientName}</h3>
          {account.brandName && (
            <p className="text-xs text-slate-500">{account.brandName}</p>
          )}
        </div>
        <ReadinessBadge state={account.goLive.readinessState} label={account.goLive.readinessLabel} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{account.goLive.completedChecks}/{account.goLive.totalChecks} checks</span>
        {account.goLive.requiredBlockers.length > 0 && (
          <span className="text-rose-400">
            {account.goLive.requiredBlockers.length} blocker{account.goLive.requiredBlockers.length !== 1 ? "s" : ""}
          </span>
        )}
        <span>{account.timezone}</span>
        <span>{account.currency}</span>
      </div>
    </button>
  );
}

// ── Create account form ─────────────────────────────────────────────────────

function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [name,      setName]      = useState("");
  const [brandName, setBrandName] = useState("");
  const [timezone,  setTimezone]  = useState("America/New_York");
  const [currency,  setCurrency]  = useState("USD");
  const [notes,     setNotes]     = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Account name is required."); return; }

    startTransition(async () => {
      try {
        await createAccountAction({ name, brandName, timezone, currency, notes });
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm " +
    "text-slate-100 placeholder-slate-600 transition-colors " +
    "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

  const selectCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm " +
    "text-slate-100 transition-colors " +
    "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-slate-400">
          Account Name
        </label>
        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Acme Brand" className={inputCls} />
      </div>

      {/* Brand Name */}
      <div>
        <label htmlFor="brand" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
          Brand Name <span className="font-normal text-slate-600">(optional)</span>
        </label>
        <input id="brand" type="text" value={brandName} onChange={e => setBrandName(e.target.value)}
          placeholder="e.g. Acme" className={inputCls} />
      </div>

      {/* Timezone + Currency row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tz" className="mb-1.5 block text-xs font-medium text-slate-400">
            Timezone
          </label>
          <select id="tz" value={timezone} onChange={e => setTimezone(e.target.value)} className={selectCls}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cur" className="mb-1.5 block text-xs font-medium text-slate-400">
            Currency
          </label>
          <select id="cur" value={currency} onChange={e => setCurrency(e.target.value)} className={selectCls}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
          Notes <span className="font-normal text-slate-600">(optional)</span>
        </label>
        <textarea id="notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Internal notes about this account..." className={`${inputCls} resize-none`} />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-300">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white
          transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
        {isPending ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  actions,
}: {
  title:        string;
  description?: string;
  children:     React.ReactNode;
  actions?:     React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-col gap-2 border-b border-slate-800/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Account detail view ─────────────────────────────────────────────────────

function AccountDetail({ account }: { account: OnboardingAccount }) {
  const { goLive, integration, syncHealth, attribution, goalSetup, governance, checklist } = account;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {account.clientName}
            </h1>
            <ReadinessBadge state={goLive.readinessState} label={goLive.readinessLabel} />
          </div>
          {account.brandName && (
            <p className="mt-1 text-sm text-slate-400">{account.brandName}</p>
          )}
          <p className="mt-1.5 text-xs text-slate-500">
            {account.timezone} &middot; {account.currency} &middot; Created {new Date(account.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/clients/${account.clientId}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-800
              px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white">
            Open Dashboard
          </Link>
        </div>
      </div>

      {/* ── Two-column layout on desktop ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content — 2/3 */}
        <div className="space-y-6 lg:col-span-2">

          {/* ── Blockers ─────────────────────────────────────────────────── */}
          {(goLive.requiredBlockers.length > 0 || goLive.optionalBlockers.length > 0) && (
            <Section title="Blockers" description="Issues that need to be resolved before go-live.">
              <div className="space-y-2">
                {goLive.requiredBlockers.map((b, i) => <BlockerRow key={`r-${i}`} blocker={b} />)}
                {goLive.optionalBlockers.map((b, i) => <BlockerRow key={`o-${i}`} blocker={b} />)}
              </div>
            </Section>
          )}

          {/* ── Integrations ─────────────────────────────────────────────── */}
          <Section title="Integrations" description="Meta and Shopify connection status.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <IntegrationCard
                label="Meta (Facebook Ads)"
                purpose="Delivery analysis + operational execution"
                connected={integration.metaConnected}
                mapped={integration.metaMapped}
                actionLabel={!integration.metaConnected ? "Connect Meta" : !integration.metaMapped ? "Map Account" : undefined}
                actionHref={!integration.metaConnected ? "/integrations/meta" : !integration.metaMapped ? `/clients/${account.clientId}#integrations` : undefined}
              />
              <IntegrationCard
                label="Shopify / CRM"
                purpose="Source of truth for ROAS + CPA"
                connected={integration.shopifyConnected}
                mapped={integration.shopifyMapped}
                actionLabel={!integration.shopifyConnected ? "Connect Shopify" : !integration.shopifyMapped ? "Map Store" : undefined}
                actionHref={!integration.shopifyConnected ? "/integrations/shopify" : !integration.shopifyMapped ? `/clients/${account.clientId}#integrations` : undefined}
              />
            </div>
          </Section>

          {/* ── Attribution ──────────────────────────────────────────────── */}
          <Section title="Attribution Readiness" description="Timezone and attribution configuration.">
            <div className="space-y-3">
              <InfoRow label="Timezone" value={attribution.timezone ?? "Not set"} ok={attribution.timezoneConfigured}
                actionLabel={!attribution.timezoneConfigured ? "Set Timezone" : undefined}
                actionHref={!attribution.timezoneConfigured ? `/clients/${account.clientId}/settings` : undefined} />
              <InfoRow label="Attribution Window" value={attribution.attributionWindow} ok />
              <InfoRow label="CRM is Source of Truth" value="Yes — Shopify/CRM used for business outcomes" ok />
              <InfoRow label="Meta Used For" value="Delivery analysis and operational execution" ok />
            </div>
          </Section>

          {/* ── Sync Health ──────────────────────────────────────────────── */}
          <Section title="Sync Health" description="Data import status."
            actions={
              <Link href={`/clients/${account.clientId}/sync`}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
                  font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">
                View Sync History
              </Link>
            }>
            <div className="space-y-3">
              <InfoRow label="Has Synced" value={syncHealth.hasEverSynced ? "Yes" : "No"} ok={syncHealth.hasEverSynced} />
              <InfoRow label="Last Sync" value={syncHealth.lastSyncAt ? new Date(syncHealth.lastSyncAt).toLocaleString() : "Never"} ok={syncHealth.lastSyncSuccessful} />
              <InfoRow label="Data Flowing" value={syncHealth.dataFlowing ? "Yes" : "No"} ok={syncHealth.dataFlowing} />
              <InfoRow label="Shopify Orders" value={String(syncHealth.shopifyOrderCount)} ok={syncHealth.shopifyOrderCount > 0} />
            </div>
          </Section>

          {/* ── Goals ────────────────────────────────────────────────────── */}
          <Section title="Goals & Default Settings" description="Performance targets for this account."
            actions={
              <Link href={`/clients/${account.clientId}/settings`}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
                  font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">
                Configure Goals
              </Link>
            }>
            <div className="space-y-3">
              <InfoRow label="Client Goals" value={goalSetup.hasClientGoals ? "Configured" : "Using system defaults"}
                ok={goalSetup.hasClientGoals} warn={!goalSetup.hasClientGoals} />
              <InfoRow label="ROAS Target" value={goalSetup.hasTargetRoas ? "Set" : "System default (2.0x)"}
                ok={goalSetup.hasTargetRoas} warn={!goalSetup.hasTargetRoas} />
              <InfoRow label="CPA Target" value={goalSetup.hasTargetCpa ? "Set" : "Not set"}
                ok={goalSetup.hasTargetCpa} warn={!goalSetup.hasTargetCpa} />
            </div>
          </Section>

          {/* ── Governance ───────────────────────────────────────────────── */}
          <Section title="Governance & Approval Defaults" description="Automation controls and approval routing."
            actions={
              <Link href="/portfolio/governance"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
                  font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">
                View Governance
              </Link>
            }>
            <div className="space-y-3">
              <InfoRow label="Automation" value={governance.automationPaused ? "Paused" : "Active"}
                ok={!governance.automationPaused} warn={governance.automationPaused} />
              <InfoRow label="Emergency Stops" value={governance.activeStopCount > 0 ? `${governance.activeStopCount} active` : "None"}
                ok={governance.activeStopCount === 0} warn={governance.activeStopCount > 0} />
              <InfoRow label="Active Overrides" value={governance.activeOverrideCount > 0 ? `${governance.activeOverrideCount} active` : "None"}
                ok={governance.activeOverrideCount === 0} warn={governance.activeOverrideCount > 0} />
            </div>
          </Section>
        </div>

        {/* Sidebar — 1/3 (on desktop), full-width stacked (on mobile) */}
        <div className="space-y-6">
          {/* ── Go-Live Summary ──────────────────────────────────────────── */}
          <Section title="Go-Live Status">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Readiness</span>
                <ReadinessBadge state={goLive.readinessState} label={goLive.readinessLabel} />
              </div>
              {/* Progress bar */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>Checks complete</span>
                  <span>{goLive.completedChecks}/{goLive.totalChecks}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      goLive.canGoLive ? "bg-emerald-500" : "bg-sky-500"
                    }`}
                    style={{ width: `${goLive.totalChecks > 0 ? (goLive.completedChecks / goLive.totalChecks) * 100 : 0}%` }}
                  />
                </div>
              </div>
              {goLive.canGoLive && (
                <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
                  This account is ready to go live. All required checks pass.
                </div>
              )}
              {!goLive.canGoLive && goLive.requiredBlockers.length > 0 && (
                <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
                  {goLive.requiredBlockers.length} required blocker{goLive.requiredBlockers.length !== 1 ? "s" : ""} must be resolved.
                </div>
              )}
            </div>
          </Section>

          {/* ── Checklist ────────────────────────────────────────────────── */}
          <Section title="Readiness Checklist" description={`${goLive.completedChecks}/${goLive.totalChecks} complete`}>
            <div className="divide-y divide-slate-800/60">
              {checklist.map(item => <ChecklistRow key={item.id} item={item} />)}
            </div>
          </Section>

          {/* ── Recommended Actions ──────────────────────────────────────── */}
          {goLive.recommendedActions.length > 0 && (
            <Section title="Next Actions">
              <div className="space-y-2">
                {goLive.recommendedActions.map(action => (
                  <div key={action.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-sm text-slate-300">{action.label}</span>
                    {action.actionHref && action.actionLabel && (
                      <Link href={action.actionHref}
                        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium
                          text-white transition-colors hover:bg-emerald-500">
                        {action.actionLabel}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Integration card ────────────────────────────────────────────────────────

function IntegrationCard({
  label,
  purpose,
  connected,
  mapped,
  actionLabel,
  actionHref,
}: {
  label:        string;
  purpose:      string;
  connected:    boolean;
  mapped:       boolean;
  actionLabel?: string;
  actionHref?:  string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${
      mapped      ? "border-emerald-800/50 bg-emerald-950/20" :
      connected   ? "border-amber-800/50 bg-amber-950/20" :
                    "border-slate-700 bg-slate-800/40"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{purpose}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          mapped      ? "bg-emerald-950/60 text-emerald-300" :
          connected   ? "bg-amber-950/60 text-amber-300" :
                        "bg-slate-800 text-slate-500"
        }`}>
          {mapped ? "Mapped" : connected ? "Connected" : "Not Connected"}
        </span>
      </div>
      {actionLabel && actionHref && (
        <Link href={actionHref}
          className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-slate-700 bg-slate-800
            px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

// ── Info row helper ─────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  ok,
  warn,
  actionLabel,
  actionHref,
}: {
  label:        string;
  value:        string;
  ok?:          boolean;
  warn?:        boolean;
  actionLabel?: string;
  actionHref?:  string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          ok    ? "bg-emerald-400" :
          warn  ? "bg-amber-400" :
                  "bg-slate-600"
        }`} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm ${ok ? "text-slate-200" : warn ? "text-amber-300" : "text-slate-400"}`}>
          {value}
        </span>
        {actionLabel && actionHref && (
          <Link href={actionHref}
            className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200">
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export function OnboardingReadinessView({ accounts, workspaceName }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    accounts.length === 1 ? accounts[0].clientId : null,
  );

  const selectedAccount = accounts.find(a => a.clientId === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Account Onboarding
            </h1>
            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            Set up new accounts, verify readiness, and confirm go-live status.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => { setShowCreate(true); setSelectedId(null); }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-transparent
              bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors
              hover:bg-emerald-500"
          >
            + New Account
          </button>
        </div>
      </div>

      {/* ── Create form ────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Create New Account</h2>
            <button onClick={() => setShowCreate(false)}
              className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
          <CreateAccountForm onCreated={() => {
            setShowCreate(false);
            router.refresh();
          }} />
        </div>
      )}

      {/* ── Account list + detail ──────────────────────────────────────── */}
      {!showCreate && accounts.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <p className="text-sm text-slate-400 mb-4">
            No accounts yet. Create your first account to begin onboarding.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5
              text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            + Create First Account
          </button>
        </div>
      )}

      {/* Show account list if multiple, or directly show detail if one */}
      {!showCreate && accounts.length > 1 && !selectedAccount && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map(a => (
            <AccountCard key={a.clientId} account={a} onSelect={() => setSelectedId(a.clientId)} />
          ))}
        </div>
      )}

      {/* Back button when viewing detail with multiple accounts */}
      {!showCreate && accounts.length > 1 && selectedAccount && (
        <button
          onClick={() => setSelectedId(null)}
          className="mb-4 text-sm text-slate-500 hover:text-slate-300"
        >
          &larr; All accounts
        </button>
      )}

      {/* Account detail */}
      {!showCreate && selectedAccount && (
        <AccountDetail account={selectedAccount} />
      )}
    </div>
  );
}
