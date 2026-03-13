import type { AdSet } from "../../types/media";

export const adSets: AdSet[] = [
  {
    id: "adset_1",
    campaignId: "camp_1",
    name: "US - Broad",
    targeting: "US, ages 25–54, Broad audience",
    dailyBudget: 100,
    status: "active",
    startDate: "2024-01-01"
  },
  {
    id: "adset_2",
    campaignId: "camp_1",
    name: "US - Interest Targeting",
    targeting: "US, ages 25–44, Fitness & Health interests",
    dailyBudget: 100,
    status: "active",
    startDate: "2024-01-01"
  }
];
