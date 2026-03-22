// ─── Optimization Assistant — Typed Models ───────────────────────────────────
//
// Pure TypeScript interfaces for the AI-guided optimization assistant surface.
// No business logic here. No runtime code.

import type {
  CommandCenterPriorityCard,
  CommandCenterAlertItem,
  CommandCenterApprovalItem,
  CommandCenterExperimentItem,
  CommandCenterCreativeItem,
  CommandCenterPacingItem,
} from "../commandCenter/types";
import type { ExecutiveKpiCard, ExecutiveNarrativeSection } from "../executiveReporting/types";
import type { LearningMemoryEntry } from "../learningMemory/types";

// ── Intent ────────────────────────────────────────────────────────────────────

export type OptimizationAssistantIntent =
  | "summarize_account_state"
  | "summarize_today"
  | "summarize_week"
  | "explain_performance_drop"
  | "identify_goal_risk"
  | "recommend_next_actions"
  | "explain_winner"
  | "explain_loser"
  | "find_scale_candidates"
  | "find_accounts_at_risk"
  | "summarize_creative_fatigue"
  | "summarize_experiment_status"
  | "summarize_recent_tests"
  | "summarize_blockers"
  | "identify_pending_approvals"
  | "find_highest_priority_issue"
  | "unknown";

// ── Session and message ───────────────────────────────────────────────────────

export interface OptimizationAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: OptimizationAssistantIntent;
  response?: OptimizationAssistantResponse;
  createdAt: string;
}

export interface OptimizationAssistantSession {
  id: string;
  clientId?: string;
  dateFrom: string;
  dateTo: string;
  messages: OptimizationAssistantMessage[];
  createdAt: string;
}

// ── Context (assembled server-side from existing aggregators) ─────────────────

export interface OptimizationAssistantContextSummary {
  totalSpend: number;
  totalRevenue: number;
  overallRoas: number | null;
  overallCpa: number | null;
  activeClientsCount: number;
  openAlerts: number;
  pendingApprovals: number;
  activeExperiments: number;
  pacingRisksCount: number;
}

export interface OptimizationAssistantContext {
  clientId?: string;
  clientName?: string;
  dateFrom: string;
  dateTo: string;
  summary: OptimizationAssistantContextSummary;
  // From command center
  topPriorities: CommandCenterPriorityCard[];
  alerts: CommandCenterAlertItem[];
  approvals: CommandCenterApprovalItem[];
  experiments: CommandCenterExperimentItem[];
  creativeItems: CommandCenterCreativeItem[];
  pacingItems: CommandCenterPacingItem[];
  // From executive reporting
  kpis: ExecutiveKpiCard[];
  narrative?: ExecutiveNarrativeSection;
  // From daily outcomes
  outcomeWinnersCount: number;
  outcomeLosersCount: number;
  outcomeScaleReadyCount: number;
  outcomeRefreshNeededCount: number;
  // From action history
  recentActionsCount: number;
  recentActionsFailedCount: number;
  recentActionsBlockedCount: number;
  // From learning memory
  learnings: LearningMemoryEntry[];
  learningSummary: string;
  // Meta
  dataWarnings: string[];
  assembledAt: string;
}

// ── Response sub-types ────────────────────────────────────────────────────────

export interface OptimizationAssistantEvidence {
  label: string;
  value: string;
  source: string;
  direction?: "positive" | "negative" | "neutral";
}

export interface OptimizationAssistantEntityReference {
  type: "client" | "campaign" | "experiment" | "creative" | "approval" | "alert" | "pacing";
  id: string;
  label: string;
  href: string;
}

export interface OptimizationAssistantActionLink {
  label: string;
  href: string;
  icon: string;
  description: string;
}

export interface OptimizationAssistantSuggestion {
  text: string;
  intent: OptimizationAssistantIntent;
}

// ── Response (returned to client) ────────────────────────────────────────────

export interface OptimizationAssistantResponse {
  summary: string;
  intent: OptimizationAssistantIntent;
  evidence: OptimizationAssistantEvidence[];
  entities: OptimizationAssistantEntityReference[];
  actionLinks: OptimizationAssistantActionLink[];
  suggestions: OptimizationAssistantSuggestion[];
  dataWarnings: string[];
  isGrounded: boolean;
  generatedAt: string;
}

// ── Filter state (URL-driven) ─────────────────────────────────────────────────

export interface OptimizationAssistantFilterState {
  clientId?: string;
  dateFrom: string;
  dateTo: string;
}
