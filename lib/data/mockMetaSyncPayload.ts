// Mock Meta sync payload.
// Simulates the batch of data the app would receive from the Meta Ads API
// after a connected user triggers a sync.  Field names follow the
// MetaSync* contract types in types/metaSync.ts.

import type { MetaSyncPayload } from "../../types/metaSync";

export const mockMetaSyncPayload: MetaSyncPayload = {

  // ── Accounts ──────────────────────────────────────────────────────────────
  accounts: [
    {
      externalAccountId: "act_1",
      name:              "Main FB Account",
      currency:          "USD",
      timezone:          "America/New_York",
      businessName:      "Acme Media LLC",
      accountStatus:     "ACTIVE"
    }
  ],

  // ── Campaigns ──────────────────────────────────────────────────────────────
  campaigns: [
    {
      externalCampaignId: "camp_sync_1",
      externalAccountId:  "act_1",
      name:               "Prospecting Q2",
      objective:          "CONVERSIONS",
      status:             "ACTIVE",
      dailyBudget:        250,
      createdTime:        "2024-04-01T00:00:00Z"
    },
    {
      externalCampaignId: "camp_sync_2",
      externalAccountId:  "act_1",
      name:               "Retargeting Q2",
      objective:          "CONVERSIONS",
      status:             "ACTIVE",
      dailyBudget:        120,
      createdTime:        "2024-04-01T00:00:00Z"
    }
  ],

  // ── Ad Sets ────────────────────────────────────────────────────────────────
  adSets: [
    {
      externalAdSetId:    "adset_sync_1",
      externalCampaignId: "camp_sync_1",
      name:               "US Broad 25-54",
      targeting:          "US, ages 25–54, Broad audience",
      dailyBudget:        125,
      status:             "ACTIVE",
      startTime:          "2024-04-01T00:00:00Z"
    },
    {
      externalAdSetId:    "adset_sync_2",
      externalCampaignId: "camp_sync_1",
      name:               "US Fitness Interest",
      targeting:          "US, ages 25–44, Fitness & Health interests",
      dailyBudget:        125,
      status:             "ACTIVE",
      startTime:          "2024-04-01T00:00:00Z"
    }
  ],

  // ── Creatives ──────────────────────────────────────────────────────────────
  creatives: [
    {
      externalCreativeId: "creative_sync_1",
      name:               "Q2 Video Ad — Hero",
      type:               "VIDEO",
      headline:           "See Results in 30 Days",
      body:               "Join thousands who have already transformed their performance with our proven system.",
      callToAction:       "LEARN_MORE",
      createdTime:        "2024-04-01T00:00:00Z"
    },
    {
      externalCreativeId: "creative_sync_2",
      name:               "Q2 Static — Offer",
      type:               "IMAGE",
      headline:           "Exclusive Q2 Offer",
      body:               "Limited time: unlock premium access at our best-ever price.",
      callToAction:       "SHOP_NOW",
      createdTime:        "2024-04-01T00:00:00Z"
    }
  ],

  // ── Ads ────────────────────────────────────────────────────────────────────
  ads: [
    {
      externalAdId:       "ad_sync_1",
      externalAdSetId:    "adset_sync_1",
      externalCreativeId: "creative_sync_1",
      name:               "Q2 Video — Broad",
      status:             "ACTIVE",
      createdTime:        "2024-04-01T00:00:00Z"
    },
    {
      externalAdId:       "ad_sync_2",
      externalAdSetId:    "adset_sync_2",
      externalCreativeId: "creative_sync_2",
      name:               "Q2 Static — Interest",
      status:             "ACTIVE",
      createdTime:        "2024-04-01T00:00:00Z"
    }
  ],

  // ── Hourly metrics (4 rows across 2 days) ──────────────────────────────────
  hourlyMetrics: [
    {
      externalAccountId:  "act_1",
      externalCampaignId: "camp_sync_1",
      externalAdSetId:    "adset_sync_1",
      externalAdId:       "ad_sync_1",
      date: "2024-04-01", hour: 10,
      spend: 32.40, impressions: 2_850, clicks: 58,
      conversions: 4, revenue: 230.00,
      utmCampaign: "prospecting-q2", utmContent: "video-hero-broad",
      utmTerm: "broad", utmSource: "facebook", utmMedium: "cpc"
    },
    {
      externalAccountId:  "act_1",
      externalCampaignId: "camp_sync_1",
      externalAdSetId:    "adset_sync_1",
      externalAdId:       "ad_sync_1",
      date: "2024-04-01", hour: 14,
      spend: 44.10, impressions: 3_940, clicks: 82,
      conversions: 6, revenue: 355.00,
      utmCampaign: "prospecting-q2", utmContent: "video-hero-broad",
      utmTerm: "broad", utmSource: "facebook", utmMedium: "cpc"
    },
    {
      externalAccountId:  "act_1",
      externalCampaignId: "camp_sync_1",
      externalAdSetId:    "adset_sync_2",
      externalAdId:       "ad_sync_2",
      date: "2024-04-02", hour: 9,
      spend: 21.60, impressions: 1_920, clicks: 41,
      conversions: 3, revenue: 172.50,
      utmCampaign: "prospecting-q2", utmContent: "static-offer-interest",
      utmTerm: "fitness-interest", utmSource: "facebook", utmMedium: "cpc"
    },
    {
      externalAccountId:  "act_1",
      externalCampaignId: "camp_sync_1",
      externalAdSetId:    "adset_sync_2",
      externalAdId:       "ad_sync_2",
      date: "2024-04-02", hour: 19,
      spend: 18.90, impressions: 1_680, clicks: 36,
      conversions: 2, revenue: 119.00,
      utmCampaign: "prospecting-q2", utmContent: "static-offer-interest",
      utmTerm: "fitness-interest", utmSource: "facebook", utmMedium: "cpc"
    }
  ]
};

// A sample MetaSyncJob matching this payload.
export const mockMetaSyncJob = {
  id:                  "sync_job_mock_1",
  connectionId:        "meta_conn_1",
  selectedAdAccountId: "act_1",
  syncType:            "full" as const,
  status:              "completed" as const,
  startedAt:           "2024-04-03T08:00:00Z",
  completedAt:         "2024-04-03T08:00:12Z",
  errorMessage:        null
};
