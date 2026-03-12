export interface AdAccount {
  id: string;
  name: string;
  platform: "facebook";
  currency: string;
}

export interface Campaign {
  id: string;
  accountId: string;
  name: string;
  objective: "conversions" | "traffic" | "reach";
  status: "active" | "paused";
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  dailyBudget: number;
  status: "active" | "paused";
}

export interface Ad {
  id: string;
  adSetId: string;
  name: string;
  creativeId: string;
  status: "active" | "paused";
}

export interface Creative {
  id: string;
  name: string;
  type: "image" | "video" | "carousel";
}

export interface DailyMetric {
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
