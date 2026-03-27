// lib/creativeFatigue/index.ts
// Public surface area for the creative fatigue detection module.

export type {
  CreativeFatigueStatus,
  CreativeFatigueReason,
  CreativeRefreshActionType,
  CreativeFatigueSignal,
  CreativeRefreshRecommendation,
  CreativeFatigueSummary,
  CreativeHealthCounts,
} from "./types";

export {
  detectCreativeFatigue,
  buildCreativeFatigueReport,
  getOverallHealthCounts,
  summarizeCreativeHealthByClient,
} from "./detector";
