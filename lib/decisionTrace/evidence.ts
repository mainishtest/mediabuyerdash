// ─── Decision Trace — Evidence Builder ───────────────────────────────────────
//
// Pure functions. Converts raw output data into typed DecisionEvidence items.
// CRM ROAS/CPA are always marked isSourceOfTruth = true per product rules.

import type { DecisionEvidence } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function fmtRoas(n: number): string {
  return `${n.toFixed(2)}×`;
}

// ── Campaign recommendation evidence ─────────────────────────────────────────

interface CampaignEvidenceInput {
  metaSpend:      number;
  crmRevenue:     number;
  crmOrders:      number;
  evaluatedRoas:  number;
  evaluatedCpa:   number;
  roasGoalValue:  number | null;
  cpaGoalValue:   number | null;
  meetsRoasGoal:  boolean;
  meetsCpaGoal:   boolean;
  healthStatus:   string;
  goalSource:     string;
  dataWindowDays: number;
}

export function buildCampaignEvidence(input: CampaignEvidenceInput): DecisionEvidence[] {
  const items: DecisionEvidence[] = [];

  if (input.metaSpend > 0) {
    items.push({
      label: "Meta spend",
      value: fmtCurrency(input.metaSpend),
      source: "Meta delivery (7-day window)",
      isSourceOfTruth: false,
      direction: "neutral",
    });
  }

  if (input.crmRevenue > 0) {
    items.push({
      label: "CRM revenue",
      value: fmtCurrency(input.crmRevenue),
      source: "Shopify/CRM reconciliation",
      isSourceOfTruth: true,
      direction: "positive",
    });
  }

  if (input.crmOrders > 0) {
    items.push({
      label: "CRM orders",
      value: String(input.crmOrders),
      source: "Shopify/CRM reconciliation",
      isSourceOfTruth: true,
      direction: "neutral",
    });
  }

  if (input.evaluatedRoas > 0) {
    const goal = input.roasGoalValue;
    items.push({
      label: "Evaluated ROAS",
      value: goal ? `${fmtRoas(input.evaluatedRoas)} vs ${fmtRoas(goal)} goal` : fmtRoas(input.evaluatedRoas),
      source: "CRM reconciliation (source of truth)",
      isSourceOfTruth: true,
      direction: goal ? (input.meetsRoasGoal ? "positive" : "negative") : "neutral",
    });
  }

  if (input.evaluatedCpa > 0) {
    const goal = input.cpaGoalValue;
    items.push({
      label: "Evaluated CPA",
      value: goal ? `${fmtCurrency(input.evaluatedCpa)} vs ${fmtCurrency(goal)} goal` : fmtCurrency(input.evaluatedCpa),
      source: "CRM reconciliation (source of truth)",
      isSourceOfTruth: true,
      direction: goal ? (input.meetsCpaGoal ? "positive" : "negative") : "neutral",
    });
  }

  items.push({
    label: "Data window",
    value: `${input.dataWindowDays} days (7-day attribution per policy)`,
    source: "Attribution policy",
    isSourceOfTruth: false,
    direction: input.dataWindowDays >= 7 ? "positive" : "negative",
  });

  if (input.goalSource !== "none") {
    items.push({
      label: "Goal source",
      value: input.goalSource === "explicit" ? "Campaign-specific goal" : "Client default goal",
      source: "Goal configuration",
      isSourceOfTruth: false,
      direction: "neutral",
    });
  }

  return items;
}

// ── Experiment outcome evidence ───────────────────────────────────────────────

interface ExperimentEvidenceInput {
  controlRoas:       number;
  challengerRoas:    number;
  controlSpend:      number;
  challengerSpend:   number;
  controlOrders:     number;
  challengerOrders:  number;
  primaryLift:       number;
  confidence:        number;
  outcome:           string;
  primaryMetric:     string;
  daysRunning:       number;
}

export function buildExperimentEvidence(input: ExperimentEvidenceInput): DecisionEvidence[] {
  const items: DecisionEvidence[] = [];
  const liftPct = `${input.primaryLift >= 0 ? "+" : ""}${(input.primaryLift * 100).toFixed(1)}%`;

  items.push({
    label: `${input.primaryMetric.replace(/_/g, " ")} lift`,
    value: liftPct,
    source: "Experiment comparison",
    isSourceOfTruth: false,
    direction: input.primaryLift > 0.02 ? "positive" : input.primaryLift < -0.02 ? "negative" : "neutral",
  });

  items.push({
    label: "Statistical confidence",
    value: `${(input.confidence * 100).toFixed(0)}%`,
    source: "Winner detection algorithm",
    isSourceOfTruth: false,
    direction: input.confidence >= 0.7 ? "positive" : input.confidence >= 0.5 ? "neutral" : "negative",
  });

  if (input.controlRoas > 0 || input.challengerRoas > 0) {
    items.push({
      label: "Control ROAS",
      value: fmtRoas(input.controlRoas),
      source: "CRM reconciliation",
      isSourceOfTruth: true,
      direction: "neutral",
    });
    items.push({
      label: "Challenger ROAS",
      value: fmtRoas(input.challengerRoas),
      source: "CRM reconciliation",
      isSourceOfTruth: true,
      direction: input.challengerRoas > input.controlRoas ? "positive" : "negative",
    });
  }

  items.push({
    label: "Total spend",
    value: fmtCurrency(input.controlSpend + input.challengerSpend),
    source: "Meta delivery",
    isSourceOfTruth: false,
    direction: "neutral",
  });

  items.push({
    label: "Total conversions",
    value: String(input.controlOrders + input.challengerOrders),
    source: "CRM reconciliation",
    isSourceOfTruth: true,
    direction: (input.controlOrders + input.challengerOrders) >= 10 ? "positive" : "negative",
  });

  items.push({
    label: "Run duration",
    value: `${input.daysRunning} day${input.daysRunning !== 1 ? "s" : ""}`,
    source: "Experiment timeline",
    isSourceOfTruth: false,
    direction: input.daysRunning >= 7 ? "positive" : "negative",
  });

  return items;
}

// ── Creative score evidence ───────────────────────────────────────────────────

interface CreativeEvidenceInput {
  overallScore:    number;
  dimensionScores: Record<string, number>;
  variantType:     string;
  approvalReadiness: string;
  briefIntent?:    string;
}

export function buildCreativeEvidence(input: CreativeEvidenceInput): DecisionEvidence[] {
  const items: DecisionEvidence[] = [];

  items.push({
    label: "Overall score",
    value: `${input.overallScore}/100`,
    source: "Heuristic scoring engine",
    isSourceOfTruth: false,
    direction: input.overallScore >= 70 ? "positive" : input.overallScore >= 50 ? "neutral" : "negative",
  });

  items.push({
    label: "Creative type",
    value: input.variantType,
    source: "Brief configuration",
    isSourceOfTruth: false,
    direction: "neutral",
  });

  if (input.briefIntent) {
    items.push({
      label: "Brief intent",
      value: input.briefIntent,
      source: "Creative brief",
      isSourceOfTruth: false,
      direction: "neutral",
    });
  }

  items.push({
    label: "Approval readiness",
    value: input.approvalReadiness.replace(/_/g, " "),
    source: "Scoring engine",
    isSourceOfTruth: false,
    direction: input.approvalReadiness === "ready" ? "positive" : input.approvalReadiness === "needs_review" ? "neutral" : "negative",
  });

  // Top 3 lowest-scoring dimensions
  const dims = Object.entries(input.dimensionScores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  dims.forEach(([dim, score]) => {
    items.push({
      label: dim.replace(/_/g, " "),
      value: `${score}/10`,
      source: "Dimension scoring",
      isSourceOfTruth: false,
      direction: score >= 7 ? "positive" : score >= 5 ? "neutral" : "negative",
    });
  });

  return items;
}

// ── Publish guardrail evidence ────────────────────────────────────────────────

interface GuardrailEvidenceInput {
  checks: Array<{ key: string; label: string; passed: boolean; required: boolean; message: string }>;
}

export function buildGuardrailEvidence(input: GuardrailEvidenceInput): DecisionEvidence[] {
  return input.checks.map((c) => ({
    label: c.label,
    value: c.passed ? "Passed" : "Failed",
    source: c.required ? "Required guardrail" : "Optional guardrail",
    isSourceOfTruth: false,
    direction: (c.passed ? "positive" : c.required ? "negative" : "neutral") as "positive" | "negative" | "neutral",
  }));
}

// ── Assistant response evidence ───────────────────────────────────────────────

interface AssistantEvidenceInput {
  evidence: Array<{ label: string; value: string; source: string; direction?: "positive" | "negative" | "neutral" }>;
}

export function buildAssistantEvidence(input: AssistantEvidenceInput): DecisionEvidence[] {
  return input.evidence.map((e) => ({
    label:           e.label,
    value:           e.value,
    source:          e.source,
    isSourceOfTruth: e.source.toLowerCase().includes("crm") || e.source.toLowerCase().includes("reconciliation"),
    direction:       e.direction,
  }));
}

// ── Public summary builder ────────────────────────────────────────────────────

export function buildDecisionEvidenceSummary(evidence: DecisionEvidence[]): string {
  const sourceOfTruth = evidence.filter((e) => e.isSourceOfTruth);
  const total = evidence.length;
  if (total === 0) return "No supporting data available.";
  return `${total} data point${total !== 1 ? "s" : ""} used${sourceOfTruth.length > 0 ? `, including ${sourceOfTruth.length} CRM source-of-truth metric${sourceOfTruth.length !== 1 ? "s" : ""}` : ""}.`;
}
