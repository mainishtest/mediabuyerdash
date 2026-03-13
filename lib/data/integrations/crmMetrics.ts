import type { CRMPerformanceMetric } from "../../../types/integrations";

// Source-of-truth revenue rows as they would be pulled from a Shopify or
// Konnective integration. Note that these values intentionally differ from
// Meta-reported numbers to illustrate the reconciliation gap.
export const crmPerformanceMetrics: CRMPerformanceMetric[] = [
  {
    id:                "crm_m_1",
    date:              "2024-03-01",
    source:            "shopify",
    utmCampaign:       "prospecting-q1",
    utmContent:        "video-v1-broad",
    campaignId:        "camp_1",
    orders:            15,
    revenue:           900.00,
    averageOrderValue: 60.00,
    refunds:           1,
    netRevenue:        840.00
  },
  {
    id:                "crm_m_2",
    date:              "2024-03-02",
    source:            "shopify",
    utmCampaign:       "retargeting-q1",
    campaignId:        "camp_2",
    orders:            10,
    revenue:           700.00,
    averageOrderValue: 70.00,
    refunds:           0,
    netRevenue:        700.00
  },
  {
    id:                "crm_m_3",
    date:              "2024-03-03",
    source:            "shopify",
    utmCampaign:       "prospecting-q1",
    campaignId:        "camp_1",
    orders:            13,
    revenue:           780.00,
    averageOrderValue: 60.00,
    refunds:           2,
    netRevenue:        720.00
  }
];
