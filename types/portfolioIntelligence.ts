// ─── Portfolio Intelligence — Typed Models ────────────────────────────────────
//
// Cross-account prioritization and intelligence layer.
// Composes daily executive summaries, outcomes, proactive triggers,
// and portfolio health into a unified priority queue.
//
// Pure type definitions only — no business logic here.

// ── Priority category (what should the operator do?) ────────────────────────

export type PortfolioPriorityCategory =
  | "scale_now"
  | "investigate_now"
  | "refresh_needed"
  | "test_needed"
  | "blocked_action"
  | "monitor";

// ── Priority score (explainable) ────────────────────────────────────────────

export type PortfolioPriorityScore = {
  total:     number;   // 0–100, higher = more urgent
  factors:   PortfolioPriorityFactor[];
};

export type PortfolioPriorityFactor = {
  label:     string;   // "ROAS above goal"
  weight:    number;   // contribution to total score
  direction: "positive" | "negative" | "neutral";
};

// ── Evidence item ───────────────────────────────────────────────────────────

export type PortfolioIntelligenceEvidence = {
  label:     string;   // "ROAS"
  value:     string;   // "2.45×"
  source:    string;   // "CRM reconciliation"
  direction: "positive" | "negative" | "neutral";
};

// ── Action suggestion ───────────────────────────────────────────────────────

export type PortfolioActionSuggestion = {
  label:       string;   // "Review scale plan"
  description: string;   // why this action
  href:        string;   // workflow route
};

// ── Priority item (unified queue entry) ─────────────────────────────────────

export type PortfolioPriorityItem = {
  id:          string;
  category:    PortfolioPriorityCategory;
  clientId:    string;
  clientName:  string;
  title:       string;
  reason:      string;
  score:       PortfolioPriorityScore;
  evidence:    PortfolioIntelligenceEvidence[];
  action:      PortfolioActionSuggestion;
  isBlocked:   boolean;
  isReady:     boolean;
  trustState:  string;   // "healthy" | "warning" | "suspect" | "blocked"
  detectedAt:  string;
};

// ── Specialized views ───────────────────────────────────────────────────────

export type PortfolioScaleCandidate = {
  clientId:    string;
  clientName:  string;
  roas:        number | null;
  roasGoal:    number | null;
  trend:       string;
  spend:       number;
  readiness:   string;   // "ready" | "possible" | "not_ready"
  evidence:    PortfolioIntelligenceEvidence[];
  action:      PortfolioActionSuggestion;
};

export type PortfolioDeclineSignal = {
  clientId:    string;
  clientName:  string;
  roas:        number | null;
  roasGoal:    number | null;
  trend:       string;
  status:      string;   // "at_risk" | "critical"
  alertCount:  number;
  evidence:    PortfolioIntelligenceEvidence[];
  action:      PortfolioActionSuggestion;
};

export type PortfolioBlocker = {
  id:          string;
  clientId:    string;
  clientName:  string;
  blockerType: string;
  title:       string;
  description: string;
  action:      PortfolioActionSuggestion;
};

export type PortfolioOpportunity = {
  id:              string;
  clientId:        string;
  clientName:      string;
  opportunityType: string;
  title:           string;
  description:     string;
  evidence:        PortfolioIntelligenceEvidence[];
  action:          PortfolioActionSuggestion;
};

export type PortfolioRisk = {
  id:          string;
  clientId:    string;
  clientName:  string;
  riskType:    string;
  title:       string;
  description: string;
  severity:    "low" | "medium" | "high" | "critical";
  action:      PortfolioActionSuggestion;
};

// ── Filter state ────────────────────────────────────────────────────────────

export type PortfolioIntelligenceFilterState = {
  clientId:     string;
  category:     PortfolioPriorityCategory | "";
  trustState:   string;
  readiness:    string;
  blockerState: "blocked" | "ready" | "";
};

// ── Full intelligence summary ───────────────────────────────────────────────

export type PortfolioIntelligenceSummary = {
  generatedAt:     string;
  totalAccounts:   number;
  // Priority queue
  priorities:      PortfolioPriorityItem[];
  // Specialized sections
  scaleCandidates: PortfolioScaleCandidate[];
  declineSignals:  PortfolioDeclineSignal[];
  blockers:        PortfolioBlocker[];
  opportunities:   PortfolioOpportunity[];
  risks:           PortfolioRisk[];
  // Counts
  scaleNowCount:       number;
  investigateNowCount: number;
  refreshNeededCount:  number;
  testNeededCount:     number;
  blockedActionCount:  number;
  monitorCount:        number;
  // Data quality
  inputSources:    string[];
  warnings:        string[];
};
