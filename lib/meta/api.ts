import { META_GRAPH_BASE } from "./config";

// ── Rate limit / retry helpers ───────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Detects Meta API errors that indicate an expired or invalid token.
 * Error codes: 190 (invalid token), 102 (session expired).
 */
export function isTokenError(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const err = (body as { error?: { code?: number; type?: string } }).error;
  if (!err) return false;
  if (err.code === 190 || err.code === 102) return true;
  if (err.type === "OAuthException") return true;
  return false;
}

// ── Paged fetcher with rate-limit retry ──────────────────────────────────────

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
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(nextUrl, { cache: "no-store" });

      // Rate-limited — backoff and retry
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[Meta API] 429 rate limit, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(`Meta API ${res.status}: ${JSON.stringify(body)}`);

        // Tag token errors so callers can detect them
        if (isTokenError(body)) {
          (err as Error & { isTokenError: boolean }).isTokenError = true;
        }

        // Retry on 5xx server errors
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(`[Meta API] ${res.status} server error, retrying in ${backoff}ms`);
          await sleep(backoff);
          lastError = err;
          continue;
        }

        throw err;
      }

      const json = (await res.json()) as {
        data: T[];
        paging?: { next?: string };
      };
      results.push(...(json.data ?? []));
      nextUrl = json.paging?.next ?? null;
      lastError = null;
      break;
    }

    if (lastError) throw lastError;
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
  dayRange = 7
): Promise<{ rows: RawMetaInsight[]; since: string; until: string }> {
  const untilDate = new Date();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - dayRange);

  const since = sinceDate.toISOString().slice(0, 10);
  const until = untilDate.toISOString().slice(0, 10);

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
