// ─── Decision Trace — Typed Models ───────────────────────────────────────────
//
// Pure TypeScript interfaces for the explainability, confidence, and decision
// trace layer. No business logic. No runtime code.

// ── Output types ─────────────────────────────────────────────────────────────

export type DecisionOutputType =
  | "campaign_recommendation"
  | "goal_aware_recommendation"
  | "assistant_response"
  | "experiment_outcome"
  | "creative_score"
  | "publish_guardrail";

// ── Confidence ────────────────────────────────────────────────────────────────

export type DecisionConfidenceLevel = "low" | "medium" | "high";

export interface DecisionConfidence {
  level:       DecisionConfidenceLevel;
  score:       number;           // 0–100
  reasons:     string[];         // positive factors ("Full 7-day attribution window")
  limitations: string[];         // negative factors ("No CPA goal configured")
}

// ── Evidence ─────────────────────────────────────────────────────────────────

export interface DecisionEvidence {
  label:           string;       // "CRM ROAS"
  value:           string;       // "2.34×"
  source:          string;       // "Shopify/CRM reconciliation"
  isSourceOfTruth: boolean;      // true for CRM ROAS/CPA per product rules
  direction?:      "positive" | "negative" | "neutral";
}

// ── Trace steps ───────────────────────────────────────────────────────────────

export interface DecisionTraceStep {
  order:       number;
  label:       string;           // "Goal comparison"
  description: string;           // "ROAS 2.34× exceeds goal of 2.0× (CRM source)"
  passed:      boolean;
  isBlocking:  boolean;          // false for informational steps
}

// ── Constraints ───────────────────────────────────────────────────────────────

export type DecisionConstraintType =
  | "attribution"
  | "data_window"
  | "goal"
  | "rule"
  | "policy"
  | "guardrail";

export interface DecisionConstraint {
  label:       string;
  description: string;
  type:        DecisionConstraintType;
}

// ── Influences ────────────────────────────────────────────────────────────────

export type DecisionInfluenceSource =
  | "learning"
  | "rule"
  | "goal"
  | "threshold"
  | "guardrail"
  | "alert";

export interface DecisionInfluence {
  label:       string;           // "Learning: hook-led creatives outperform"
  source:      DecisionInfluenceSource;
  sourceId?:   string;
  description: string;
  weight:      "primary" | "secondary" | "informational";
}

// ── Limitations ───────────────────────────────────────────────────────────────

export type DecisionLimitationSeverity = "blocking" | "warning" | "informational";

export interface DecisionLimitation {
  label:       string;           // "Short data window"
  description: string;           // "Only 3 days of data — 7 days required for full attribution"
  severity:    DecisionLimitationSeverity;
}

// ── Traceable output reference ────────────────────────────────────────────────

export interface TraceableOutputReference {
  type:  DecisionOutputType;
  id:    string;
  label: string;
  href:  string;
}

// ── Action link ───────────────────────────────────────────────────────────────

export interface TraceActionLink {
  label:       string;
  href:        string;
  icon:        string;
  description: string;
}

// ── Full decision trace ───────────────────────────────────────────────────────

export interface DecisionTrace {
  id:             string;        // deterministic: `${outputType}:${outputId}`
  outputType:     DecisionOutputType;
  outputId:       string;
  outputLabel:    string;        // human-readable name of the output
  summary:        string;        // one-sentence explanation
  confidence:     DecisionConfidence;
  evidence:       DecisionEvidence[];
  steps:          DecisionTraceStep[];
  influences:     DecisionInfluence[];
  constraints:    DecisionConstraint[];
  limitations:    DecisionLimitation[];
  relatedOutputs: TraceableOutputReference[];
  actionLinks:    TraceActionLink[];
  clientId?:      string;
  clientName?:    string;
  generatedAt:    string;
  dataWarnings:   string[];
}

// ── Summary (for lists) ───────────────────────────────────────────────────────

export interface DecisionTraceSummary {
  id:               string;
  outputType:       DecisionOutputType;
  outputLabel:      string;
  confidenceLevel:  DecisionConfidenceLevel;
  topFinding:       string;
  limitationCount:  number;
  generatedAt:      string;
}

// ── Surface context ───────────────────────────────────────────────────────────

export interface ExplainabilitySurfaceContext {
  outputType: DecisionOutputType;
  outputId:   string;
  clientId?:  string;
  dateFrom?:  string;
  dateTo?:    string;
}
