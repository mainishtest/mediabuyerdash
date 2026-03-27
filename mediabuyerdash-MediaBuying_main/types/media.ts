// Top of the entity hierarchy: ClientAccount → Campaign → AdSet → Ad

export interface ClientAccount {
  id: string;
  name: string;
  platform: "facebook";
  currency: string;
  timezone: string;
  createdAt: string; // "YYYY-MM-DD"
}

export interface Campaign {
  id: string;
  accountId: string;    // FK → ClientAccount.id
  name: string;
  objective: "conversions" | "traffic" | "reach" | "brand_awareness";
  status: "active" | "paused" | "archived";
  dailyBudget: number;
  createdAt: string;
  // Per-campaign optimization targets — configured in the Client Workspace
  roasGoalType: "high" | "low";
  roasGoalValue: number;
  cpaGoalType: "high" | "low";
  cpaGoalValue: number;
}

export interface AdSet {
  id: string;
  campaignId: string;  // FK → Campaign.id
  name: string;
  targeting: string;
  dailyBudget: number;
  status: "active" | "paused" | "archived";
  startDate: string;
}

export interface Ad {
  id: string;
  adSetId: string;    // FK → AdSet.id
  creativeId: string; // FK → Creative.id
  name: string;
  status: "active" | "paused" | "archived";
  createdAt: string;
}

export interface Creative {
  id: string;
  name: string;
  type: "image" | "video" | "carousel";
  headline: string;
  body: string;
  callToAction: string;
  createdAt: string;
}

export interface DailyMetric {
  id: string;
  accountId: string;  // FK → ClientAccount.id
  campaignId: string; // FK → Campaign.id
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa: number;
  roas: number;
}

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface HourlyMetric {
  id: string;
  accountId: string;  // FK → ClientAccount.id
  campaignId: string; // FK → Campaign.id
  date: string;
  weekday: Weekday;
  hour: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa: number;
  roas: number;
}
