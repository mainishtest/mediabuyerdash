"use server";

// app/onboarding/actions.ts
// Server action for the onboarding "Create first client" step.

import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";

export type CreateFirstClientInput = {
  name:      string;
  brandName: string;
  notes:     string;
};

export async function createFirstClientAction(
  input: CreateFirstClientInput
): Promise<{ clientId: string }> {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) throw new Error("Not authenticated");

  const client = await prisma.clientAccount.create({
    data: {
      workspaceId,
      name:      input.name.trim(),
      brandName: input.brandName.trim() || null,
      notes:     input.notes.trim()     || null,
      status:    "active",
      currency:  "USD",
      timezone:  "America/New_York",
    },
  });

  return { clientId: client.id };
}
