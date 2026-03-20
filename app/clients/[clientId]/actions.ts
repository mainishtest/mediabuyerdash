"use server";

// app/clients/[clientId]/actions.ts
// Server actions for mapping integrations to a specific client.
// Only association/mapping logic — no sync, no reconciliation.

import { getServerSession } from "next-auth";
import { revalidatePath }   from "next/cache";
import { authOptions }      from "../../../lib/auth";
import { prisma }           from "../../../lib/db";

function clientPath(clientId: string) {
  return `/clients/${clientId}`;
}

/** Verify the client belongs to the session's workspace. Throws if not. */
async function assertClientOwnership(clientId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) throw new Error("Not authenticated");

  const client = await prisma.clientAccount.findFirst({
    where: { id: clientId, workspaceId: session.user.workspaceId },
  });
  if (!client) throw new Error("Client not found");
}

// ── Meta mapping ──────────────────────────────────────────────────────────────

/**
 * Assign a single selected Meta ad account to a client.
 * selectedAccountId = MetaSelectedAdAccount.id
 */
export async function assignMetaAccountToClientAction(
  clientId:          string,
  selectedAccountId: string
): Promise<void> {
  await assertClientOwnership(clientId);

  await prisma.metaSelectedAdAccount.update({
    where: { id: selectedAccountId },
    data:  { clientAccountId: clientId },
  });

  revalidatePath(clientPath(clientId));
}

/**
 * Remove a Meta ad account mapping from a client (sets clientAccountId → null).
 * Only unmaps if the account is currently mapped to this client.
 */
export async function unmapMetaAccountFromClientAction(
  clientId:          string,
  selectedAccountId: string
): Promise<void> {
  await assertClientOwnership(clientId);

  await prisma.metaSelectedAdAccount.updateMany({
    where: { id: selectedAccountId, clientAccountId: clientId },
    data:  { clientAccountId: null },
  });

  revalidatePath(clientPath(clientId));
}

// ── Shopify mapping ───────────────────────────────────────────────────────────

/**
 * Assign a Shopify connection to a client.
 * connectionId = ShopifyConnection.id
 */
export async function assignShopifyConnectionToClientAction(
  clientId:     string,
  connectionId: string
): Promise<void> {
  await assertClientOwnership(clientId);

  await prisma.shopifyConnection.update({
    where: { id: connectionId },
    data:  { clientAccountId: clientId },
  });

  revalidatePath(clientPath(clientId));
}

/**
 * Remove a Shopify connection mapping from a client (sets clientAccountId → null).
 * Only unmaps if the connection is currently mapped to this client.
 */
export async function unmapShopifyFromClientAction(
  clientId:     string,
  connectionId: string
): Promise<void> {
  await assertClientOwnership(clientId);

  await prisma.shopifyConnection.updateMany({
    where: { id: connectionId, clientAccountId: clientId },
    data:  { clientAccountId: null },
  });

  revalidatePath(clientPath(clientId));
}
