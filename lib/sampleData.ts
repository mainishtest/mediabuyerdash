import type { AdAccount, Campaign, AdSet, Ad, Creative } from "../types/media";

export const adAccounts: AdAccount[] = [
  {
    id: "act_1",
    name: "Main FB Account",
    platform: "facebook",
    currency: "USD"
  }
];

export const campaigns: Campaign[] = [
  {
    id: "camp_1",
    accountId: "act_1",
    name: "Prospecting Q1",
    objective: "conversions",
    status: "active"
  },
  {
    id: "camp_2",
    accountId: "act_1",
    name: "Retargeting Q1",
    objective: "traffic",
    status: "paused"
  }
];

export const adSets: AdSet[] = [
  {
    id: "adset_1",
    campaignId: "camp_1",
    name: "US - Broad",
    dailyBudget: 100,
    status: "active"
  }
];

export const ads: Ad[] = [
  {
    id: "ad_1",
    adSetId: "adset_1",
    name: "Video V1",
    creativeId: "creative_1",
    status: "active"
  }
];

export const creatives: Creative[] = [
  {
    id: "creative_1",
    name: "Spring Collection Video",
    type: "video"
  },
  {
    id: "creative_2",
    name: "Static Image V1",
    type: "image"
  }
];
