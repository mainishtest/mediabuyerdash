export const dynamic = "force-dynamic";

import { getMetaConnection } from "../../../lib/meta/db";
import { isMetaConfigured }  from "../../../lib/meta/config";
import { getMetaReconnectState, validateMetaPermissions, getMetaSyncSetupState }
  from "../../../lib/meta/integrationState";
import { MetaIntegrationView, type MetaConnectionProps, type AccessibleAccountProps }
  from "./MetaIntegrationView";
import type { MetaReconnectState, MetaPermissionStatus, MetaSyncSetupState }
  from "../../../lib/meta/types";

export const metadata = {
  title: "Meta Integration — Media Buying Dashboard",
};

type PageProps = {
  searchParams: { error?: string; connected?: string };
};

export default async function MetaIntegrationPage({ searchParams }: PageProps) {
  const configured = isMetaConfigured();
  const dbConn     = configured ? await getMetaConnection().catch(() => null) : null;

  const connection: MetaConnectionProps | null = dbConn
    ? {
        id:               dbConn.id,
        metaUserId:       dbConn.metaUserId,
        userDisplayName:  dbConn.userDisplayName,
        connectionStatus: dbConn.connectionStatus,
        tokenExpiresAt:   dbConn.tokenExpiresAt?.toISOString() ?? null,
        scopes:           dbConn.scopes ?? null,
        createdAt:        dbConn.createdAt.toISOString(),
      }
    : null;

  const accessibleAccounts: AccessibleAccountProps[] = (
    dbConn?.accessibleAccounts ?? []
  ).map((a) => ({
    id:                  a.id,
    externalAdAccountId: a.externalAdAccountId,
    accountName:         a.accountName,
    accountStatus:       a.accountStatus,
    currency:            a.currency,
    timezoneName:        a.timezoneName,
    isSelected:          a.selectedAccount !== null,
  }));

  const initialSelectedIds = accessibleAccounts
    .filter((a) => a.isSelected)
    .map((a) => a.id);

  // Load reconnect state, permissions, and sync status
  const [reconnectState, syncState] = await Promise.all([
    getMetaReconnectState().catch(() => ({
      needsReconnect: false, reason: null, message: null, previousUserDisplayName: null,
    } as MetaReconnectState)),
    getMetaSyncSetupState().catch(() => ({
      status: "not_started", lastSyncAt: null, lastSyncStatus: null,
      accountsProcessed: 0, campaignsSynced: 0, errorMessage: null,
    } as MetaSyncSetupState)),
  ]);

  const permissionStatus = validateMetaPermissions(dbConn?.scopes ?? null);

  return (
    <MetaIntegrationView
      configured={configured}
      connection={connection}
      accessibleAccounts={accessibleAccounts}
      initialSelectedIds={initialSelectedIds}
      errorParam={searchParams.error}
      connectedParam={searchParams.connected}
      reconnectState={reconnectState}
      permissionStatus={permissionStatus}
      syncState={syncState}
    />
  );
}
