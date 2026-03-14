import { prisma } from "../db";
import type { RawMetaAdAccount } from "./accounts";

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Returns the single active Meta connection with its accessible accounts
 * (each including whether it has been selected).
 */
export async function getMetaConnection() {
  return prisma.metaConnection.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      accessibleAccounts: {
        orderBy: { accountName: "asc" },
        include: { selectedAccount: true },
      },
    },
  });
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function upsertMetaConnection(data: {
  metaUserId:      string;
  userDisplayName: string;
  accessToken:     string;
  tokenExpiresAt?: Date;
  scopes?:         string;
}) {
  return prisma.metaConnection.upsert({
    where:  { metaUserId: data.metaUserId },
    create: { ...data, connectionStatus: "active" },
    update: { ...data, connectionStatus: "active" },
  });
}

export async function deleteMetaConnection(id: string) {
  return prisma.metaConnection.delete({ where: { id } });
}

// ── Sync accessible accounts ──────────────────────────────────────────────────

/**
 * Upserts every account returned from Meta and removes any that are
 * no longer accessible (deleted / revoked).
 */
export async function syncAccessibleAdAccounts(
  connectionId: string,
  accounts: RawMetaAdAccount[]
) {
  for (const acct of accounts) {
    await prisma.metaAccessibleAdAccount.upsert({
      where: {
        metaConnectionId_externalAdAccountId: {
          metaConnectionId:    connectionId,
          externalAdAccountId: acct.id,
        },
      },
      create: {
        metaConnectionId:    connectionId,
        externalAdAccountId: acct.id,
        accountName:         acct.name,
        accountStatus:       acct.account_status ?? 1,
        currency:            acct.currency       ?? "USD",
        timezoneName:        acct.timezone_name  ?? "UTC",
      },
      update: {
        accountName:   acct.name,
        accountStatus: acct.account_status ?? 1,
        currency:      acct.currency       ?? "USD",
        timezoneName:  acct.timezone_name  ?? "UTC",
      },
    });
  }

  // Remove accounts no longer returned by Meta
  const currentIds = accounts.map((a) => a.id);
  await prisma.metaAccessibleAdAccount.deleteMany({
    where: {
      metaConnectionId:    connectionId,
      externalAdAccountId: { notIn: currentIds },
    },
  });
}

// ── Selection ─────────────────────────────────────────────────────────────────

/**
 * Replaces the full selection set for a connection.
 * `accessibleAdAccountIds` are internal Prisma IDs (not Meta's act_xxx IDs).
 */
export async function saveSelectedAdAccounts(
  connectionId: string,
  accessibleAdAccountIds: string[]
) {
  await prisma.metaSelectedAdAccount.deleteMany({
    where: { metaConnectionId: connectionId },
  });

  if (accessibleAdAccountIds.length > 0) {
    await prisma.metaSelectedAdAccount.createMany({
      data: accessibleAdAccountIds.map((id) => ({
        metaConnectionId:      connectionId,
        accessibleAdAccountId: id,
        selectedAt:            new Date(),
      })),
    });
  }
}
