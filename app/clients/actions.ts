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
