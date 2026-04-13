// Meta Ads — Campaign Launch Orchestrator
//
// Validates a launch payload and creates the full entity chain:
// Campaign → Ad Set → Ad Creative → Ad
//
// Returns a structured result with IDs for each created entity
// or detailed error information on failure.

import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  MetaCreateError,
  type CampaignObjective,
  type SpecialAdCategory,
  type OptimizationGoal,
  type BillingEvent,
  type AdSetTargeting,
  type AdStatus,
} from "./create";

// ── Launch payload ───────────────────────────────────────────────────────────

export interface LaunchPayload {
  // Campaign
  campaignName: string;
  objective: CampaignObjective;
  specialAdCategories: SpecialAdCategory[];
  campaignStatus: AdStatus;

  // Ad Set
  adSetName: string;
  optimizationGoal: OptimizationGoal;
  billingEvent: BillingEvent;
  dailyBudget: number; // in dollars (converted to cents internally)
  startTime?: string;
  endTime?: string;
  targeting: AdSetTargeting;
  pixelId?: string;
  conversionEvent?: string;

  // Ad Creative
  pageId: string;
  instagramAccountId?: string;
  primaryText: string;
  headline?: string;
  description?: string;
  ctaType: string;
  destinationUrl: string;
  mediaUrl?: string; // image or video thumbnail URL
  mediaType?: "image" | "video";

  // Ad
  adName: string;
  adStatus: AdStatus;

  // Meta connection
  adAccountId: string; // act_XXXXXXXXXX
  accessToken: string;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export function validateLaunchPayload(payload: LaunchPayload): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!payload.campaignName.trim()) errors.push({ field: "campaignName", message: "Campaign name is required" });
  if (!payload.adSetName.trim()) errors.push({ field: "adSetName", message: "Ad set name is required" });
  if (!payload.adName.trim()) errors.push({ field: "adName", message: "Ad name is required" });
  if (!payload.pageId) errors.push({ field: "pageId", message: "Facebook Page is required" });
  if (!payload.primaryText.trim()) errors.push({ field: "primaryText", message: "Primary text is required" });
  if (!payload.destinationUrl.trim()) errors.push({ field: "destinationUrl", message: "Destination URL is required" });
  if (!payload.adAccountId) errors.push({ field: "adAccountId", message: "Ad account is required" });
  if (!payload.accessToken) errors.push({ field: "accessToken", message: "Meta connection is required" });

  if (payload.dailyBudget < 1) errors.push({ field: "dailyBudget", message: "Daily budget must be at least $1" });

  if (payload.destinationUrl && !payload.destinationUrl.startsWith("http")) {
    errors.push({ field: "destinationUrl", message: "Destination URL must start with http:// or https://" });
  }

  // Sales/leads objective requires pixel
  if (
    (payload.objective === "OUTCOME_SALES" || payload.objective === "OUTCOME_LEADS") &&
    !payload.pixelId
  ) {
    errors.push({ field: "pixelId", message: "Pixel is required for Sales/Leads objectives" });
  }

  return errors;
}

// ── Launch result ────────────────────────────────────────────────────────────

export type LaunchStatus = "idle" | "validating" | "creating_campaign" | "creating_adset" | "creating_creative" | "creating_ad" | "success" | "failed";

export interface LaunchResult {
  status: LaunchStatus;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
  errors: Array<{ step: string; message: string; code?: number }>;
  startedAt: string;
  completedAt?: string;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function launchMetaCampaignFlow(payload: LaunchPayload): Promise<LaunchResult> {
  const result: LaunchResult = {
    status: "validating",
    errors: [],
    startedAt: new Date().toISOString(),
  };

  // 1. Validate
  const validationErrors = validateLaunchPayload(payload);
  if (validationErrors.length > 0) {
    result.status = "failed";
    result.errors = validationErrors.map((e) => ({ step: "validation", message: `${e.field}: ${e.message}` }));
    result.completedAt = new Date().toISOString();
    return result;
  }

  const budgetCents = Math.round(payload.dailyBudget * 100);

  try {
    // 2. Create Campaign (ABO — budget on ad set, not campaign)
    result.status = "creating_campaign";
    const campaign = await createCampaign(payload.adAccountId, payload.accessToken, {
      name: payload.campaignName,
      objective: payload.objective,
      status: payload.campaignStatus,
      special_ad_categories: payload.specialAdCategories?.length
        ? payload.specialAdCategories
        : ["NONE"],
    });
    result.campaignId = campaign.id;

    // 3. Create Ad Set (ABO — budget lives here)
    result.status = "creating_adset";
    // Extract advantage_audience from targeting (it's an ad set param, not a targeting field)
    const { advantage_audience, ...cleanTargeting } = payload.targeting as AdSetTargeting & { advantage_audience?: number };
    const adSet = await createAdSet(payload.adAccountId, payload.accessToken, {
      name: payload.adSetName,
      campaign_id: campaign.id,
      status: payload.adStatus,
      billing_event: payload.billingEvent,
      optimization_goal: payload.optimizationGoal,
      daily_budget: budgetCents,
      targeting: cleanTargeting,
      ...(payload.startTime ? { start_time: payload.startTime } : {}),
      ...(payload.endTime ? { end_time: payload.endTime } : {}),
      ...(payload.pixelId && payload.conversionEvent
        ? {
            promoted_object: {
              pixel_id: payload.pixelId,
              custom_event_type: payload.conversionEvent,
            },
          }
        : {}),
      ...(advantage_audience ? { targeting_automation: { advantage_audience } } : {}),
    });
    result.adSetId = adSet.id;

    // 4. Create Ad Creative
    result.status = "creating_creative";
    const creative = await createAdCreative(payload.adAccountId, payload.accessToken, {
      name: `${payload.adName} Creative`,
      object_story_spec: {
        page_id: payload.pageId,
        ...(payload.instagramAccountId
          ? { instagram_actor_id: payload.instagramAccountId }
          : {}),
        link_data: {
          link: payload.destinationUrl,
          message: payload.primaryText,
          ...(payload.headline ? { name: payload.headline } : {}),
          ...(payload.description ? { description: payload.description } : {}),
          call_to_action: {
            type: payload.ctaType,
            value: { link: payload.destinationUrl },
          },
          ...(payload.mediaUrl && payload.mediaType === "image"
            ? { picture: payload.mediaUrl }
            : {}),
        },
      },
    });
    result.creativeId = creative.id;

    // 5. Create Ad
    result.status = "creating_ad";
    const ad = await createAd(payload.adAccountId, payload.accessToken, {
      name: payload.adName,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: payload.adStatus,
    });
    result.adId = ad.id;

    // Success
    result.status = "success";
    result.completedAt = new Date().toISOString();
    return result;
  } catch (err) {
    const failedStep = result.status; // capture which step was running when error occurred
    result.status = "failed";
    result.completedAt = new Date().toISOString();

    if (err instanceof MetaCreateError) {
      console.error(`[meta/launch] Failed at step "${failedStep}":`, err.message, `(code: ${err.code}, subcode: ${err.subcode}, trace: ${err.fbtrace})`);
      result.errors.push({
        step: failedStep,
        message: `${failedStep}: ${err.message}`,
        code: err.code,
      });
    } else {
      console.error(`[meta/launch] Failed at step "${failedStep}":`, err);
      result.errors.push({
        step: failedStep,
        message: `${failedStep}: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
    return result;
  }
}
