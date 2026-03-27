// lib/meta/write.ts
// Write operations to the Meta Graph API.
// v1: campaign pause only. All writes are conservative and logged.
//
// IMPORTANT: This module makes real API calls to Meta Ads Manager.
// Only call from the auto-execution layer after all guardrails pass.

import { META_GRAPH_BASE } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetaWriteResult {
  success:    boolean;
  message:    string;
  apiResponse?: unknown;
}

// ---------------------------------------------------------------------------
// pauseMetaCampaign
// ---------------------------------------------------------------------------

/**
 * Pauses a Meta campaign by setting its status to PAUSED.
 * Uses the Meta Graph API v20.0 POST /{campaign-id} endpoint.
 *
 * Returns a typed result rather than throwing, so callers can log outcomes
 * without try/catch boilerplate.
 */
export async function pauseMetaCampaign(
  externalCampaignId: string,
  accessToken:        string
): Promise<MetaWriteResult> {
  const url = `${META_GRAPH_BASE}/${externalCampaignId}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        status:       "PAUSED",
        access_token: accessToken,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Network error calling Meta API: ${msg}`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorMsg =
      body && typeof body === "object" && "error" in body
        ? (body as { error: { message?: string } }).error?.message ?? response.statusText
        : response.statusText;

    return {
      success:     false,
      message:     `Meta API error ${response.status}: ${errorMsg}`,
      apiResponse: body,
    };
  }

  return {
    success:     true,
    message:     `Campaign ${externalCampaignId} paused successfully.`,
    apiResponse: body,
  };
}
