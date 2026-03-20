// ─── Optimization Assistant — Suggestions ────────────────────────────────────
//
// Pure function. Builds follow-up question suggestions based on the current
// intent. Used to guide users toward the next useful question.

import type { OptimizationAssistantIntent, OptimizationAssistantSuggestion } from "./types";

// ── Suggested follow-ups per intent ──────────────────────────────────────────

const FOLLOW_UPS: Record<OptimizationAssistantIntent, OptimizationAssistantSuggestion[]> = {
  summarize_account_state: [
    { text: "Which campaigns are at goal risk?", intent: "identify_goal_risk" },
    { text: "What approvals are waiting?", intent: "identify_pending_approvals" },
    { text: "What experiments are most promising right now?", intent: "summarize_experiment_status" },
  ],
  explain_performance_drop: [
    { text: "Which campaigns are closest to goal risk?", intent: "identify_goal_risk" },
    { text: "What should I work on first today?", intent: "recommend_next_actions" },
    { text: "Which creatives should I refresh?", intent: "summarize_creative_fatigue" },
  ],
  identify_goal_risk: [
    { text: "What should I do about the highest-risk campaigns?", intent: "recommend_next_actions" },
    { text: "What approvals are waiting?", intent: "identify_pending_approvals" },
    { text: "What happened this week that matters most?", intent: "summarize_account_state" },
  ],
  recommend_next_actions: [
    { text: "Which experiments are most promising right now?", intent: "summarize_experiment_status" },
    { text: "Which creatives should I refresh?", intent: "summarize_creative_fatigue" },
    { text: "What approvals are waiting?", intent: "identify_pending_approvals" },
  ],
  explain_winner: [
    { text: "What experiments are most promising right now?", intent: "summarize_experiment_status" },
    { text: "What should I do next to build on these wins?", intent: "recommend_next_actions" },
    { text: "What happened this week that matters most?", intent: "summarize_account_state" },
  ],
  explain_loser: [
    { text: "Why is ROAS dropping?", intent: "explain_performance_drop" },
    { text: "Which campaigns are at goal risk?", intent: "identify_goal_risk" },
    { text: "What should I work on first today?", intent: "recommend_next_actions" },
  ],
  summarize_creative_fatigue: [
    { text: "What's in the creative refresh queue?", intent: "summarize_creative_fatigue" },
    { text: "Which experiments are most promising right now?", intent: "summarize_experiment_status" },
    { text: "What should I work on first today?", intent: "recommend_next_actions" },
  ],
  summarize_experiment_status: [
    { text: "Which campaign showed the biggest win?", intent: "explain_winner" },
    { text: "What should I launch next based on experiment results?", intent: "recommend_next_actions" },
    { text: "What approvals are waiting?", intent: "identify_pending_approvals" },
  ],
  identify_pending_approvals: [
    { text: "What should I work on first today?", intent: "recommend_next_actions" },
    { text: "What's the highest priority issue right now?", intent: "find_highest_priority_issue" },
    { text: "What happened this week that matters most?", intent: "summarize_account_state" },
  ],
  find_highest_priority_issue: [
    { text: "What should I work on first today?", intent: "recommend_next_actions" },
    { text: "What approvals are waiting?", intent: "identify_pending_approvals" },
    { text: "Which campaigns are at goal risk?", intent: "identify_goal_risk" },
  ],
  unknown: [
    { text: "What should I work on first today?", intent: "recommend_next_actions" },
    { text: "What happened this week that matters most?", intent: "summarize_account_state" },
    { text: "What's the highest priority issue right now?", intent: "find_highest_priority_issue" },
  ],
};

// ── Starter prompts (shown on empty state) ────────────────────────────────────

export const STARTER_SUGGESTIONS: OptimizationAssistantSuggestion[] = [
  { text: "What should I work on today?", intent: "recommend_next_actions" },
  { text: "What's the highest priority issue right now?", intent: "find_highest_priority_issue" },
  { text: "What happened this week that matters most?", intent: "summarize_account_state" },
  { text: "Why is ROAS dropping?", intent: "explain_performance_drop" },
  { text: "Which campaigns are closest to goal risk?", intent: "identify_goal_risk" },
  { text: "What approvals are waiting?", intent: "identify_pending_approvals" },
  { text: "Which creative should I refresh next?", intent: "summarize_creative_fatigue" },
  { text: "What experiments are most promising right now?", intent: "summarize_experiment_status" },
];

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildOptimizationAssistantSuggestions(
  intent: OptimizationAssistantIntent
): OptimizationAssistantSuggestion[] {
  return FOLLOW_UPS[intent] ?? FOLLOW_UPS.unknown;
}
