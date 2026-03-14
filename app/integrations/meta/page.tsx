export const dynamic = "force-dynamic";

import { getMetaConnection } from "../../../lib/meta/db";
import { isMetaConfigured }  from "../../../lib/meta/config";
import { MetaIntegrationView, type MetaConnectionProps, type AccessibleAccountProps }
  from "./MetaIntegrationView";

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

  return (
    <MetaIntegrationView
      configured={configured}
      connection={connection}
      accessibleAccounts={accessibleAccounts}
      initialSelectedIds={initialSelectedIds}
      errorParam={searchParams.error}
      connectedParam={searchParams.connected}
    />
  );
}
