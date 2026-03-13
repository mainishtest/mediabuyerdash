import type { Campaign } from "../../types/media";

export const campaigns: Campaign[] = [
  {
    id: "camp_1",
    accountId: "act_1",
    name: "Prospecting Q1",
    objective: "conversions",
    status: "active",
    dailyBudget: 200,
    createdAt: "2024-01-01"
  },
  {
    id: "camp_2",
    accountId: "act_1",
    name: "Retargeting Q1",
    objective: "traffic",
    status: "paused",
    dailyBudget: 100,
    createdAt: "2024-01-01"
  }
];
