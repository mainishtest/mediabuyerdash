// lib/data/optimizationSample.ts
// Sample RawPerformanceInput rows for the goal-aware optimization layer.
//
// These rows represent what the reconciliation engine would produce after
// matching Meta delivery data to Shopify/CRM orders and grouping by entity.
//
// CRM metric values (crmOrders, crmRevenue) are sourced from Shopify/CRM —
// NOT from Meta-reported conversions or revenue. In production these rows
// would be derived from ReconciliationMatch DB records mapped to
// RawPerformanceInput via a query in the page server component.
//
// Designed outcomes:
//   camp_1 "Prospecting Q1"    (ROAS goal 3.5×, CPA goal $20):
//     → overall "on_track"    (ROAS 3.28×, CPA $18.14)
//   camp_2 "Retargeting Q1"    (ROAS goal 2.5×, CPA goal $30):
//     → overall "strong"      (ROAS 8.00×, CPA $9.60)
//
//   adset_1 "US - Broad"       (camp_1 goals):  strong      ROAS 4.00×, CPA $15.63
//   adset_2 "US - Interest"    (camp_1 goals):  underperforming ROAS 2.00×, CPA $25.45
//   adset_3 "US - Retargeting" (camp_2 goals):  strong      ROAS 8.00×, CPA $9.60
//
//   ad_1 "Video V1 - Broad"    (camp_1 goals):  strong      (mirrors adset_1)
//   ad_2 "Static V1 - Interest"(camp_1 goals):  underperforming (mirrors adset_2)
//   ad_3 "Carousel V1"         (camp_2 goals):  strong      (mirrors adset_3)

import type { RawPerformanceInput } from "../goalAwareOptimization/snapshot";

export const sampleOptimizationRows: RawPerformanceInput[] = [

  // ── adset_1 / ad_1 — US - Broad / Video V1 (camp_1) ─────────────────────
  // Aggregates: spend=500, crmOrders=32, crmRevenue=2000
  // evaluatedRoas = 4.00×  evaluatedCpa = $15.63
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    date: "2024-03-01",
    metaSpend: 96,  metaClicks: 210, metaImpressions: 10500,
    crmOrders: 6,   crmRevenue: 380,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    date: "2024-03-02",
    metaSpend: 104, metaClicks: 228, metaImpressions: 11400,
    crmOrders: 7,   crmRevenue: 441,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    date: "2024-03-03",
    metaSpend: 98,  metaClicks: 218, metaImpressions: 10900,
    crmOrders: 6,   crmRevenue: 378,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    date: "2024-03-04",
    metaSpend: 100, metaClicks: 222, metaImpressions: 11100,
    crmOrders: 7,   crmRevenue: 441,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_1",   adSetName:    "US - Broad",
    adId:    "ad_1",      adName:       "Video V1 - Broad",
    date: "2024-03-05",
    metaSpend: 102, metaClicks: 225, metaImpressions: 11200,
    crmOrders: 6,   crmRevenue: 360,
  },

  // ── adset_2 / ad_2 — US - Interest / Static V1 (camp_1) ──────────────────
  // Aggregates: spend=280, crmOrders=11, crmRevenue=560
  // evaluatedRoas = 2.00×  evaluatedCpa = $25.45  → underperforming (ROAS below goal)
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_2",   adSetName:    "US - Interest Targeting",
    adId:    "ad_2",      adName:       "Static V1 - Interest",
    date: "2024-03-01",
    metaSpend: 68, metaClicks: 124, metaImpressions: 7800,
    crmOrders: 3,  crmRevenue: 141,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_2",   adSetName:    "US - Interest Targeting",
    adId:    "ad_2",      adName:       "Static V1 - Interest",
    date: "2024-03-03",
    metaSpend: 72, metaClicks: 130, metaImpressions: 8200,
    crmOrders: 3,  crmRevenue: 141,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_2",   adSetName:    "US - Interest Targeting",
    adId:    "ad_2",      adName:       "Static V1 - Interest",
    date: "2024-03-04",
    metaSpend: 70, metaClicks: 127, metaImpressions: 7900,
    crmOrders: 2,  crmRevenue: 94,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_1", campaignName: "Prospecting Q1",
    adSetId: "adset_2",   adSetName:    "US - Interest Targeting",
    adId:    "ad_2",      adName:       "Static V1 - Interest",
    date: "2024-03-05",
    metaSpend: 70, metaClicks: 126, metaImpressions: 7900,
    crmOrders: 3,  crmRevenue: 184,
  },

  // ── adset_3 / ad_3 — US - Retargeting Core / Carousel V1 (camp_2) ────────
  // Aggregates: spend=240, crmOrders=25, crmRevenue=1920
  // evaluatedRoas = 8.00×  evaluatedCpa = $9.60  → strong
  {
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    date: "2024-03-01",
    metaSpend: 58, metaClicks: 110, metaImpressions: 4200,
    crmOrders: 6,  crmRevenue: 480,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    date: "2024-03-02",
    metaSpend: 62, metaClicks: 118, metaImpressions: 4500,
    crmOrders: 7,  crmRevenue: 560,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    date: "2024-03-04",
    metaSpend: 56, metaClicks: 106, metaImpressions: 4000,
    crmOrders: 5,  crmRevenue: 400,
  },
  {
    clientAccountId: "act_1",
    campaignId: "camp_2", campaignName: "Retargeting Q1",
    adSetId: "adset_3",   adSetName:    "US - Retargeting Core",
    adId:    "ad_3",      adName:       "Carousel V1 - Retargeting",
    date: "2024-03-05",
    metaSpend: 64, metaClicks: 122, metaImpressions: 4700,
    crmOrders: 7,  crmRevenue: 480,
  },
];
