"use client";

import { useState, useTransition } from "react";
import { PageHeader }   from "../../../components/ui/PageHeader";
import { SectionCard }  from "../../../components/ui/SectionCard";
import { Badge }        from "../../../components/ui/Badge";
import { ActionButton } from "../../../components/ui/ActionButton";
import { EmptyState }   from "../../../components/ui/EmptyState";
import {
  startMetaOAuthAction,
  disconnectMetaAction,
  refreshAccountsAction,
  saveSelectedAccountsAction,
} from "./actions";
import { getAdAccountStatusLabel, getAdAccountStatusVariant } from "../../../lib/meta/accounts";

// ── Prop types (plain serialisable objects from the server component) ─────────

export interface MetaConnectionProps {
  id:               string;
  metaUserId:       string;
  userDisplayName:  string;
  connectionStatus: string;
  tokenExpiresAt:   string | null;
  scopes:           string | null;
  createdAt:        string;
}

export interface AccessibleAccountProps {
  id:                  string;
  externalAdAccountId: string;
  accountName:         string;
  accountStatus:       number;
  currency:            string;
  timezoneName:        string;
  isSelected:          boolean;
}

interface Props {
  configured:          boolean;
  connection:          MetaConnectionProps | null;
  accessibleAccounts:  AccessibleAccountProps[];
  initialSelectedIds:  string[];
  errorParam?:         string;
  connectedParam?:     string;
}

// ── Error messages ────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:  "Meta credentials are not configured. Add META_APP_ID and META_APP_SECRET to your environment variables.",
  oauth_denied:    "You declined the Meta authorization request. No connection was created.",
  invalid_state:   "The OAuth state parameter was invalid. This may indicate a CSRF attempt. Please try again.",
  missing_code:    "Meta did not return an authorization code. Please try connecting again.",
  callback_failed: "Something went wrong during the Meta callback. Check server logs for details.",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MetaIntegrationView({
  configured,
  connection,
  accessibleAccounts,
  initialSelectedIds,
  errorParam,
  connectedParam,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelectedIds)
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  const isConnected = connection !== null;
  const selectedCount   = selected.size;
  const accessibleCount = accessibleAccounts.length;

  function toggleAccount(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
    setSaveMessage(null);
  }

  function handleSaveSelection() {
    if (!connection) return;
    startTransition(async () => {
      await saveSelectedAccountsAction(connection.id, Array.from(selected));
      setSaveMessage(`Saved — ${selected.size} account${selected.size !== 1 ? "s" : ""} selected.`);
    });
  }

  const disconnectAction = connection
    ? disconnectMetaAction.bind(null, connection.id)
    : null;

  const refreshAction = connection
    ? refreshAccountsAction.bind(null, connection.id)
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      {/* Page header */}
      <PageHeader
        title="Meta Integration"
        description="Connect your Meta account, discover accessible ad accounts, and select which ones to include in the dashboard."
        badge={
          isConnected ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Badge variant="neutral">Not Connected</Badge>
          )
        }
      />

      {/* Error banner */}
      {errorParam && (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {ERROR_MESSAGES[errorParam] ?? `An error occurred: ${errorParam}`}
        </div>
      )}

      {/* Success banner */}
      {connectedParam === "1" && (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          Meta account connected successfully. Your accessible ad accounts are shown below.
        </div>
      )}

      {/* Setup instructions — shown only when env vars are missing */}
      {!configured && (
        <SectionCard
          title="Configuration Required"
          description="Meta API credentials are not set."
        >
          <div className="space-y-3 text-sm text-slate-400">
            <p>Add the following environment variables to continue:</p>
            <div className="space-y-1 rounded-lg bg-slate-800/60 p-4 font-mono text-xs text-slate-300">
              <p>META_APP_ID=your_app_id</p>
              <p>META_APP_SECRET=your_app_secret</p>
              <p>META_REDIRECT_URI=https://your-domain.com/api/auth/meta/callback</p>
            </div>
            <p className="text-slate-500">
              See <code className="text-slate-400">docs/meta-integration-setup.md</code> for
              step-by-step instructions.
            </p>
          </div>
        </SectionCard>
      )}

      {/* Integration summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Status",
            value: isConnected ? connection!.connectionStatus : "—",
            accent: isConnected,
          },
          {
            label: "Accessible Accounts",
            value: isConnected ? String(accessibleCount) : "—",
            accent: false,
          },
          {
            label: "Selected Accounts",
            value: isConnected ? String(selectedCount) : "—",
            accent: false,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {stat.label}
            </p>
            <p
              className={`mt-1.5 text-xl font-semibold capitalize ${
                stat.accent ? "text-emerald-400" : "text-white"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Connection card */}
      <SectionCard
        title={isConnected ? "Connected Account" : "Connect Your Meta Account"}
        description={
          isConnected
            ? `Connected as ${connection!.userDisplayName}`
            : "Link a Meta (Facebook) account with ads_read and business_management permissions."
        }
        actions={
          isConnected && refreshAction ? (
            <form action={refreshAction}>
              <ActionButton type="submit" size="sm" variant="ghost">
                Refresh Accounts
              </ActionButton>
            </form>
          ) : undefined
        }
      >
        {isConnected ? (
          <div className="space-y-4">
            {/* Identity row */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-800/40 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {connection!.userDisplayName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Meta User ID: {connection!.metaUserId}
                </p>
                {connection!.tokenExpiresAt && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Token expires:{" "}
                    {new Date(connection!.tokenExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              {connection!.scopes && (
                <div className="flex flex-wrap gap-1.5">
                  {connection!.scopes.split(",").map((scope) => (
                    <Badge key={scope} variant="info">
                      {scope.trim()}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Disconnect */}
            {disconnectAction && (
              <form action={disconnectAction}>
                <ActionButton type="submit" variant="danger" size="sm">
                  Disconnect Meta
                </ActionButton>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-1.5 text-sm text-slate-400">
              {[
                "Authorise with your Meta account using Facebook Login",
                "Grant ads_read and business_management permissions",
                "The app will discover all ad accounts you have access to",
                "Select which accounts to include in the dashboard",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-xs text-slate-600">
                    {i + 1}.
                  </span>
                  {step}
                </li>
              ))}
            </ul>

            {configured ? (
              <form action={startMetaOAuthAction}>
                <ActionButton type="submit" variant="primary">
                  Connect Meta Account
                </ActionButton>
              </form>
            ) : (
              <ActionButton variant="primary" disabled>
                Connect Meta Account (credentials missing)
              </ActionButton>
            )}
          </div>
        )}
      </SectionCard>

      {/* Ad account selection — only shown when connected */}
      {isConnected && (
        <SectionCard
          title="Ad Account Selection"
          description="Choose which ad accounts to include in the dashboard. Only selected accounts will be used for reporting and optimization."
          actions={
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className="text-xs text-emerald-400">{saveMessage}</span>
              )}
              <ActionButton
                variant="primary"
                size="sm"
                disabled={isPending}
                onClick={handleSaveSelection}
              >
                {isPending ? "Saving…" : "Save Selection"}
              </ActionButton>
            </div>
          }
        >
          {accessibleCount === 0 ? (
            <EmptyState
              title="No accessible ad accounts found"
              description="This Meta account has no ad accounts, or the required permissions were not granted."
              icon="□"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["", "Account", "ID", "Currency", "Timezone", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {accessibleAccounts.map((acct) => (
                    <tr
                      key={acct.id}
                      onClick={() => toggleAccount(acct.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-800/30"
                    >
                      <td className="py-3 pr-4 w-8">
                        <input
                          type="checkbox"
                          readOnly
                          checked={selected.has(acct.id)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-emerald-500"
                          aria-label={`Select ${acct.accountName}`}
                        />
                      </td>
                      <td className="py-3 pr-4 font-medium text-white">
                        {acct.accountName}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                        {acct.externalAdAccountId}
                      </td>
                      <td className="py-3 pr-4 text-slate-300">
                        {acct.currency}
                      </td>
                      <td className="py-3 pr-4 text-slate-400 text-xs">
                        {acct.timezoneName}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={getAdAccountStatusVariant(acct.accountStatus)}
                        >
                          {getAdAccountStatusLabel(acct.accountStatus)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
