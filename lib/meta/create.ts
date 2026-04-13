// Meta Ads API — Campaign Creation (Write Operations)
//
// Creates campaigns, ad sets, ad creatives, and ads via the Graph API.
// All functions require an access token and ad account ID.
// Follows the same patterns as api.ts (raw fetch, typed responses).

import { META_GRAPH_BASE } from "./config";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface MetaCreateResult {
  id: string;
}

export type CampaignObjective =
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_APP_PROMOTION";

export type SpecialAdCategory =
  | "NONE"
  | "CREDIT"
  | "EMPLOYMENT"
  | "HOUSING"
  | "SOCIAL_ISSUES_ELECTIONS_POLITICS";

export type BillingEvent = "IMPRESSIONS" | "LINK_CLICKS" | "APP_INSTALLS";

export type OptimizationGoal =
  | "OFFSITE_CONVERSIONS"
  | "LANDING_PAGE_VIEWS"
  | "LINK_CLICKS"
  | "IMPRESSIONS"
  | "REACH"
  | "LEAD_GENERATION"
  | "VALUE";

export type AdStatus = "ACTIVE" | "PAUSED";

export interface CampaignCreateParams {
  name: string;
  objective: CampaignObjective;
  status: AdStatus;
  special_ad_categories: SpecialAdCategory[];
  daily_budget?: number; // in cents
  lifetime_budget?: number; // in cents
  buying_type?: "AUCTION" | "RESERVED";
}

export interface AdSetCreateParams {
  name: string;
  campaign_id: string;
  status: AdStatus;
  billing_event: BillingEvent;
  optimization_goal: OptimizationGoal;
  daily_budget?: number; // in cents (if not set at campaign level)
  bid_amount?: number; // in cents
  start_time?: string; // ISO 8601
  end_time?: string; // ISO 8601
  targeting: AdSetTargeting;
  promoted_object?: {
    pixel_id?: string;
    custom_event_type?: string;
    page_id?: string;
    application_id?: string;
  };
}

export interface AdSetTargeting {
  geo_locations?: {
    countries?: string[];
    regions?: Array<{ key: string }>;
    cities?: Array<{ key: string; radius?: number; distance_unit?: string }>;
  };
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 0 = all, 1 = male, 2 = female
  targeting_optimization?: string;
  advantage_audience?: number; // 1 = on
}

export interface AdCreativeCreateParams {
  name: string;
  object_story_spec: {
    page_id: string;
    instagram_actor_id?: string;
    link_data?: {
      link: string;
      message: string;
      name?: string; // headline
      description?: string;
      call_to_action?: {
        type: string;
        value?: { link?: string };
      };
      image_hash?: string;
      picture?: string; // image URL fallback
    };
    video_data?: {
      video_id?: string;
      image_url?: string; // thumbnail
      title?: string;
      message?: string;
      call_to_action?: {
        type: string;
        value?: { link?: string };
      };
    };
  };
  degrees_of_freedom_spec?: {
    creative_features_spec?: {
      standard_enhancements?: { enroll_status: "OPT_IN" | "OPT_OUT" };
    };
  };
}

export interface AdCreateParams {
  name: string;
  adset_id: string;
  creative: { creative_id: string };
  status: AdStatus;
  tracking_specs?: Array<{
    action_type: string[];
    fb_pixel?: string[];
  }>;
}

// ── Core POST helper ─────────────────────────────────────────────────────────

async function metaPost<T = MetaCreateResult>(
  endpoint: string,
  accessToken: string,
  params: Record<string, unknown>
): Promise<T> {
  const url = `${META_GRAPH_BASE}/${endpoint}`;

  const body = new URLSearchParams();
  body.append("access_token", accessToken);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    body.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok) {
    const err = (json as { error?: MetaApiError }).error;
    // Log full error + params for debugging (redact access_token)
    const debugParams = Object.fromEntries(
      Object.entries(params).filter(([k]) => k !== "access_token")
    );
    console.error(`[meta/create] POST ${endpoint} failed:`, JSON.stringify(err, null, 2));
    console.error(`[meta/create] Params sent:`, JSON.stringify(debugParams, null, 2));
    throw new MetaCreateError(
      err?.message ?? `Meta API ${res.status}`,
      err?.code ?? res.status,
      err?.error_subcode,
      err?.fbtrace_id
    );
  }

  return json as T;
}

export class MetaCreateError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly subcode?: number,
    public readonly fbtrace?: string
  ) {
    super(message);
    this.name = "MetaCreateError";
  }
}

// ── Campaign CRUD ────────────────────────────────────────────────────────────

export async function createCampaign(
  adAccountId: string,
  accessToken: string,
  params: CampaignCreateParams
): Promise<MetaCreateResult> {
  return metaPost(`${adAccountId}/campaigns`, accessToken, {
    name: params.name,
    objective: params.objective,
    status: params.status,
    special_ad_categories: params.special_ad_categories,
    ...(params.daily_budget != null ? { daily_budget: params.daily_budget } : {}),
    ...(params.lifetime_budget != null ? { lifetime_budget: params.lifetime_budget } : {}),
    buying_type: params.buying_type ?? "AUCTION",
  });
}

// ── Ad Set CRUD ──────────────────────────────────────────────────────────────

export async function createAdSet(
  adAccountId: string,
  accessToken: string,
  params: AdSetCreateParams
): Promise<MetaCreateResult> {
  return metaPost(`${adAccountId}/adsets`, accessToken, {
    name: params.name,
    campaign_id: params.campaign_id,
    status: params.status,
    billing_event: params.billing_event,
    optimization_goal: params.optimization_goal,
    ...(params.daily_budget != null ? { daily_budget: params.daily_budget } : {}),
    ...(params.bid_amount != null ? { bid_amount: params.bid_amount } : {}),
    ...(params.start_time ? { start_time: params.start_time } : {}),
    ...(params.end_time ? { end_time: params.end_time } : {}),
    targeting: params.targeting,
    ...(params.promoted_object ? { promoted_object: params.promoted_object } : {}),
  });
}

// ── Ad Creative CRUD ─────────────────────────────────────────────────────────

export async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  params: AdCreativeCreateParams
): Promise<MetaCreateResult> {
  return metaPost(`${adAccountId}/adcreatives`, accessToken, {
    name: params.name,
    object_story_spec: params.object_story_spec,
    ...(params.degrees_of_freedom_spec
      ? { degrees_of_freedom_spec: params.degrees_of_freedom_spec }
      : {}),
  });
}

// ── Ad CRUD ──────────────────────────────────────────────────────────────────

export async function createAd(
  adAccountId: string,
  accessToken: string,
  params: AdCreateParams
): Promise<MetaCreateResult> {
  return metaPost(`${adAccountId}/ads`, accessToken, {
    name: params.name,
    adset_id: params.adset_id,
    creative: params.creative,
    status: params.status,
    ...(params.tracking_specs ? { tracking_specs: params.tracking_specs } : {}),
  });
}

// ── Image upload (for ad creative) ───────────────────────────────────────────

export async function uploadAdImage(
  adAccountId: string,
  accessToken: string,
  imageUrl: string,
  name?: string
): Promise<{ hash: string; url: string }> {
  // Meta accepts image URLs directly via the url parameter
  const result = await metaPost<{
    images: Record<string, { hash: string; url: string }>;
  }>(`${adAccountId}/adimages`, accessToken, {
    url: imageUrl,
    name: name ?? "ad_image",
  });

  const firstKey = Object.keys(result.images)[0];
  return result.images[firstKey];
}
