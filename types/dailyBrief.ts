// ─── Daily Morning Brief — Typed Models ──────────────────────────────────────
//
// Decision-first daily brief that operators receive every morning.
// CRM/Shopify is the source of truth for ROAS and CPA.
// Recommendations are explainable and grounded in real data.
//
// Reuses:
//   - DailyExecutiveSummary (portfolio + client KPIs)
//   - DailyOutcomeSummary   (winner/loser highlights)
//   - DigestContent         (alerts, pacing, stale syncs)

import type { ClientPerformanceStatus, ClientTrendDirection, DataTrustLevel } from "./dailySummary";

// ── Delivery states ─────────────────────────────────────────────────────────

export type DailyBriefDeliveryState =
  | "pending"
  | "generated"
  | "delivered_in_app"
  | "delivered_email"
  | "failed"
  | "skipped";

// ── Timezone window ─────────────────────────────────────────────────────────

export type DailyBriefTimezoneWindow = {
  timezone:       string;           // IANA timezone, e.g. "America/New_York"
  localMorningHour: number;         // Hour to deliver (default 7)
  utcDeliverAt:   string;           // ISO datetime of the target delivery time in UTC
};

// ── Schedule ────────────────────────────────────────────────────────────────

export type DailyBriefSchedule = {
  briefDate:       string;          // YYYY-MM-DD (the date being reported)
  timezone:        string;
  scheduledForUtc: string;          // ISO datetime — when to generate
  generatedAt:     string | null;
  deliveredAt:     string | null;
  deliveryState:   DailyBriefDeliveryState;
  retryCount:      number;
  lastError:       string | null;
};

// ── Account summary within a brief ──────────────────────────────────────────

export type DailyBriefAccountSummary = {
  clientId:        string;
  clientName:      string;
  currency:        string;
  spend:           number;
  revenue:         number;
  roas:            number | null;
  cpa:             number | null;
  orders:          number;
  status:          ClientPerformanceStatus;
  trend:           ClientTrendDirection;
  scaleReady:      boolean;
  alertCount:      number;
  hasStaleSync:    boolean;
  href:            string;
};

// ── Action item ─────────────────────────────────────────────────────────────

export type DailyBriefActionPriority = "critical" | "high" | "medium" | "low";
export type DailyBriefActionReadiness = "ready" | "blocked" | "needs_review";

export type DailyBriefActionItem = {
  id:           string;
  label:        string;
  description:  string;
  priority:     DailyBriefActionPriority;
  readiness:    DailyBriefActionReadiness;
  category:     "scale" | "refresh" | "retest" | "alert" | "pacing" | "blocker";
  clientName:   string;
  href:         string;
  blockerNote:  string | null;
};

// ── Winners and losers ──────────────────────────────────────────────────────

export type DailyBriefWinner = {
  id:              string;
  title:           string;
  subtitle:        string;
  lift:            number | null;     // primary lift as decimal (e.g. 0.15 = +15%)
  confidence:      number | null;     // 0–1
  clientName:      string;
  scaleReady:      boolean;
  href:            string;
};

export type DailyBriefLoser = {
  id:              string;
  title:           string;
  subtitle:        string;
  lift:            number | null;
  confidence:      number | null;
  clientName:      string;
  refreshQueued:   boolean;
  href:            string;
};

// ── Blocked item ────────────────────────────────────────────────────────────

export type DailyBriefBlockedItem = {
  id:           string;
  label:        string;
  reason:       string;
  category:     "stale_sync" | "missing_goal" | "pending_approval" | "low_confidence" | "other";
  clientName:   string;
  href:         string;
};

// ── Full brief summary (for rendering the brief card) ───────────────────────

export type DailyBriefSummary = {
  totalAccounts:    number;
  accountsAtRisk:   number;
  accountsScaling:  number;
  totalSpend:       number;
  totalRevenue:     number;
  blendedRoas:      number | null;
  blendedCpa:       number | null;
  winnersCount:     number;
  losersCount:      number;
  blockedCount:     number;
  actionCount:      number;
  topLineMessage:   string;        // "2 accounts at risk, 3 winners to scale"
};

// ── Full Daily Morning Brief ────────────────────────────────────────────────

export type DailyMorningBrief = {
  id:               string;
  briefDate:        string;          // YYYY-MM-DD
  generatedAt:      string;          // ISO datetime
  deliveryState:    DailyBriefDeliveryState;
  // Timezone
  timezone:         string;
  // Summary
  summary:          DailyBriefSummary;
  // Sections
  accounts:         DailyBriefAccountSummary[];
  actions:          DailyBriefActionItem[];
  winners:          DailyBriefWinner[];
  losers:           DailyBriefLoser[];
  blockedItems:     DailyBriefBlockedItem[];
  // Trust
  trustState:       DataTrustLevel;
  trustMessage:     string;
  // Edge cases
  noDataYesterday:  boolean;
  hasPartialCrm:    boolean;
  hasStaleSyncs:    boolean;
  hasMissingGoals:  boolean;
  // Workspace
  workspaceId:      string | null;
};
