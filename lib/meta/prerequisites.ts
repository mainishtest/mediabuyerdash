// Meta Ads — Launch Prerequisites Fetcher
//
// Fetches Facebook Pages, Instagram accounts, Pixels, and other
// resources needed before launching a campaign.

import { META_GRAPH_BASE } from "./config";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MetaPage {
  id: string;
  name: string;
  access_token?: string;
  picture?: { data?: { url?: string } };
}

export interface MetaInstagramAccount {
  id: string;
  username: string;
  profile_picture_url?: string;
}

export interface MetaPixel {
  id: string;
  name: string;
  last_fired_time?: string;
}

export interface MetaConversionEvent {
  event_name: string;
  description?: string;
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

/** Fetch Facebook Pages the user manages (needed for ad creative) */
export async function fetchPages(accessToken: string): Promise<MetaPage[]> {
  const url = `${META_GRAPH_BASE}/me/accounts?fields=id,name,picture&limit=100&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch Pages: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = await res.json() as { data: MetaPage[] };
  return json.data ?? [];
}

/** Fetch Instagram Business accounts connected to the user's pages */
export async function fetchInstagramAccounts(
  pageId: string,
  accessToken: string
): Promise<MetaInstagramAccount[]> {
  const url = `${META_GRAPH_BASE}/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json() as { instagram_business_account?: MetaInstagramAccount };
  return json.instagram_business_account ? [json.instagram_business_account] : [];
}

/** Fetch Pixels (datasets) for an ad account */
export async function fetchPixels(
  adAccountId: string,
  accessToken: string
): Promise<MetaPixel[]> {
  const url = `${META_GRAPH_BASE}/${adAccountId}/adspixels?fields=id,name,last_fired_time&limit=50&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json() as { data: MetaPixel[] };
  return json.data ?? [];
}

/** Standard Meta conversion events */
export function getStandardConversionEvents(): MetaConversionEvent[] {
  return [
    { event_name: "PURCHASE", description: "Purchase" },
    { event_name: "LEAD", description: "Lead" },
    { event_name: "COMPLETE_REGISTRATION", description: "Complete Registration" },
    { event_name: "ADD_TO_CART", description: "Add to Cart" },
    { event_name: "INITIATED_CHECKOUT", description: "Initiate Checkout" },
    { event_name: "ADD_PAYMENT_INFO", description: "Add Payment Info" },
    { event_name: "CONTENT_VIEW", description: "View Content" },
    { event_name: "SEARCH", description: "Search" },
    { event_name: "SUBSCRIBE", description: "Subscribe" },
    { event_name: "START_TRIAL", description: "Start Trial" },
    { event_name: "CONTACT", description: "Contact" },
    { event_name: "SCHEDULE", description: "Schedule" },
  ];
}

/** Campaign objectives with labels */
export function getCampaignObjectives() {
  return [
    { value: "OUTCOME_SALES",          label: "Sales",           description: "Drive purchases or conversions" },
    { value: "OUTCOME_LEADS",          label: "Leads",           description: "Generate leads for your business" },
    { value: "OUTCOME_TRAFFIC",        label: "Traffic",         description: "Drive traffic to your website" },
    { value: "OUTCOME_ENGAGEMENT",     label: "Engagement",      description: "Get more engagement on posts" },
    { value: "OUTCOME_AWARENESS",      label: "Awareness",       description: "Reach people likely to remember" },
    { value: "OUTCOME_APP_PROMOTION",  label: "App Promotion",   description: "Drive app installs" },
  ] as const;
}

/** CTA types with labels */
export function getCtaTypes() {
  return [
    { value: "SHOP_NOW",       label: "Shop Now" },
    { value: "LEARN_MORE",     label: "Learn More" },
    { value: "SIGN_UP",        label: "Sign Up" },
    { value: "BUY_NOW",        label: "Buy Now" },
    { value: "BOOK_TRAVEL",    label: "Book Now" },
    { value: "CONTACT_US",     label: "Contact Us" },
    { value: "DOWNLOAD",       label: "Download" },
    { value: "GET_OFFER",      label: "Get Offer" },
    { value: "GET_QUOTE",      label: "Get Quote" },
    { value: "SUBSCRIBE",      label: "Subscribe" },
    { value: "WATCH_MORE",     label: "Watch More" },
    { value: "APPLY_NOW",      label: "Apply Now" },
    { value: "ORDER_NOW",      label: "Order Now" },
    { value: "NO_BUTTON",      label: "No Button" },
  ] as const;
}

/** Fetch all prerequisites for launching: pages, pixels, IG accounts */
export async function fetchLaunchPrerequisites(
  adAccountId: string,
  accessToken: string
) {
  const [pages, pixels] = await Promise.all([
    fetchPages(accessToken),
    fetchPixels(adAccountId, accessToken),
  ]);

  // Fetch IG accounts for first page (most common case)
  let instagramAccounts: MetaInstagramAccount[] = [];
  if (pages.length > 0) {
    instagramAccounts = await fetchInstagramAccounts(pages[0].id, accessToken);
  }

  return {
    pages,
    pixels,
    instagramAccounts,
    objectives: getCampaignObjectives(),
    conversionEvents: getStandardConversionEvents(),
    ctaTypes: getCtaTypes(),
  };
}
