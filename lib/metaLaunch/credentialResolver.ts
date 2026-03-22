// lib/metaLaunch/credentialResolver.ts
// Resolves Meta API credentials (access token + ad account ID) for a client.
// Reuses existing Meta connection + account selection infrastructure.

import { prisma } from "../db";
import type { ResolvedCredentials } from "./types";

/**
 * Resolve Meta credentials for a client account.
 *
 * Lookup chain:
 *   1. Find MetaSelectedAdAccount mapped to this clientAccountId
 *   2. Walk up to MetaAccessibleAdAccount for externalAdAccountId
 *   3. Walk up to MetaConnection for accessToken
 *   4. Validate connection is active and token not expired
 */
export async function resolveMetaCredentials(
  clientAccountId: string,
): Promise<ResolvedCredentials | { error: string; code: string }> {
  // Find the selected account mapped to this client
  const selected = await prisma.metaSelectedAdAccount.findFirst({
    where: { clientAccountId },
    include: {
      accessibleAdAccount: true,
      connection: true,
    },
  });

  if (!selected) {
    return {
      error: `No Meta ad account mapped to client ${clientAccountId}. Map an ad account in client settings.`,
      code: "NO_AD_ACCOUNT_MAPPING",
    };
  }

  const { connection, accessibleAdAccount } = selected;

  if (!connection) {
    return {
      error: "Meta connection not found for the mapped ad account.",
      code: "NO_META_CONNECTION",
    };
  }

  if (connection.connectionStatus !== "active") {
    return {
      error: `Meta connection is ${connection.connectionStatus}. Reconnect Meta to resume launching.`,
      code: "META_CONNECTION_INACTIVE",
    };
  }

  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
    return {
      error: "Meta access token has expired. Reconnect Meta to get a fresh token.",
      code: "META_TOKEN_EXPIRED",
    };
  }

  if (!connection.accessToken) {
    return {
      error: "Meta access token is missing. Reconnect Meta.",
      code: "NO_ACCESS_TOKEN",
    };
  }

  if (!accessibleAdAccount?.externalAdAccountId) {
    return {
      error: "External ad account ID not found. Re-sync Meta accounts.",
      code: "NO_EXTERNAL_AD_ACCOUNT",
    };
  }

  return {
    accessToken: connection.accessToken,
    externalAdAccountId: accessibleAdAccount.externalAdAccountId,
    connectionId: connection.id,
  };
}
