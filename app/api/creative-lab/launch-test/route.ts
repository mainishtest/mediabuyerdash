// app/api/creative-lab/launch-test/route.ts
// Creates a Facebook A/B test campaign from approved copy variations.
//
// Flow:
//   1. Upload image (if provided as URL) or use existing image hash
//   2. Create campaign (OUTCOME_TRAFFIC or OUTCOME_SALES)
//   3. Create ad set (budget, targeting, schedule)
//   4. Create ad creative + ad for each variation
//   5. Return created entity IDs
//
// Requires: ads_management scope on the Meta connection.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../lib/db";
import { META_GRAPH_BASE }           from "../../../../lib/meta/config";

export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LaunchVariation {
  title:        string;
  hook:         string;
  body:         string;
  callToAction: string;
  imageUrl?:    string; // Per-variation image (for image tests)
}

interface LaunchRequest {
  adAccountId:    string;   // e.g. "act_123456789"
  pageId:         string;   // Facebook Page ID
  campaignName:   string;
  objective:      string;   // OUTCOME_TRAFFIC, OUTCOME_SALES, OUTCOME_ENGAGEMENT
  dailyBudget:    number;   // in dollars (will be converted to cents)
  startDate?:     string;   // ISO string, defaults to now
  endDate?:       string;   // ISO string, optional
  destinationUrl: string;
  pixelId?:       string;
  optimizationGoal?: string; // LINK_CLICKS, LANDING_PAGE_VIEWS, OFFSITE_CONVERSIONS
  billingEvent?:  string;   // IMPRESSIONS, LINK_CLICKS
  // Targeting
  targetCountries: string[];   // e.g. ["US"]
  targetAgeMin?:   number;
  targetAgeMax?:   number;
  targetGenders?:  number[];   // 0=all, 1=male, 2=female
  targetInterests?: Array<{ id: string; name: string }>;
  // Creative
  headline?:      string;   // Ad headline (shown below image in link ads)
  imageUrl?:      string;   // URL to upload as ad image
  imageHash?:     string;   // Existing image hash (skip upload)
  variations:     LaunchVariation[];
  // UTMs
  clientAccountId?: string; // To load UTM defaults from client settings
  utmSource?:     string;
  utmMedium?:     string;
  utmCampaign?:   string;
  utmContent?:    string;
  utmTerm?:       string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: LaunchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const {
    adAccountId, pageId, campaignName, objective, dailyBudget,
    startDate, endDate, destinationUrl, pixelId,
    optimizationGoal = "LINK_CLICKS",
    billingEvent = "IMPRESSIONS",
    targetCountries, targetAgeMin = 18, targetAgeMax = 65,
    targetGenders = [0], targetInterests,
    imageUrl, imageHash, variations, headline,
    clientAccountId,
    utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
  } = body;

  if (!adAccountId || !pageId || !campaignName || !destinationUrl || !variations?.length) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: adAccountId, pageId, campaignName, destinationUrl, variations" },
      { status: 400 },
    );
  }

  // Get access token from the Meta connection
  const connection = await prisma.metaConnection.findFirst({
    where: { connectionStatus: "active" },
    select: { accessToken: true },
  });

  if (!connection?.accessToken) {
    return NextResponse.json(
      { ok: false, error: "No active Meta connection found. Connect your Meta account first." },
      { status: 400 },
    );
  }

  const token = connection.accessToken;

  // ── Load UTM defaults from client settings if not provided ──────────────
  let finalUtmSource   = utmSource   ?? null;
  let finalUtmMedium   = utmMedium   ?? null;
  let finalUtmCampaign = utmCampaign ?? null;
  let finalUtmContent  = utmContent  ?? null;
  let finalUtmTerm     = utmTerm     ?? null;

  if (clientAccountId && (!finalUtmSource && !finalUtmMedium)) {
    const clientDefaults = await prisma.clientAccount.findUnique({
      where: { id: clientAccountId },
      select: {
        defaultUtmSource: true, defaultUtmMedium: true, defaultUtmCampaign: true,
        defaultUtmContent: true, defaultUtmTerm: true,
      },
    });
    if (clientDefaults) {
      finalUtmSource   = finalUtmSource   ?? clientDefaults.defaultUtmSource;
      finalUtmMedium   = finalUtmMedium   ?? clientDefaults.defaultUtmMedium;
      finalUtmCampaign = finalUtmCampaign ?? clientDefaults.defaultUtmCampaign;
      finalUtmContent  = finalUtmContent  ?? clientDefaults.defaultUtmContent;
      finalUtmTerm     = finalUtmTerm     ?? clientDefaults.defaultUtmTerm;
    }
  }

  // Build destination URL with UTM parameters
  function buildUrlWithUtms(baseUrl: string, variationTitle?: string): string {
    try {
      const url = new URL(baseUrl);
      if (finalUtmSource)   url.searchParams.set("utm_source", finalUtmSource);
      if (finalUtmMedium)   url.searchParams.set("utm_medium", finalUtmMedium);
      if (finalUtmCampaign) url.searchParams.set("utm_campaign", finalUtmCampaign.replace("{{campaign.name}}", campaignName));
      if (finalUtmContent)  url.searchParams.set("utm_content", finalUtmContent.replace("{{ad.name}}", variationTitle ?? ""));
      if (finalUtmTerm)     url.searchParams.set("utm_term", finalUtmTerm);
      return url.toString();
    } catch {
      return baseUrl;
    }
  }

  const results: {
    campaignId?: string;
    adSetId?: string;
    ads: Array<{ adId: string; creativeId: string; title: string }>;
    errors: string[];
  } = { ads: [], errors: [] };

  try {
    // ── 0. Get Page Access Token ──────────────────────────────────────────
    // User tokens can't create ad creatives that reference a Page.
    // We need a Page Access Token for the object_story_spec.
    let pageAccessToken: string | null = null;
    if (pageId) {
      try {
        // First try: get Page token via /me/accounts (list of pages the user manages)
        const pagesRes = await fetch(
          `${META_GRAPH_BASE}/me/accounts?access_token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const pagesData = await pagesRes.json().catch(() => ({})) as { data?: Array<{ id: string; access_token?: string; name?: string }> };
        const matchedPage = pagesData.data?.find((p) => p.id === pageId);

        if (matchedPage?.access_token) {
          pageAccessToken = matchedPage.access_token;
        } else {
          // Second try: direct page token fetch
          const pageTokenRes = await fetch(
            `${META_GRAPH_BASE}/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`,
            { cache: "no-store" },
          );
          const pageTokenData = await pageTokenRes.json().catch(() => ({})) as Record<string, unknown>;
          if (pageTokenData.access_token) {
            pageAccessToken = pageTokenData.access_token as string;
          } else {
            const availablePages = pagesData.data?.map((p) => `${p.name} (${p.id})`).join(", ") || "none found";
            results.errors.push(
              `Could not get Page access token for Page ID ${pageId}. ` +
              `Available pages on your token: ${availablePages}. ` +
              `Make sure this Page is added to your Business Manager and you have Content + Ads permissions on it.`
            );
          }
        }
      } catch (err) {
        results.errors.push(`Failed to fetch Page access token: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // ── 1. Upload image if needed ────────────────────────────────────────
    let finalImageHash = imageHash ?? null;
    if (!finalImageHash && imageUrl) {
      try {
        const imgRes = await metaPost(`${adAccountId}/adimages`, token, {
          url: imageUrl,
        });
        if (imgRes.error) {
          // Image upload failed — continue without image, don't abort the launch
          results.errors.push(`Image upload failed: ${imgRes.error}`);
        } else {
          // Response: { images: { bytes: { hash: "abc123" } } }
          const images = imgRes.data?.images;
          if (images && typeof images === "object") {
            const firstKey = Object.keys(images)[0];
            finalImageHash = (images as Record<string, { hash?: string }>)[firstKey]?.hash ?? null;
          }
          if (!finalImageHash) {
            results.errors.push("Image uploaded but no hash returned — ads will be created without image");
          }
        }
      } catch (err) {
        results.errors.push(`Image upload error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── 2. Create campaign ───────────────────────────────────────────────
    const campaignRes = await metaPost(`${adAccountId}/campaigns`, token, {
      name:              campaignName,
      objective:         objective || "OUTCOME_TRAFFIC",
      status:            "PAUSED",
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    });
    if (campaignRes.error) {
      return NextResponse.json({
        ok: false,
        error: `Campaign creation failed: ${campaignRes.error}`,
        debug: { objective, campaignName, adAccountId },
      }, { status: 500 });
    }
    results.campaignId = campaignRes.data?.id as string | undefined;

    // ── 3. Create ad set ─────────────────────────────────────────────────
    const targeting: Record<string, unknown> = {
      geo_locations: { countries: targetCountries?.length ? targetCountries : ["US"] },
      age_min: targetAgeMin,
      age_max: targetAgeMax,
      targeting_automation: { advantage_audience: 0 },
    };
    if (targetGenders && targetGenders[0] !== 0) {
      targeting.genders = targetGenders;
    }
    if (targetInterests?.length) {
      targeting.flexible_spec = [{ interests: targetInterests }];
    }

    const adSetData: Record<string, unknown> = {
      name:               `${campaignName} — Test Ad Set`,
      campaign_id:        results.campaignId,
      daily_budget:       Math.round(dailyBudget * 100), // cents
      billing_event:      billingEvent,
      optimization_goal:  optimizationGoal,
      bid_strategy:       "LOWEST_COST_WITHOUT_CAP",
      targeting,
      status:             "PAUSED",
    };
    if (startDate) adSetData.start_time = startDate;
    if (endDate)   adSetData.end_time   = endDate;
    if (pixelId && optimizationGoal === "OFFSITE_CONVERSIONS") {
      adSetData.promoted_object = { pixel_id: pixelId, custom_event_type: "PURCHASE" };
    }

    const adSetRes = await metaPost(`${adAccountId}/adsets`, token, adSetData);
    if (adSetRes.error) {
      results.errors.push(`Ad set creation failed: ${adSetRes.error}`);
      return NextResponse.json({ ok: false, ...results, error: results.errors.join("; ") }, { status: 500 });
    }
    results.adSetId = adSetRes.data?.id as string | undefined;

    // ── 4. Create ad creative + ad for each variation ────────────────────
    for (const variation of variations) {
      try {
        // Upload per-variation image if provided (for image tests)
        let variationImageHash = finalImageHash;
        if (variation.imageUrl && !variationImageHash) {
          try {
            const varImgRes = await metaPost(`${adAccountId}/adimages`, token, {
              url: variation.imageUrl,
            });
            if (!varImgRes.error) {
              const imgs = varImgRes.data?.images;
              if (imgs && typeof imgs === "object") {
                const firstKey = Object.keys(imgs)[0];
                variationImageHash = (imgs as Record<string, { hash?: string }>)[firstKey]?.hash ?? null;
              }
            } else {
              results.errors.push(`Image upload for "${variation.title}" failed: ${varImgRes.error}`);
            }
          } catch {
            results.errors.push(`Image upload for "${variation.title}" failed`);
          }
        }

        // Build the object_story_spec
        const adUrl = buildUrlWithUtms(destinationUrl, variation.title);
        const storySpec: Record<string, unknown> = {
          page_id: pageId,
          link_data: {
            link:            adUrl,
            message:         `${variation.hook}\n\n${variation.body}`,
            name:            headline || variation.title,
            call_to_action:  { type: mapCtaType(variation.callToAction), value: { link: adUrl } },
            ...(variationImageHash ? { image_hash: variationImageHash } : {}),
          },
        };

        // Use Page Access Token for creative creation (required for object_story_spec)
        const creativeToken = pageAccessToken ?? token;
        const creativeRes = await metaPost(`${adAccountId}/adcreatives`, creativeToken, {
          name:               `${campaignName} — ${variation.title}`,
          object_story_spec:  storySpec,
        });

        if (creativeRes.error) {
          results.errors.push(`Creative "${variation.title}" failed: ${creativeRes.error}`);
          continue;
        }

        const creativeId = creativeRes.data?.id as string | undefined;

        // Create the ad
        const adRes = await metaPost(`${adAccountId}/ads`, token, {
          name:        `${campaignName} — ${variation.title}`,
          adset_id:    results.adSetId,
          creative:    { creative_id: creativeId },
          status:      "PAUSED",
        });

        if (adRes.error) {
          results.errors.push(`Ad "${variation.title}" failed: ${adRes.error}`);
          continue;
        }

        results.ads.push({
          adId:       (adRes.data?.id as string) ?? "",
          creativeId: creativeId ?? "",
          title:      variation.title,
        });
      } catch (err) {
        results.errors.push(`"${variation.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      ...results,
      summary: `Created campaign "${campaignName}" with ${results.ads.length} ad(s). Status: PAUSED — review in Ads Manager and activate when ready.`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      ...results,
      error: `Launch failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Meta API helper
// ---------------------------------------------------------------------------

async function metaPost(
  endpoint: string,
  accessToken: string,
  data: Record<string, unknown>,
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const url = `${META_GRAPH_BASE}/${endpoint}`;
  const params = new URLSearchParams();
  params.set("access_token", accessToken);

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      params.set(key, value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      params.set(key, String(value));
    } else {
      // Arrays and objects — JSON stringify
      params.set(key, JSON.stringify(value));
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errObj = json?.error;
    const msg = errObj?.error_user_msg ?? errObj?.message ?? `HTTP ${res.status}`;
    const detail = errObj?.error_data ? ` (${JSON.stringify(errObj.error_data)})` : "";
    const subcode = errObj?.error_subcode ? ` [subcode: ${errObj.error_subcode}]` : "";
    const type = errObj?.type ? ` [${errObj.type}]` : "";
    return { error: `${msg}${detail}${subcode}${type}` };
  }

  return { data: json };
}

// ---------------------------------------------------------------------------
// CTA type mapper
// ---------------------------------------------------------------------------

function mapCtaType(ctaText: string): string {
  const normalized = ctaText.toLowerCase().replace(/[^a-z ]/g, "").trim();
  const map: Record<string, string> = {
    "shop now":     "SHOP_NOW",
    "learn more":   "LEARN_MORE",
    "sign up":      "SIGN_UP",
    "buy now":      "BUY_NOW",
    "get offer":    "GET_OFFER",
    "try it now":   "LEARN_MORE",
    "get yours":    "SHOP_NOW",
    "get yours today": "SHOP_NOW",
    "try it":       "LEARN_MORE",
    "order now":    "SHOP_NOW",
    "subscribe":    "SUBSCRIBE",
    "contact us":   "CONTACT_US",
    "download":     "DOWNLOAD",
    "book now":     "BOOK_TRAVEL",
    "watch more":   "WATCH_MORE",
    "join them now": "SIGN_UP",
  };
  return map[normalized] ?? "LEARN_MORE";
}
