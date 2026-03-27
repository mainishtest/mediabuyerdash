import type { DailyMetric } from "../../types/media";

export const dailyMetrics: DailyMetric[] = [
  {
    id: "dm_1",
    accountId: "act_1",
    campaignId: "camp_1",
    date: "2024-01-01",
    spend: 312.50,
    impressions: 28400,
    clicks: 540,
    conversions: 18,
    revenue: 1125.00,
    cpa: 17.36,
    roas: 3.60
  },
  {
    id: "dm_2",
    accountId: "act_1",
    campaignId: "camp_1",
    date: "2024-01-02",
    spend: 287.00,
    impressions: 25100,
    clicks: 490,
    conversions: 15,
    revenue: 937.50,
    cpa: 19.13,
    roas: 3.27
  },
  {
    id: "dm_3",
    accountId: "act_1",
    campaignId: "camp_1",
    date: "2024-01-03",
    spend: 340.00,
    impressions: 31200,
    clicks: 610,
    conversions: 22,
    revenue: 1375.00,
    cpa: 15.45,
    roas: 4.04
  }
];
