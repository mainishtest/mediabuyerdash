import type {
  RawMetaCampaign,
  RawMetaAdSet,
  RawMetaAd,
  RawMetaCreativeEmbedded,
  RawMetaInsight,
} from "./api";

// ── Mapped (Prisma-ready) types ───────────────────────────────────────────────

export interface MappedCampaign {
  workspaceId:         string | null;
  externalAdAccountId: string;
  externalCampaignId:  string;
  name:                string;
  status:              string;
  objective:           string | null;
  buyingType:          string | null;
  metaCreatedAt:       Date | null;
  metaUpdatedAt:       Date | null;
}

export interface MappedAdSet {
  workspaceId:         string | null;
  externalAdAccountId: string;
  externalCampaignId:  string;
  externalAdSetId:     string;
  name:                string;
  status:              string;
  metaCreatedAt:       Date | null;
  metaUpdatedAt:       Date | null;
}

export interface MappedAd {
  workspaceId:         string | null;
  externalAdAccountId: string;
  externalCampaignId:  string;
  externalAdSetId:     string;
  externalAdId:        string;
  externalCreativeId:  string | null;
  name:                string;
  status:              string;
  metaCreatedAt:       Date | null;
  metaUpdatedAt:       Date | null;
}

export interface MappedCreative {
  workspaceId:        string | null;
  externalCreativeId: string;
  name:               string | null;
  title:              string | null;
  body:               string | null;
  callToAction:       string | null;
  imageUrl:           string | null;
  thumbnailUrl:       string | null;
  destinationUrl:     string | null;
}

export interface MappedInsight {
  workspaceId:         string | null;
  externalAdAccountId: string;
  level:               string;
  externalCampaignId:  string;
  externalAdSetId:     string;
  externalAdId:        string;
  dateStart:           string;
  dateStop:            string;
  spend:               number;
  impressions:         number;
  clicks:              number;
  ctr:                 number | null;
  cpm:                 number | null;
  frequency:           number | null;
}

// ── Mapper functions ──────────────────────────────────────────────────────────

export function mapCampaign(
  raw: RawMetaCampaign,
  externalAdAccountId: string,
  workspaceId: string | null = null
): MappedCampaign {
  return {
    workspaceId,
    externalAdAccountId,
    externalCampaignId: raw.id,
    name:               raw.name,
    status:             raw.status,
    objective:          raw.objective   ?? null,
    buyingType:         raw.buying_type ?? null,
    metaCreatedAt:      raw.created_time ? new Date(raw.created_time) : null,
    metaUpdatedAt:      raw.updated_time ? new Date(raw.updated_time) : null,
  };
}

export function mapAdSet(
  raw: RawMetaAdSet,
  externalAdAccountId: string,
  workspaceId: string | null = null
): MappedAdSet {
  return {
    workspaceId,
    externalAdAccountId,
    externalCampaignId: raw.campaign_id,
    externalAdSetId:    raw.id,
    name:               raw.name,
    status:             raw.status,
    metaCreatedAt:      raw.created_time ? new Date(raw.created_time) : null,
    metaUpdatedAt:      raw.updated_time ? new Date(raw.updated_time) : null,
  };
}

export function mapAd(
  raw: RawMetaAd,
  externalAdAccountId: string,
  workspaceId: string | null = null
): MappedAd {
  return {
    workspaceId,
    externalAdAccountId,
    externalCampaignId: raw.campaign_id,
    externalAdSetId:    raw.adset_id,
    externalAdId:       raw.id,
    externalCreativeId: raw.creative?.id ?? null,
    name:               raw.name,
    status:             raw.status,
    metaCreatedAt:      raw.created_time ? new Date(raw.created_time) : null,
    metaUpdatedAt:      raw.updated_time ? new Date(raw.updated_time) : null,
  };
}

export function mapCreative(
  raw: RawMetaCreativeEmbedded,
  workspaceId: string | null = null
): MappedCreative {
  // body is the primary text. Fallback: extract from object_story_spec.*.message
  // (Meta stores the ad copy in different places depending on ad type)
  const body = raw.body
    ?? raw.object_story_spec?.link_data?.message
    ?? raw.object_story_spec?.video_data?.message
    ?? raw.object_story_spec?.photo_data?.message
    ?? null;

  // Destination URL: link_data.link (most common), video CTA link, or photo link
  const destinationUrl =
    raw.object_story_spec?.link_data?.link
    ?? raw.object_story_spec?.video_data?.call_to_action?.value?.link
    ?? raw.object_story_spec?.photo_data?.link
    ?? null;

  return {
    workspaceId,
    externalCreativeId: raw.id,
    name:               raw.name               ?? null,
    title:              raw.title              ?? null,
    body,
    callToAction:       raw.call_to_action_type ?? null,
    imageUrl:           raw.image_url          ?? null,
    thumbnailUrl:       raw.thumbnail_url      ?? null,
    destinationUrl,
  };
}

export function mapInsight(
  raw: RawMetaInsight,
  externalAdAccountId: string,
  workspaceId: string | null = null
): MappedInsight {
  return {
    workspaceId,
    externalAdAccountId,
    level:              "ad",
    externalCampaignId: raw.campaign_id ?? "",
    externalAdSetId:    raw.adset_id    ?? "",
    externalAdId:       raw.ad_id       ?? "",
    dateStart:          raw.date_start,
    dateStop:           raw.date_stop,
    spend:              parseFloat(raw.spend)         || 0,
    impressions:        parseInt(raw.impressions, 10) || 0,
    clicks:             parseInt(raw.clicks, 10)      || 0,
    ctr:                raw.ctr       ? parseFloat(raw.ctr)       : null,
    cpm:                raw.cpm       ? parseFloat(raw.cpm)       : null,
    frequency:          raw.frequency ? parseFloat(raw.frequency) : null,
  };
}
