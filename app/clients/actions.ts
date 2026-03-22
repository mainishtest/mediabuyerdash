"use server";

// app/clients/actions.ts
// Server actions for client management.
// All mutations are workspace-scoped via the authenticated session.

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";

export type CreateClientInput = {
  name:       string;
  brandName?: string;
  status:     string;
  notes?:     string;
};

export type UpdateClientInput = {
  clientId:   string;
  name?:      string;
  brandName?: string | null;
  status?:    string;
  notes?:     string | null;
  currency?:  string;
  timezone?:  string;
};

/**
 * Create a new ClientAccount in the current user's workspace.
 * Throws if the user is not authenticated or has no workspace.
 */
export async function createClientAction(input: CreateClientInput): Promise<void> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.workspaceId) {
    throw new Error("Not authenticated or no workspace found.");
  }

  await prisma.clientAccount.create({
    data: {
      workspaceId: session.user.workspaceId,
      name:        input.name.trim(),
      brandName:   input.brandName?.trim() || null,
      status:      input.status,
      notes:       input.notes?.trim()     || null,
      // Default delivery settings — updated later when Meta account is connected.
      currency: "USD",
      timezone: "America/New_York",
    },
  });

  revalidatePath("/clients");
}

/**
 * Update an existing ClientAccount.
 * Only updates fields that are provided.
 */
export async function updateClientAction(input: UpdateClientInput): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    throw new Error("Not authenticated or no workspace found.");
  }

  // Verify client belongs to workspace
  const client = await prisma.clientAccount.findFirst({
    where: { id: input.clientId, workspaceId: session.user.workspaceId },
    select: { id: true },
  });
  if (!client) throw new Error("Client not found in your workspace.");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined)      data.name      = input.name.trim();
  if (input.brandName !== undefined) data.brandName  = input.brandName?.trim() || null;
  if (input.status !== undefined)    data.status     = input.status;
  if (input.notes !== undefined)     data.notes      = input.notes?.trim() || null;
  if (input.currency !== undefined)  data.currency   = input.currency;
  if (input.timezone !== undefined)  data.timezone   = input.timezone;

  if (Object.keys(data).length === 0) return;

  await prisma.clientAccount.update({
    where: { id: input.clientId },
    data,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${input.clientId}`);
  revalidatePath("/admin");
}

/**
 * Delete a ClientAccount and all associated data (cascade).
 * This is irreversible.
 */
export async function deleteClientAction(clientId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) {
    throw new Error("Not authenticated or no workspace found.");
  }

  // Verify client belongs to workspace
  const client = await prisma.clientAccount.findFirst({
    where: { id: clientId, workspaceId: session.user.workspaceId },
    select: { id: true, name: true },
  });
  if (!client) throw new Error("Client not found in your workspace.");

  await prisma.clientAccount.delete({
    where: { id: clientId },
  });

  revalidatePath("/clients");
  revalidatePath("/admin");
}

/**
 * Disconnect a Meta connection (remove the OAuth connection record).
 */
export async function disconnectMetaConnectionAction(connectionId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  await prisma.metaConnection.delete({
    where: { id: connectionId },
  });

  revalidatePath("/admin");
  revalidatePath("/integrations");
}

/**
 * Disconnect a Shopify connection.
 */
export async function disconnectShopifyConnectionAction(connectionId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) throw new Error("Not authenticated.");

  // Verify ownership
  const conn = await prisma.shopifyConnection.findFirst({
    where: { id: connectionId, workspaceId: session.user.workspaceId },
    select: { id: true },
  });
  if (!conn) throw new Error("Connection not found.");

  await prisma.shopifyConnection.delete({
    where: { id: connectionId },
  });

  revalidatePath("/admin");
  revalidatePath("/integrations");
}
