"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/db";
import { createLaunchDraftFromApprovedVariations } from "../../lib/launchDraftUtils";

export async function createLaunchDraftAction(
  generationRunId: string,
  draftNameOverride?: string
): Promise<{ draftId: string } | { error: string }> {
  const result = await createLaunchDraftFromApprovedVariations(
    generationRunId,
    draftNameOverride
  );
  if ("error" in result) return result;
  revalidatePath("/launch-drafts");
  revalidatePath("/creative-history");
  return { draftId: result.draftId };
}

export async function renameLaunchDraftAction(
  draftId: string,
  name: string
): Promise<void> {
  await prisma.launchDraft.update({
    where: { id: draftId },
    data: { draftName: name.trim() },
  });
  revalidatePath(`/launch-drafts/${draftId}`);
  revalidatePath("/launch-drafts");
}

export async function toggleVariantSelectionAction(
  variantId: string,
  selected: boolean,
  draftId: string
): Promise<void> {
  await prisma.launchDraftVariant.update({
    where: { id: variantId },
    data: { selectedForLaunch: selected },
  });
  revalidatePath(`/launch-drafts/${draftId}`);
}

export async function markDraftReadyAction(draftId: string): Promise<void> {
  await prisma.launchDraft.update({
    where: { id: draftId },
    data: { status: "ready" },
  });
  revalidatePath(`/launch-drafts/${draftId}`);
  revalidatePath("/launch-drafts");
}

export async function archiveLaunchDraftAction(draftId: string): Promise<void> {
  await prisma.launchDraft.update({
    where: { id: draftId },
    data: { status: "archived" },
  });
  revalidatePath(`/launch-drafts/${draftId}`);
  revalidatePath("/launch-drafts");
}
