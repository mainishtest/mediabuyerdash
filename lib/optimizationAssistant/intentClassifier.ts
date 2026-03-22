// ─── Optimization Assistant — Intent Classifier ──────────────────────────────
//
// Pure function. Maps a user question to one of the defined assistant intents
// using keyword scoring. No I/O, no AI required at this stage.

import type { OptimizationAssistantIntent } from "./types";

// ── Keyword lists per intent ──────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<OptimizationAssistantIntent, string[]> = {
  summarize_today: [
    "today", "this morning", "what should i do today", "daily brief", "morning brief",
    "morning update", "what matters today", "start of day", "daily summary",
  ],
  summarize_account_state: [
    "what happened", "this month", "summary", "overview", "how did",
    "how are", "account state", "report", "status update", "briefing", "state of",
    "month in review", "monthly",
  ],
  summarize_week: [
    "this week", "weekly", "week in review", "weekly rollup", "weekly summary",
    "past week", "last week", "week recap", "7 days", "happened this week",
    "what happened this week",
  ],
  explain_performance_drop: [
    "dropping", "drop", "fell", "decline", "declining", "worse", "why is", "why did",
    "underperform", "roas down", "cpa up", "revenue down", "spend up", "not performing",
    "poor", "bad", "dropped", "lower", "decrease", "decreased", "sliding",
  ],
  identify_goal_risk: [
    "goal risk", "miss goal", "missing goal", "off target", "below target",
    "closest to risk", "goal", "target", "pace to goal", "on track", "off track",
    "behind", "ahead of goal",
  ],
  recommend_next_actions: [
    "what should i", "should i", "next action", "recommend", "what to do",
    "work on", "focus", "where do i start", "prioritize", "what first",
    "what's most important", "what is most important", "suggestions",
  ],
  explain_winner: [
    "winner", "winning", "best performing", "outperform", "highest roas",
    "top campaign", "what worked", "what's working", "best creative", "top performer",
    "strongest", "most successful", "leading",
  ],
  explain_loser: [
    "loser", "losing", "worst", "underperforming", "lowest", "poor performer",
    "bad campaign", "failing", "draining", "wasting budget", "weakest",
  ],
  find_scale_candidates: [
    "scale", "scaling", "ready to scale", "scale candidates", "what to scale",
    "budget increase", "increase budget", "grow", "expand", "more budget",
    "scale up", "scale opportunity", "which to scale",
  ],
  find_accounts_at_risk: [
    "at risk", "risk", "declining accounts", "accounts at risk", "which accounts",
    "trouble", "struggling", "danger", "problem accounts", "needs attention",
  ],
  summarize_creative_fatigue: [
    "creative fatigue", "fatigue", "ad fatigue", "refresh", "creative refresh",
    "stale creative", "which creative", "creative to pause", "worn out",
    "frequency", "ctr drop", "relevance drop",
  ],
  summarize_experiment_status: [
    "experiment", "a/b", "ab test", "trial", "experiment status",
    "promising test", "which experiment", "experiment result", "winner declared",
  ],
  summarize_recent_tests: [
    "recent tests", "test results", "latest tests", "what tests", "running tests",
    "test launched", "test outcome", "test winners", "test losers",
  ],
  summarize_blockers: [
    "blocked", "blockers", "what's blocked", "stuck", "what's stuck", "can't proceed",
    "holding up", "obstacles", "impediments", "issues", "failed actions",
  ],
  identify_pending_approvals: [
    "approval", "approve", "waiting", "pending", "need to approve",
    "approval queue", "needs sign-off", "sign off", "pending action",
    "awaiting approval", "decisions pending",
  ],
  find_highest_priority_issue: [
    "urgent", "critical", "most important", "biggest issue", "top issue",
    "emergency", "highest priority", "fire", "most pressing", "immediate",
    "right now", "blocking",
  ],
  unknown: [],
};

// ── Scoring ───────────────────────────────────────────────────────────────────

function score(question: string, keywords: string[]): number {
  const q = question.toLowerCase();
  return keywords.reduce((acc, kw) => acc + (q.includes(kw) ? 1 : 0), 0);
}

// ── Classifier ────────────────────────────────────────────────────────────────

export function classifyOptimizationAssistantIntent(
  question: string
): OptimizationAssistantIntent {
  if (!question || question.trim().length < 3) return "unknown";

  const intents = Object.entries(INTENT_KEYWORDS).filter(([k]) => k !== "unknown") as [
    OptimizationAssistantIntent,
    string[],
  ][];

  let best: OptimizationAssistantIntent = "find_highest_priority_issue";
  let bestScore = 0;

  for (const [intent, keywords] of intents) {
    const s = score(question, keywords);
    if (s > bestScore) {
      bestScore = s;
      best = intent;
    }
  }

  // Default: if no keyword matched at all, fall back to highest-priority discovery
  return bestScore === 0 ? "find_highest_priority_issue" : best;
}

// ── Intent labels (for display) ───────────────────────────────────────────────

export const INTENT_LABEL: Record<OptimizationAssistantIntent, string> = {
  summarize_today:            "Daily brief",
  summarize_account_state:    "Account summary",
  summarize_week:             "Weekly rollup",
  explain_performance_drop:   "Performance drop",
  identify_goal_risk:         "Goal risk",
  recommend_next_actions:     "Recommendations",
  explain_winner:             "Top performers",
  explain_loser:              "Underperformers",
  find_scale_candidates:      "Scale candidates",
  find_accounts_at_risk:      "Accounts at risk",
  summarize_creative_fatigue: "Creative fatigue",
  summarize_experiment_status:"Experiment status",
  summarize_recent_tests:     "Recent tests",
  summarize_blockers:         "Blockers",
  identify_pending_approvals: "Pending approvals",
  find_highest_priority_issue:"Highest priority",
  unknown:                    "General",
};
