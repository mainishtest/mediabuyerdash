import type { UTMAttribution } from "../../../types/integrations";

// Sample UTM attribution rows as they would arrive from a CRM or analytics
// system. utm_campaign maps to internal Campaign names; utm_content maps to
// Ad names — the join key for cross-platform reporting.
export const utmAttributionRows: UTMAttribution[] = [
  {
    id:          "utm_1",
    date:        "2024-03-01",
    utmSource:   "facebook",
    utmMedium:   "cpc",
    utmCampaign: "prospecting-q1",
    utmContent:  "video-v1-broad",
    campaignId:  "camp_1",
    adSetId:     "adset_1",
    adId:        "ad_1",
    sessions:    320,
    orders:      18,
    revenue:     1_080.00
  },
  {
    id:          "utm_2",
    date:        "2024-03-01",
    utmSource:   "facebook",
    utmMedium:   "cpc",
    utmCampaign: "prospecting-q1",
    utmContent:  "static-v1-interest",
    campaignId:  "camp_1",
    adSetId:     "adset_2",
    adId:        "ad_2",
    sessions:    210,
    orders:      9,
    revenue:     495.00
  },
  {
    id:          "utm_3",
    date:        "2024-03-02",
    utmSource:   "facebook",
    utmMedium:   "cpc",
    utmCampaign: "retargeting-q1",
    utmContent:  "video-v1-broad",
    campaignId:  "camp_2",
    sessions:    145,
    orders:      12,
    revenue:     840.00
  },
  {
    id:          "utm_4",
    date:        "2024-03-03",
    utmSource:   "facebook",
    utmMedium:   "cpc",
    utmCampaign: "prospecting-q1",
    utmContent:  "video-v1-broad",
    campaignId:  "camp_1",
    adSetId:     "adset_1",
    adId:        "ad_1",
    sessions:    290,
    orders:      16,
    revenue:     960.00
  }
];
