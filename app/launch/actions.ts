"use server";

// Campaign Launcher — Server Actions
//
// Handles all server-side operations for the campaign launch flow:
// fetching prerequisites, validating payloads, executing launches,
// and persisting launch records.

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/db";
import { getConnectionForSync } from "../../lib/meta/db";
import { fetchLaunchPrerequisites } from "../../lib/meta/prerequisites";
import {
  launchMetaCampaignFlow,
  validateLaunchPayload,
  type LaunchPayload,
} from "../../lib/meta/launch";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LaunchActionResult {
  ok: boolean;
  launchId?: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  errors?: Array<{ field?: string; step?: string; message: string }>;
}

// ── Fetch prerequisites ──────────────────────────────────────────────────────

export async function getMetaLaunchOptionsAction() {
  const connection = await getConnectionForSync();
  if (!connection || connection.selectedAccounts.length === 0) {
    return {
      connected: false,
      adAccounts: [] as Array<{ id: string; externalId: string; name: string; currency: string }>,
      pages: [] as Array<{ id: string; name: string }>,
      pixels: [] as Array<{ id: string; name: string }>,
      instagramAccounts: [] as Array<{ id: string; username: string }>,
      objectives: [] as Array<{ value: string; label: string; description: string }>,
      conversionEvents: [] as Array<{ event_name: string; description?: string }>,
      ctaTypes: [] as Array<{ value: string; label: string }>,
    };
  }

  // Get ad accounts from selected accounts
  const adAccounts = connection.selectedAccounts.map((sa) => ({
    id: sa.id,
    externalId: sa.accessibleAdAccount.externalAdAccountId,
    name: sa.accessibleAdAccount.accountName,
    currency: sa.accessibleAdAccount.currency,
  }));

  // Fetch prerequisites from Meta for the first selected account
  const firstAccount = adAccounts[0];
  try {
    const prereqs = await fetchLaunchPrerequisites(
      firstAccount.externalId,
      connection.accessToken
    );

    return {
      connected: true,
      adAccounts,
      pages: prereqs.pages.map((p) => ({ id: p.id, name: p.name })),
      pixels: prereqs.pixels.map((p) => ({ id: p.id, name: p.name })),
      instagramAccounts: prereqs.instagramAccounts.map((a) => ({ id: a.id, username: a.username })),
      objectives: prereqs.objectives.map((o) => ({ value: o.value, label: o.label, description: o.description })),
      conversionEvents: prereqs.conversionEvents,
      ctaTypes: prereqs.ctaTypes.map((c) => ({ value: c.value, label: c.label })),
    };
  } catch {
    // If prereqs fail, return what we have
    return {
      connected: true,
      adAccounts,
      pages: [],
      pixels: [],
      instagramAccounts: [],
      objectives: [],
      conversionEvents: [],
      ctaTypes: [],
    };
  }
}

// ── Prefill from concept ─────────────────────────────────────────────────────

export async function getConceptPrefillAction(conceptId: string) {
  const concept = await prisma.videoAdConcept.findUnique({
    where: { id: conceptId },
  });
  if (!concept) return null;

  // Get latest strategy run for copy
  const latestRun = await prisma.strategyRun.findFirst({
    where: { conceptId, status: "completed" },
    orderBy: { version: "desc" },
  });

  let primaryText = "";
  let headline = "";
  let ctaText = "";

  if (latestRun) {
    try {
      if (latestRun.scriptSet) {
        const script = JSON.parse(latestRun.scriptSet);
        primaryText = script.opening ? `${script.opening}\n\n${script.body}` : "";
      }
      if (latestRun.hookSet) {
        const hookSet = JSON.parse(latestRun.hookSet);
        headline = hookSet.hooks?.[concept.favoriteHookIndex ?? 0]?.text ?? hookSet.hooks?.[0]?.text ?? "";
      }
      if (latestRun.ctaVariants) {
        const ctas = JSON.parse(latestRun.ctaVariants);
        ctaText = ctas[concept.favoriteCtaIndex ?? 0]?.text ?? ctas[0]?.text ?? "";
      }
    } catch { /* ignore parse errors */ }
  }

  return {
    conceptId: concept.id,
    conceptTitle: concept.title,
    productName: concept.productName,
    platform: concept.platform,
    primaryText,
    headline,
    ctaText,
    campaignName: `${concept.productName} — ${concept.title}`,
    adSetName: `${concept.title} — Ad Set`,
    adName: `${concept.title} — Ad`,
  };
}

// ── Prefill from asset ───────────────────────────────────────────────────────

export async function getAssetPrefillAction(assetId: string) {
  const asset = await prisma.creativeAsset.findUnique({
    where: { id: assetId },
  });
  if (!asset) return null;

  return {
    assetId: asset.id,
    assetName: asset.name,
    assetType: asset.type as "image" | "video",
    assetUrl: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
    primaryText: asset.body ?? "",
    headline: asset.headline ?? "",
    ctaText: asset.callToAction ?? "",
    campaignName: `${asset.name} Campaign`,
    adSetName: `${asset.name} — Ad Set`,
    adName: `${asset.name} — Ad`,
  };
}

// ── Validate ─────────────────────────────────────────────────────────────────

export async function validateLaunchAction(payload: LaunchPayload): Promise<LaunchActionResult> {
  const errors = validateLaunchPayload(payload);
  if (errors.length > 0) {
    return { ok: false, errors: errors.map((e) => ({ field: e.field, message: e.message })) };
  }
  return { ok: true };
}

// ── Launch ───────────────────────────────────────────────────────────────────

export async function executeLaunchAction(payload: LaunchPayload): Promise<LaunchActionResult> {
  // Inject access token server-side (never trust client)
  const connection = await getConnectionForSync();
  if (!connection) {
    return { ok: false, errors: [{ message: "No Meta connection found. Connect your Meta account first." }] };
  }
  payload.accessToken = connection.accessToken;

  // Create launch record
  const launch = await prisma.campaignLaunch.create({
    data: {
      status: "launching",
      externalAdAccountId: payload.adAccountId,
      campaignName: payload.campaignName,
      adSetName: payload.adSetName,
      adName: payload.adName,
      objective: payload.objective,
      dailyBudget: payload.dailyBudget,
      destinationUrl: payload.destinationUrl,
      primaryText: payload.primaryText,
      headline: payload.headline,
      ctaType: payload.ctaType,
      pageId: payload.pageId,
      pixelId: payload.pixelId ?? null,
      conversionEvent: payload.conversionEvent ?? null,
      targetingSnapshot: JSON.stringify(payload.targeting),
      launchPayload: JSON.stringify({ ...payload, accessToken: "[REDACTED]" }),
    },
  });

  // Execute launch
  const result = await launchMetaCampaignFlow(payload);

  // Update launch record
  await prisma.campaignLaunch.update({
    where: { id: launch.id },
    data: {
      status: result.status === "success" ? "success" : "failed",
      externalCampaignId: result.campaignId ?? null,
      externalAdSetId: result.adSetId ?? null,
      externalCreativeId: result.creativeId ?? null,
      externalAdId: result.adId ?? null,
      launchResult: JSON.stringify(result),
      errorMessages: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      launchedAt: new Date(),
    },
  });

  revalidatePath("/launch");

  if (result.status === "success") {
    return {
      ok: true,
      launchId: launch.id,
      campaignId: result.campaignId,
      adSetId: result.adSetId,
      creativeId: result.creativeId,
      adId: result.adId,
    };
  }

  return {
    ok: false,
    launchId: launch.id,
    errors: result.errors.map((e) => ({ step: e.step, message: e.message })),
  };
}

// ── Launch history ───────────────────────────────────────────────────────────

export async function getLaunchHistoryAction() {
  return prisma.campaignLaunch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ── List internal assets for selection ────────────────────────────────────────

export async function getAvailableAssetsAction() {
  return prisma.creativeAsset.findMany({
    where: {
      status: { in: ["ready", "in_use"] },
      type: { in: ["image", "video"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      url: true,
      thumbnailUrl: true,
      sourceType: true,
      headline: true,
      body: true,
      callToAction: true,
    },
  });
}
