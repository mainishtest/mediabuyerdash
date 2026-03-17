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

/**
 * Loads the connection together with the selected accounts (including each
 * account's externalAdAccountId) — the shape needed by the sync orchestrator.
 */
export async function getConnectionForSync() {
  return prisma.metaConnection.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      selectedAccounts: {
        include: { accessibleAdAccount: true },
      },
    },
  });
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
 * Updates the selection set for a connection.
 *
 * IMPORTANT: Uses upsert-style logic to preserve clientAccountId mappings.
 *
 * - Newly selected accounts are created (skipDuplicates keeps existing ones intact).
 * - Deselected accounts that are UNMAPPED (clientAccountId = null) are deleted.
 * - Deselected accounts that ARE mapped to a client are left in place — deleting them
 *   would silently break client → ad-account associations. The operator must manually
 *   unmap from the client page first.
 */
export async function saveSelectedAdAccounts(
  connectionId: string,
  accessibleAdAccountIds: string[]
) {
  // Remove unmapped accounts that are no longer in the selection.
  // Mapped accounts are intentionally kept to preserve client assignments.
  await prisma.metaSelectedAdAccount.deleteMany({
    where: {
      metaConnectionId:      connectionId,
      accessibleAdAccountId: { notIn: accessibleAdAccountIds },
      clientAccountId:       null,
    },
  });

  // Create new selections; skipDuplicates preserves existing rows (and their
  // clientAccountId) for accounts that were already selected.
  if (accessibleAdAccountIds.length > 0) {
    await prisma.metaSelectedAdAccount.createMany({
      data: accessibleAdAccountIds.map((id) => ({
        metaConnectionId:      connectionId,
        accessibleAdAccountId: id,
        selectedAt:            new Date(),
      })),
      skipDuplicates: true,
    });
  }
}
