import { META_GRAPH_BASE } from "./config";

// ── Paged fetcher ─────────────────────────────────────────────────────────────

async function fetchAllPages<T>(
  url: string,
  accessToken: string,
  maxPages = 20
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null =
    `${url}&access_token=${encodeURIComponent(accessToken)}`;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Meta API ${res.status}: ${JSON.stringify(body)}`);
    }
    const json = (await res.json()) as {
      data: T[];
      paging?: { next?: string };
    };
    results.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
    page++;
  }
  return results;
}

// ── Raw response types ────────────────────────────────────────────────────────

export interface RawMetaCampaign {
  id:            string;
  name:          string;
  status:        string;
  objective?:    string;
  buying_type?:  string;
  created_time?: string;
  updated_time?: string;
}

export interface RawMetaAdSet {
  id:            string;
  name:          string;
  status:        string;
  campaign_id:   string;
  created_time?: string;
  updated_time?: string;
}

export interface RawMetaCreativeEmbedded {
  id:                   string;
  name?:                string;
  title?:               string;
  body?:                string;
  call_to_action_type?: string;
  image_url?:           string;
  thumbnail_url?:       string;
}

export interface RawMetaAd {
  id:            string;
  name:          string;
  status:        string;
  adset_id:      string;
  campaign_id:   string;
  created_time?: string;
  updated_time?: string;
  creative?:     RawMetaCreativeEmbedded;
}

export interface RawMetaInsight {
  campaign_id?: string;
  adset_id?:    string;
  ad_id?:       string;
  date_start:   string;
  date_stop:    string;
  spend:        string;
  impressions:  string;
  clicks:       string;
  ctr?:         string;
  cpm?:         string;
  frequency?:   string;
}

// ── Field lists ───────────────────────────────────────────────────────────────

const CAMPAIGN_FIELDS =
  "id,name,status,objective,buying_type,created_time,updated_time";
const ADSET_FIELDS =
  "id,name,status,campaign_id,created_time,updated_time";
const AD_FIELDS =
  "id,name,status,adset_id,campaign_id,created_time,updated_time," +
  "creative{id,name,title,body,call_to_action_type,image_url,thumbnail_url}";
const INSIGHT_FIELDS =
  "campaign_id,adset_id,ad_id,spend,impressions,clicks,ctr,cpm,frequency";

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchCampaigns(
  externalAdAccountId: string,
  accessToken: string
): Promise<RawMetaCampaign[]> {
  const url = `${META_GRAPH_BASE}/${externalAdAccountId}/campaigns` +
    `?fields=${CAMPAIGN_FIELDS}&limit=100`;
  return fetchAllPages<RawMetaCampaign>(url, accessToken);
}

export async function fetchAdSets(
  externalAdAccountId: string,
  accessToken: string
): Promise<RawMetaAdSet[]> {
  const url = `${META_GRAPH_BASE}/${externalAdAccountId}/adsets` +
    `?fields=${ADSET_FIELDS}&limit=100`;
  return fetchAllPages<RawMetaAdSet>(url, accessToken);
}

export async function fetchAds(
  externalAdAccountId: string,
  accessToken: string
): Promise<RawMetaAd[]> {
  const url = `${META_GRAPH_BASE}/${externalAdAccountId}/ads` +
    `?fields=${AD_FIELDS}&limit=100`;
  return fetchAllPages<RawMetaAd>(url, accessToken);
}

export async function fetchInsights(
  externalAdAccountId: string,
  accessToken: string,
  dayRange = 7,
  timezone = "America/New_York"
): Promise<{ rows: RawMetaInsight[]; since: string; until: string }> {
  // Use the client's timezone so "today" matches the ad account's local date.
  // Meta API interprets time_range dates in the ad account's timezone, so
  // sending UTC dates when the server runs at a different offset causes
  // misalignment (e.g. requesting "tomorrow" in the ad account's timezone).
  const dateInTz = (d: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);

  const untilDate = new Date();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - dayRange);

  const since = dateInTz(sinceDate);
  const until = dateInTz(untilDate);

  const params = new URLSearchParams({
    fields:         INSIGHT_FIELDS,
    level:          "ad",
    time_range:     JSON.stringify({ since, until }),
    time_increment: "1",
    limit:          "500",
  });

  const url = `${META_GRAPH_BASE}/${externalAdAccountId}/insights?${params}`;
  const rows = await fetchAllPages<RawMetaInsight>(url, accessToken, 50);
  return { rows, since, until };
}
