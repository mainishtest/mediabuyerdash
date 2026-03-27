// lib/publishExecution/metaLaunch.ts
// Meta execution bridge — converts a validated PublishPayload into a Meta
// ad creative + ad API call, or structures a payload for manual entry.
//
// Architecture rules:
//   - Separated from publish prep (no imports from lib/publishPrep).
//   - Execution only fires after all required guardrails pass in the caller.
//   - Returns a typed MetaLaunchResult; never throws.
//   - All writes are conservative: attempt creative first, then ad.
//   - manual_publish mode never calls Meta — returns structured payload only.
//   - guarded_publish mode calls Meta Graph API (requires valid access token).
//   - On any API failure the result is returned with success:false + details.
//
// Current Meta Marketing API endpoints used:
//   POST /{ad-account-id}/adcreatives  — creates the ad creative
//   POST /{ad-account-id}/ads          — creates the ad inside the ad set
//
// The caller (PATCH /api/creative-lab/publish-prep/[id]) is responsible for:
//   1. Verifying canProceedToLaunch() before calling attemptMetaLaunch().
//   2. Updating PublishPrepRecord status based on the returned result.

import { META_GRAPH_BASE } from "../meta/config";
import type { PublishPayload } from "../../types/publishPrep";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type MetaLaunchMode = "manual_publish" | "guarded_publish";

export type MetaLaunchResult = {
  success:          boolean;
  mode:             MetaLaunchMode;
  message:          string;
  // Filled on guarded_publish success
  metaCreativeId?:  string;
  metaAdId?:        string;
  // Filled on any mode — the payload submitted (or would be submitted)
  payloadSubmitted: MetaAdCreativePayload;
  // Filled on failure
  errorCode?:       string;
  errorDetail?:     string;
  apiResponse?:     unknown;
};

// ---------------------------------------------------------------------------
// Meta API request shapes
// ---------------------------------------------------------------------------

// The shape sent to Meta POST /{ad-account-id}/adcreatives
export type MetaAdCreativePayload = {
  name:          string;
  object_story_spec: {
    page_id?: string;
    link_data?: {
      message:     string | null;
      link:        string | null;
      name:        string | null;        // headline
      description: string | null;
      call_to_action: {
        type:  string;                   // e.g. SHOP_NOW
        value?: { link: string | null };
      };
    };
  };
  // access_token appended at call time — not stored in this shape
};

// The shape sent to Meta POST /{ad-account-id}/ads
type MetaAdPayload = {
  name:       string;
  adset_id:   string;
  creative:   { creative_id: string };
  status:     "PAUSED";               // always PAUSED — human enables after review
};

// ---------------------------------------------------------------------------
// buildMetaAdCreativePayload
// Converts a PublishPayload → Meta API adcreative request shape.
// Pure function — no side effects.
// ---------------------------------------------------------------------------

export function buildMetaAdCreativePayload(
  payload: PublishPayload,
): MetaAdCreativePayload {
  const p = payload.payloadPreview;
  const m = p.metaPayloadShape;

  const ctaType   = m.ctaType ?? "LEARN_MORE";
  const adMessage = m.adMessage ?? m.adDescription ?? "";
  const headline  = m.adHeadline  ?? p.variantTitle;

  return {
    name: `[Prep ${payload.prepItemId}] ${p.variantTitle}`,
    object_story_spec: {
      link_data: {
        message:     adMessage,
        link:        m.destinationUrl,
        name:        headline,
        description: m.adDescription,
        call_to_action: {
          type:  ctaType,
          value: { link: m.destinationUrl },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Internal: callMetaCreateCreative
// POST /{ad-account-id}/adcreatives
// ---------------------------------------------------------------------------

async function callMetaCreateCreative(
  adAccountId:  string,
  accessToken:  string,
  creativeBody: MetaAdCreativePayload,
): Promise<{ success: boolean; creativeId?: string; error?: string; apiResponse?: unknown }> {
  const url = `${META_GRAPH_BASE}/act_${adAccountId.replace(/^act_/, "")}/adcreatives`;
  let response: Response;

  try {
    response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...creativeBody, access_token: accessToken }),
    });
  } catch (err) {
    return {
      success: false,
      error:   `Network error calling Meta adcreatives: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: unknown;
  try { body = await response.json(); } catch { body = null; }

  if (!response.ok) {
    const errorMsg = extractMetaErrorMessage(body, response.statusText);
    return { success: false, error: `Meta API ${response.status}: ${errorMsg}`, apiResponse: body };
  }

  const id = (body as { id?: string })?.id;
  if (!id) {
    return { success: false, error: "Meta adcreatives response missing id field.", apiResponse: body };
  }

  return { success: true, creativeId: id, apiResponse: body };
}

// ---------------------------------------------------------------------------
// Internal: callMetaCreateAd
// POST /{ad-account-id}/ads  — always PAUSED; human activates in Ads Manager
// ---------------------------------------------------------------------------

async function callMetaCreateAd(
  adAccountId: string,
  accessToken: string,
  adPayload:   MetaAdPayload,
): Promise<{ success: boolean; adId?: string; error?: string; apiResponse?: unknown }> {
  const url = `${META_GRAPH_BASE}/act_${adAccountId.replace(/^act_/, "")}/ads`;
  let response: Response;

  try {
    response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...adPayload, access_token: accessToken }),
    });
  } catch (err) {
    return {
      success: false,
      error:   `Network error calling Meta ads: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: unknown;
  try { body = await response.json(); } catch { body = null; }

  if (!response.ok) {
    const errorMsg = extractMetaErrorMessage(body, response.statusText);
    return { success: false, error: `Meta API ${response.status}: ${errorMsg}`, apiResponse: body };
  }

  const id = (body as { id?: string })?.id;
  if (!id) {
    return { success: false, error: "Meta ads response missing id field.", apiResponse: body };
  }

  return { success: true, adId: id, apiResponse: body };
}

// ---------------------------------------------------------------------------
// Internal: extractMetaErrorMessage
// ---------------------------------------------------------------------------

function extractMetaErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: { message?: string } }).error;
    return err?.message ?? fallback;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Public API: attemptMetaLaunch
//
// Routes to manual or guarded execution based on payload.executionMode.
//
// manual_publish — no Meta API call; returns structured payload for human entry.
// guarded_publish — calls Meta API; requires accessToken + adAccountId.
//
// The caller is responsible for ensuring canProceedToLaunch() returned true
// before calling this function. The function re-validates the payload object
// but does not re-evaluate guardrails (that is the caller's responsibility).
// ---------------------------------------------------------------------------

export async function attemptMetaLaunch(opts: {
  payload:       PublishPayload;
  accessToken?:  string;   // required for guarded_publish
  adAccountId?:  string;   // Meta ad account id (e.g. "act_12345")
}): Promise<MetaLaunchResult> {
  const { payload, accessToken, adAccountId } = opts;
  const creativePayload = buildMetaAdCreativePayload(payload);

  // ── Validate payload structure before any I/O ──────────────────────────────

  const missingFields: string[] = [];
  if (!payload.prepItemId)         missingFields.push("prepItemId");
  if (!payload.clientAccountId)    missingFields.push("clientAccountId");
  if (!payload.payloadPreview)     missingFields.push("payloadPreview");
  if (!payload.validation?.passed) missingFields.push("validation.passed");
  if (!payload.isLaunchReady)      missingFields.push("isLaunchReady");

  if (missingFields.length > 0) {
    return {
      success:          false,
      mode:             payload.executionMode,
      message:          `Launch aborted — invalid payload. Missing: ${missingFields.join(", ")}.`,
      payloadSubmitted: creativePayload,
      errorCode:        "INVALID_PAYLOAD",
      errorDetail:      `Fields missing or invalid: ${missingFields.join(", ")}`,
    };
  }

  // ── manual_publish — no Meta API call ─────────────────────────────────────

  if (payload.executionMode === "manual_publish") {
    return {
      success:          true,
      mode:             "manual_publish",
      message:          "Payload assembled for manual entry in Meta Ads Manager. No API call was made.",
      payloadSubmitted: creativePayload,
    };
  }

  // ── guarded_publish — call Meta API ───────────────────────────────────────

  if (!accessToken) {
    return {
      success:          false,
      mode:             "guarded_publish",
      message:          "Guarded publish aborted — no Meta access token available.",
      payloadSubmitted: creativePayload,
      errorCode:        "NO_ACCESS_TOKEN",
      errorDetail:      "A valid Meta access token is required for guarded_publish execution.",
    };
  }

  if (!adAccountId) {
    return {
      success:          false,
      mode:             "guarded_publish",
      message:          "Guarded publish aborted — no Meta ad account ID provided.",
      payloadSubmitted: creativePayload,
      errorCode:        "NO_AD_ACCOUNT",
      errorDetail:      "An ad account ID is required to create the ad creative.",
    };
  }

  const mapping = payload.payloadPreview.targetMapping;
  if (!mapping.targetAdSetExternalId) {
    return {
      success:          false,
      mode:             "guarded_publish",
      message:          "Guarded publish aborted — target ad set external ID is missing.",
      payloadSubmitted: creativePayload,
      errorCode:        "MISSING_AD_SET_ID",
      errorDetail:      "targetAdSetExternalId must be set for guarded_publish execution.",
    };
  }

  // Step 1: Create ad creative
  const creativeResult = await callMetaCreateCreative(adAccountId, accessToken, creativePayload);

  if (!creativeResult.success || !creativeResult.creativeId) {
    return {
      success:          false,
      mode:             "guarded_publish",
      message:          `Meta ad creative creation failed: ${creativeResult.error ?? "unknown error"}`,
      payloadSubmitted: creativePayload,
      errorCode:        "META_CREATIVE_FAILED",
      errorDetail:      creativeResult.error,
      apiResponse:      creativeResult.apiResponse,
    };
  }

  // Step 2: Create ad (PAUSED — human enables in Meta Ads Manager)
  const adPayload: MetaAdPayload = {
    name:     `[Prep ${payload.prepItemId}] ${payload.payloadPreview.variantTitle}`,
    adset_id: mapping.targetAdSetExternalId,
    creative: { creative_id: creativeResult.creativeId },
    status:   "PAUSED",
  };

  const adResult = await callMetaCreateAd(adAccountId, accessToken, adPayload);

  if (!adResult.success || !adResult.adId) {
    return {
      success:          false,
      mode:             "guarded_publish",
      message:          `Meta ad creation failed: ${adResult.error ?? "unknown error"}. Creative was created (${creativeResult.creativeId}) but ad creation failed.`,
      payloadSubmitted: creativePayload,
      metaCreativeId:   creativeResult.creativeId,
      errorCode:        "META_AD_FAILED",
      errorDetail:      adResult.error,
      apiResponse:      adResult.apiResponse,
    };
  }

  return {
    success:          true,
    mode:             "guarded_publish",
    message:          `Ad created in Meta Ads Manager (PAUSED). Enable in Ads Manager when ready. Creative: ${creativeResult.creativeId} | Ad: ${adResult.adId}`,
    payloadSubmitted: creativePayload,
    metaCreativeId:   creativeResult.creativeId,
    metaAdId:         adResult.adId,
    apiResponse:      adResult.apiResponse,
  };
}
