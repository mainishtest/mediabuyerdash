import type { HourlyMetric } from "../../types/media";

export const hourlyMetrics: HourlyMetric[] = [
  // Monday 2024-01-01
  { id: "hm_mon_08", accountId: "act_1", campaignId: "camp_1", date: "2024-01-01", weekday: "Monday",    hour: 8,  spend: 21.80, impressions: 2100, clicks: 42, conversions: 2, revenue: 130.00, cpa: 10.90, roas: 5.96 },
  { id: "hm_mon_10", accountId: "act_1", campaignId: "camp_1", date: "2024-01-01", weekday: "Monday",    hour: 10, spend: 28.40, impressions: 2700, clicks: 54, conversions: 2, revenue: 112.00, cpa: 14.20, roas: 3.94 },
  { id: "hm_mon_12", accountId: "act_1", campaignId: "camp_1", date: "2024-01-01", weekday: "Monday",    hour: 12, spend: 34.20, impressions: 3100, clicks: 59, conversions: 2, revenue: 108.00, cpa: 17.10, roas: 3.16 },
  { id: "hm_mon_15", accountId: "act_1", campaignId: "camp_1", date: "2024-01-01", weekday: "Monday",    hour: 15, spend: 41.50, impressions: 3500, clicks: 63, conversions: 1, revenue:  82.00, cpa: 41.50, roas: 1.98 },
  { id: "hm_mon_18", accountId: "act_1", campaignId: "camp_1", date: "2024-01-01", weekday: "Monday",    hour: 18, spend: 19.60, impressions: 1900, clicks: 38, conversions: 2, revenue: 122.00, cpa:  9.80, roas: 6.22 },

  // Tuesday 2024-01-02
  { id: "hm_tue_09", accountId: "act_1", campaignId: "camp_1", date: "2024-01-02", weekday: "Tuesday",   hour: 9,  spend: 23.50, impressions: 2250, clicks: 45, conversions: 2, revenue: 140.00, cpa: 11.75, roas: 5.96 },
  { id: "hm_tue_11", accountId: "act_1", campaignId: "camp_1", date: "2024-01-02", weekday: "Tuesday",   hour: 11, spend: 31.00, impressions: 2900, clicks: 56, conversions: 2, revenue: 118.00, cpa: 15.50, roas: 3.81 },
  { id: "hm_tue_13", accountId: "act_1", campaignId: "camp_1", date: "2024-01-02", weekday: "Tuesday",   hour: 13, spend: 26.80, impressions: 2500, clicks: 50, conversions: 2, revenue: 148.00, cpa: 13.40, roas: 5.52 },
  { id: "hm_tue_16", accountId: "act_1", campaignId: "camp_1", date: "2024-01-02", weekday: "Tuesday",   hour: 16, spend: 38.90, impressions: 3300, clicks: 60, conversions: 1, revenue:  74.00, cpa: 38.90, roas: 1.90 },
  { id: "hm_tue_19", accountId: "act_1", campaignId: "camp_1", date: "2024-01-02", weekday: "Tuesday",   hour: 19, spend: 17.40, impressions: 1700, clicks: 34, conversions: 1, revenue:  58.00, cpa: 17.40, roas: 3.33 },

  // Wednesday 2024-01-03
  { id: "hm_wed_08", accountId: "act_1", campaignId: "camp_1", date: "2024-01-03", weekday: "Wednesday", hour: 8,  spend: 18.40, impressions: 1850, clicks: 34, conversions: 1, revenue:  62.50, cpa: 18.40, roas: 3.40 },
  { id: "hm_wed_09", accountId: "act_1", campaignId: "camp_1", date: "2024-01-03", weekday: "Wednesday", hour: 9,  spend: 24.10, impressions: 2340, clicks: 48, conversions: 2, revenue: 125.00, cpa: 12.05, roas: 5.19 },
  { id: "hm_wed_10", accountId: "act_1", campaignId: "camp_1", date: "2024-01-03", weekday: "Wednesday", hour: 10, spend: 31.20, impressions: 2980, clicks: 61, conversions: 3, revenue: 187.50, cpa: 10.40, roas: 6.01 },
  { id: "hm_wed_14", accountId: "act_1", campaignId: "camp_1", date: "2024-01-03", weekday: "Wednesday", hour: 14, spend: 36.70, impressions: 3200, clicks: 58, conversions: 1, revenue:  68.00, cpa: 36.70, roas: 1.85 },
  { id: "hm_wed_17", accountId: "act_1", campaignId: "camp_1", date: "2024-01-03", weekday: "Wednesday", hour: 17, spend: 29.30, impressions: 2750, clicks: 52, conversions: 2, revenue: 116.00, cpa: 14.65, roas: 3.96 },

  // Thursday 2024-01-04
  { id: "hm_thu_08", accountId: "act_1", campaignId: "camp_1", date: "2024-01-04", weekday: "Thursday",  hour: 8,  spend: 20.90, impressions: 2000, clicks: 40, conversions: 2, revenue: 132.00, cpa: 10.45, roas: 6.32 },
  { id: "hm_thu_11", accountId: "act_1", campaignId: "camp_1", date: "2024-01-04", weekday: "Thursday",  hour: 11, spend: 33.60, impressions: 3050, clicks: 58, conversions: 2, revenue: 108.00, cpa: 16.80, roas: 3.21 },
  { id: "hm_thu_13", accountId: "act_1", campaignId: "camp_1", date: "2024-01-04", weekday: "Thursday",  hour: 13, spend: 27.10, impressions: 2550, clicks: 49, conversions: 2, revenue: 120.00, cpa: 13.55, roas: 4.43 },
  { id: "hm_thu_16", accountId: "act_1", campaignId: "camp_1", date: "2024-01-04", weekday: "Thursday",  hour: 16, spend: 43.20, impressions: 3600, clicks: 64, conversions: 1, revenue:  78.00, cpa: 43.20, roas: 1.81 },
  { id: "hm_thu_19", accountId: "act_1", campaignId: "camp_1", date: "2024-01-04", weekday: "Thursday",  hour: 19, spend: 18.70, impressions: 1800, clicks: 36, conversions: 1, revenue:  58.00, cpa: 18.70, roas: 3.10 },

  // Friday 2024-01-05
  { id: "hm_fri_09", accountId: "act_1", campaignId: "camp_1", date: "2024-01-05", weekday: "Friday",    hour: 9,  spend: 25.60, impressions: 2400, clicks: 48, conversions: 2, revenue: 126.00, cpa: 12.80, roas: 4.92 },
  { id: "hm_fri_11", accountId: "act_1", campaignId: "camp_1", date: "2024-01-05", weekday: "Friday",    hour: 11, spend: 22.10, impressions: 2150, clicks: 43, conversions: 2, revenue: 138.00, cpa: 11.05, roas: 6.24 },
  { id: "hm_fri_13", accountId: "act_1", campaignId: "camp_1", date: "2024-01-05", weekday: "Friday",    hour: 13, spend: 30.80, impressions: 2850, clicks: 55, conversions: 2, revenue: 110.00, cpa: 15.40, roas: 3.57 },
  { id: "hm_fri_16", accountId: "act_1", campaignId: "camp_1", date: "2024-01-05", weekday: "Friday",    hour: 16, spend: 39.40, impressions: 3400, clicks: 61, conversions: 1, revenue:  72.00, cpa: 39.40, roas: 1.83 },
  { id: "hm_fri_19", accountId: "act_1", campaignId: "camp_1", date: "2024-01-05", weekday: "Friday",    hour: 19, spend: 16.90, impressions: 1650, clicks: 33, conversions: 1, revenue:  62.00, cpa: 16.90, roas: 3.67 }
];
