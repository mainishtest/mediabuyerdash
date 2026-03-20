// ─── Decision Trace — Trace Builder ──────────────────────────────────────────
//
// Central builder. Assembles a complete DecisionTrace from typed output data.
// All input types are defined as minimal interfaces here to avoid circular imports
// from other lib modules. Each builder is a pure function — no DB access, no I/O.

import { buildCampaignConfidence, buildExperimentConfidence, buildCreativeConfidence, buildGuardrailConfidence, buildAssistantConfidence } from "./confidence";
import { buildCampaignEvidence, buildExperimentEvidence, buildCreativeEvidence, buildGuardrailEvidence, buildAssistantEvidence, buildDecisionEvidenceSummary } from "./evidence";
import { buildCampaignInfluences, buildExperimentInfluences, buildCreativeScoringInfluences, buildGuardrailInfluences, buildAssistantInfluences } from "./influences";
import { buildCampaignLimitations, buildExperimentLimitations, buildCreativeLimitations, buildGuardrailLimitations, buildAssistantLimitations } from "./limitations";
import type {
  DecisionTrace,
  DecisionTraceSummary,
  DecisionTraceStep,
  DecisionConstraint,
  TraceActionLink,
} from "./types";

// ── Standard constraints ──────────────────────────────────────────────────────

const ATTRIBUTION_CONSTRAINT: DecisionConstraint = {
  label:       "Attribution window: 7 days",
  description: "All conversion metrics use a 7-day attribution window per platform policy.",
  type:        "attribution",
};

const CRM_CONSTRAINT: DecisionConstraint = {
  label:       "CRM is source of truth",
  description: "ROAS and CPA always use CRM/Shopify data, not Meta-reported revenue.",
  type:        "rule",
};

const TIMEZONE_CONSTRAINT: DecisionConstraint = {
  label:       "Dayparting: ad account timezone",
  description: "Dayparting and hour-of-day analysis use the ad account's configured timezone.",
  type:        "rule",
};

const STANDARD_CONSTRAINTS: DecisionConstraint[] = [
  ATTRIBUTION_CONSTRAINT,
  CRM_CONSTRAINT,
];

// ── Campaign recommendation trace ─────────────────────────────────────────────

export interface CampaignTraceInput {
  campaignId:      string;
  campaignName:    string;
  clientId?:       string;
  clientName?:     string;
  metaSpend:       number;
  crmRevenue:      number;
  crmOrders:       number;
  evaluatedRoas:   number;
  evaluatedCpa:    number;
  roasGoalValue:   number | null;
  cpaGoalValue:    number | null;
  meetsRoasGoal:   boolean;
  meetsCpaGoal:    boolean;
  healthStatus:    string;
  hasGoal:         boolean;
  goalSource:      string;
  dataWindowDays:  number;
  actionType:      string;
  priority:        string;
  reason:          string;
  dataWarnings?:   string[];
}

export function buildCampaignRecommendationTrace(input: CampaignTraceInput): DecisionTrace {
  const warnings = input.dataWarnings ?? [];

  const confidence = buildCampaignConfidence({
    hasGoal: input.hasGoal, goalSource: input.goalSource,
    dataWindowDays: input.dataWindowDays, evaluatedRoas: input.evaluatedRoas,
    evaluatedCpa: input.evaluatedCpa, roasGoalValue: input.roasGoalValue,
    cpaGoalValue: input.cpaGoalValue, healthStatus: input.healthStatus,
    dataWarnings: warnings,
  });

  const evidence = buildCampaignEvidence({
    metaSpend: input.metaSpend, crmRevenue: input.crmRevenue,
    crmOrders: input.crmOrders, evaluatedRoas: input.evaluatedRoas,
    evaluatedCpa: input.evaluatedCpa, roasGoalValue: input.roasGoalValue,
    cpaGoalValue: input.cpaGoalValue, meetsRoasGoal: input.meetsRoasGoal,
    meetsCpaGoal: input.meetsCpaGoal, healthStatus: input.healthStatus,
    goalSource: input.goalSource, dataWindowDays: input.dataWindowDays,
  });

  const influences = buildCampaignInfluences({
    healthStatus: input.healthStatus, meetsRoasGoal: input.meetsRoasGoal,
    meetsCpaGoal: input.meetsCpaGoal, roasGoalValue: input.roasGoalValue,
    cpaGoalValue: input.cpaGoalValue, evaluatedRoas: input.evaluatedRoas,
    evaluatedCpa: input.evaluatedCpa, actionType: input.actionType,
  });

  const limitations = buildCampaignLimitations({
    hasGoal: input.hasGoal, roasGoalValue: input.roasGoalValue,
    cpaGoalValue: input.cpaGoalValue, dataWindowDays: input.dataWindowDays,
    healthStatus: input.healthStatus, evaluatedRoas: input.evaluatedRoas,
    crmOrders: input.crmOrders, dataWarnings: warnings,
  });

  const steps: DecisionTraceStep[] = [
    { order: 1, label: "Data availability check", description: `CRM orders: ${input.crmOrders}, Spend: $${input.metaSpend.toFixed(0)}, Revenue: $${input.crmRevenue.toFixed(0)}`, passed: input.metaSpend > 0, isBlocking: true },
    { order: 2, label: "Goal resolution", description: input.hasGoal ? `Goal sourced from ${input.goalSource}: ROAS ${input.roasGoalValue?.toFixed(2) ?? "—"}×, CPA $${input.cpaGoalValue?.toFixed(2) ?? "—"}` : "No goal configured — using spend thresholds only", passed: input.hasGoal, isBlocking: false },
    { order: 3, label: "ROAS evaluation", description: input.roasGoalValue ? `${input.evaluatedRoas.toFixed(2)}× vs ${input.roasGoalValue.toFixed(2)}× goal — ${input.meetsRoasGoal ? "✓ Meets goal" : "✗ Below goal"}` : `ROAS: ${input.evaluatedRoas.toFixed(2)}× (no goal set)`, passed: input.meetsRoasGoal || !input.roasGoalValue, isBlocking: false },
    { order: 4, label: "CPA evaluation", description: input.cpaGoalValue ? `$${input.evaluatedCpa.toFixed(2)} vs $${input.cpaGoalValue.toFixed(2)} goal — ${input.meetsCpaGoal ? "✓ Meets goal" : "✗ Above goal"}` : `CPA: $${input.evaluatedCpa.toFixed(2)} (no goal set)`, passed: input.meetsCpaGoal || !input.cpaGoalValue, isBlocking: false },
    { order: 5, label: "Health classification", description: `Status: ${input.healthStatus.replace(/_/g, " ")} → Recommendation: ${input.actionType.replace(/_/g, " ")} (${input.priority} priority)`, passed: true, isBlocking: false },
  ];

  const actionLinks: TraceActionLink[] = [
    { label: "Open campaign", href: `/optimization`, icon: "◈", description: "View campaign in optimization dashboard" },
    { label: "Set campaign goals", href: `/clients`, icon: "◎", description: "Configure ROAS and CPA goals" },
    { label: "Command Center", href: `/command-center`, icon: "⌘", description: "See all priorities" },
  ];

  return {
    id:           `campaign_recommendation:${input.campaignId}`,
    outputType:   "campaign_recommendation",
    outputId:     input.campaignId,
    outputLabel:  input.campaignName,
    summary:      input.reason,
    confidence,
    evidence,
    steps,
    influences,
    constraints:  [...STANDARD_CONSTRAINTS, TIMEZONE_CONSTRAINT],
    limitations,
    relatedOutputs: [],
    actionLinks,
    clientId:     input.clientId,
    clientName:   input.clientName,
    generatedAt:  new Date().toISOString(),
    dataWarnings: warnings,
  };
}

// ── Assistant response trace ──────────────────────────────────────────────────
// Pure/client-side builder — only uses data already in the response object.

export interface AssistantResponseTraceInput {
  responseId:     string;
  intent:         string;
  summary:        string;
  isGrounded:     boolean;
  evidenceItems:  Array<{ label: string; value: string; source: string; direction?: "positive" | "negative" | "neutral" }>;
  entityCount:    number;
  dataWarnings:   string[];
  learningCount:  number;
  generatedAt:    string;
}

export function buildAssistantResponseTrace(input: AssistantResponseTraceInput): DecisionTrace {
  const isTemplateOnly = !input.isGrounded;

  const confidence = buildAssistantConfidence({
    isGrounded:    input.isGrounded,
    dataWarnings:  input.dataWarnings,
    evidenceCount: input.evidenceItems.length,
    intent:        input.intent,
    hasEntities:   input.entityCount > 0,
  });

  const evidence = buildAssistantEvidence({ evidence: input.evidenceItems });

  const influences = buildAssistantInfluences({
    intent:        input.intent,
    isAiGenerated: !isTemplateOnly,
    evidenceCount: input.evidenceItems.length,
    learningCount: input.learningCount,
  });

  const limitations = buildAssistantLimitations({
    dataWarnings:   input.dataWarnings,
    isTemplateOnly,
    evidenceCount:  input.evidenceItems.length,
    intent:         input.intent,
  });

  const steps: DecisionTraceStep[] = [
    { order: 1, label: "Intent classification", description: `Question classified as: ${input.intent.replace(/_/g, " ")}`, passed: input.intent !== "unknown", isBlocking: false },
    { order: 2, label: "Context assembly", description: `Assembled from: Command Center, Executive Reporting, Learning Memory aggregators`, passed: true, isBlocking: true },
    { order: 3, label: "Evidence extraction", description: `${input.evidenceItems.length} evidence item${input.evidenceItems.length !== 1 ? "s" : ""} extracted deterministically from context data`, passed: input.evidenceItems.length > 0, isBlocking: false },
    { order: 4, label: "Response generation", description: isTemplateOnly ? "Template-based response built from live data (no AI API key)" : "Claude generated summary from compressed context prompt", passed: true, isBlocking: false },
  ];

  const actionLinks: TraceActionLink[] = [
    { label: "Command Center", href: "/command-center", icon: "⌘", description: "All priorities in one view" },
    { label: "Executive report", href: "/reports/executive", icon: "◈", description: "Full period report" },
    { label: "Learning memory", href: "/insights/memory", icon: "◇", description: "Captured patterns" },
  ];

  return {
    id:           `assistant_response:${input.responseId}`,
    outputType:   "assistant_response",
    outputId:     input.responseId,
    outputLabel:  `Assistant: ${input.intent.replace(/_/g, " ")}`,
    summary:      input.summary.slice(0, 120) + (input.summary.length > 120 ? "…" : ""),
    confidence,
    evidence,
    steps,
    influences,
    constraints:  STANDARD_CONSTRAINTS,
    limitations,
    relatedOutputs: [],
    actionLinks,
    generatedAt:  input.generatedAt,
    dataWarnings: input.dataWarnings,
  };
}

// ── Experiment outcome trace ──────────────────────────────────────────────────

export interface ExperimentTraceInput {
  experimentId:      string;
  experimentName:    string;
  clientId?:         string;
  clientName?:       string;
  outcome:           string;
  confidence:        number;
  primaryLift:       number;
  primaryMetric:     string;
  successThreshold:  number;
  controlRoas:       number;
  challengerRoas:    number;
  controlSpend:      number;
  challengerSpend:   number;
  controlOrders:     number;
  challengerOrders:  number;
  daysRunning:       number;
  winningVariant:    "control" | "challenger" | null;
  guardrailBreaches: string[];
  recommendedAction: string;
  insightText:       string;
}

export function buildExperimentOutcomeTrace(input: ExperimentTraceInput): DecisionTrace {
  const confidence = buildExperimentConfidence({
    detectionConfidence: input.confidence,
    outcome:             input.outcome,
    controlSpend:        input.controlSpend,
    challengerSpend:     input.challengerSpend,
    controlOrders:       input.controlOrders,
    challengerOrders:    input.challengerOrders,
    daysRunning:         input.daysRunning,
  });

  const evidence = buildExperimentEvidence({
    controlRoas: input.controlRoas, challengerRoas: input.challengerRoas,
    controlSpend: input.controlSpend, challengerSpend: input.challengerSpend,
    controlOrders: input.controlOrders, challengerOrders: input.challengerOrders,
    primaryLift: input.primaryLift, confidence: input.confidence,
    outcome: input.outcome, primaryMetric: input.primaryMetric,
    daysRunning: input.daysRunning,
  });

  const influences = buildExperimentInfluences({
    outcome: input.outcome, successThreshold: input.successThreshold,
    primaryMetric: input.primaryMetric, winningVariant: input.winningVariant,
    guardrailBreaches: input.guardrailBreaches, recommendedAction: input.recommendedAction,
  });

  const limitations = buildExperimentLimitations({
    outcome: input.outcome, daysRunning: input.daysRunning,
    controlSpend: input.controlSpend, challengerSpend: input.challengerSpend,
    controlOrders: input.controlOrders, challengerOrders: input.challengerOrders,
    guardrailBreaches: input.guardrailBreaches, confidence: input.confidence,
  });

  const liftPct = `${input.primaryLift >= 0 ? "+" : ""}${(input.primaryLift * 100).toFixed(1)}%`;

  const steps: DecisionTraceStep[] = [
    { order: 1, label: "Data quality check", description: `Control spend: $${input.controlSpend.toFixed(0)}, Challenger spend: $${input.challengerSpend.toFixed(0)}`, passed: (input.controlSpend + input.challengerSpend) > 0, isBlocking: true },
    { order: 2, label: "Coverage check", description: `Control orders: ${input.controlOrders}, Challenger orders: ${input.challengerOrders} — ${(input.controlOrders + input.challengerOrders) >= 10 ? "Sufficient" : "Low"} conversion volume`, passed: (input.controlOrders + input.challengerOrders) >= 5, isBlocking: false },
    { order: 3, label: "Guardrail check", description: input.guardrailBreaches.length === 0 ? "No guardrail breaches detected" : `${input.guardrailBreaches.length} breach${input.guardrailBreaches.length !== 1 ? "es" : ""}: ${input.guardrailBreaches.join(", ")}`, passed: input.guardrailBreaches.length === 0, isBlocking: false },
    { order: 4, label: "Lift evaluation", description: `${input.primaryMetric.replace(/_/g, " ")} lift: ${liftPct} — threshold required: ${(input.successThreshold * 100).toFixed(0)}%`, passed: Math.abs(input.primaryLift) >= input.successThreshold, isBlocking: false },
    { order: 5, label: "Winner classification", description: `Outcome: ${input.outcome.replace(/_/g, " ")}${input.winningVariant ? ` — winner: ${input.winningVariant}` : ""} (confidence: ${(input.confidence * 100).toFixed(0)}%)`, passed: !["failed_test", "insufficient_data"].includes(input.outcome), isBlocking: false },
  ];

  const actionLinks: TraceActionLink[] = [
    { label: "Open experiment", href: `/experiments`, icon: "⊡", description: "View full experiment detail" },
    { label: "Learning memory", href: `/insights/memory`, icon: "◇", description: "See captured learnings" },
    { label: "Creative Lab", href: `/creative-lab`, icon: "◇", description: "Apply learning to next brief" },
  ];

  return {
    id:           `experiment_outcome:${input.experimentId}`,
    outputType:   "experiment_outcome",
    outputId:     input.experimentId,
    outputLabel:  input.experimentName,
    summary:      input.insightText.slice(0, 150),
    confidence,
    evidence,
    steps,
    influences,
    constraints:  STANDARD_CONSTRAINTS,
    limitations,
    relatedOutputs: [],
    actionLinks,
    clientId:     input.clientId,
    clientName:   input.clientName,
    generatedAt:  new Date().toISOString(),
    dataWarnings: [],
  };
}

// ── Publish guardrail trace ───────────────────────────────────────────────────

export interface GuardrailTraceInput {
  itemId:         string;
  itemTitle:      string;
  clientId?:      string;
  clientName?:    string;
  executionMode:  string;
  approvalStatus: boolean;
  hasValidation:  boolean;
  checks: Array<{ key: string; label: string; passed: boolean; required: boolean; message: string }>;
}

export function buildPublishGuardrailTrace(input: GuardrailTraceInput): DecisionTrace {
  const requiredFailed = input.checks.filter((c) => c.required && !c.passed).length;
  const requiredPassed = input.checks.filter((c) => c.required && c.passed).length;
  const optionalFailed = input.checks.filter((c) => !c.required && !c.passed).length;
  const optionalPassed = input.checks.filter((c) => !c.required && c.passed).length;

  const confidence = buildGuardrailConfidence({
    requiredFailed, requiredPassed, optionalFailed, optionalPassed,
    totalChecks: input.checks.length,
  });

  const evidence = buildGuardrailEvidence({ checks: input.checks });

  const influences = buildGuardrailInfluences({
    executionMode:    input.executionMode,
    approvalStatus:   input.approvalStatus,
    validationPassed: input.hasValidation,
  });

  const limitations = buildGuardrailLimitations({
    requiredFailed, optionalFailed, hasValidation: input.hasValidation,
  });

  const steps: DecisionTraceStep[] = input.checks.map((c, i) => ({
    order:       i + 1,
    label:       c.label,
    description: c.message,
    passed:      c.passed,
    isBlocking:  c.required,
  }));

  const actionLinks: TraceActionLink[] = [
    { label: "Open publish prep", href: `/creative-lab/publish-prep`, icon: "◇", description: "Review publish prep item" },
    { label: "Creative Lab", href: `/creative-lab`, icon: "◇", description: "Return to creative workflow" },
    { label: "Approval queue", href: `/automation`, icon: "✓", description: "Review pending approvals" },
  ];

  const allRequired = requiredFailed === 0;
  return {
    id:           `publish_guardrail:${input.itemId}`,
    outputType:   "publish_guardrail",
    outputId:     input.itemId,
    outputLabel:  input.itemTitle,
    summary:      allRequired ? `All required guardrails passed — ${optionalFailed > 0 ? optionalFailed + " optional check(s) need review" : "item is ready for launch"}` : `${requiredFailed} required guardrail${requiredFailed !== 1 ? "s" : ""} failed — launch blocked`,
    confidence,
    evidence,
    steps,
    influences,
    constraints: [
      { label: "Human approval required", description: "All launch paths require human approval — no autonomous publishing.", type: "guardrail" },
    ],
    limitations,
    relatedOutputs: [],
    actionLinks,
    clientId:     input.clientId,
    clientName:   input.clientName,
    generatedAt:  new Date().toISOString(),
    dataWarnings: [],
  };
}

// ── attachTraceToOutput ───────────────────────────────────────────────────────
// Utility: adds a trace reference to any output object without modifying its type.

export function attachTraceToOutput<T extends object>(
  output: T,
  trace: DecisionTrace
): T & { _trace: DecisionTrace } {
  return { ...output, _trace: trace };
}

// ── summarizeDecisionTrace ────────────────────────────────────────────────────

export function summarizeDecisionTrace(trace: DecisionTrace): DecisionTraceSummary {
  return {
    id:              trace.id,
    outputType:      trace.outputType,
    outputLabel:     trace.outputLabel,
    confidenceLevel: trace.confidence.level,
    topFinding:      trace.summary,
    limitationCount: trace.limitations.filter((l) => l.severity !== "informational").length,
    generatedAt:     trace.generatedAt,
  };
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export { buildDecisionEvidenceSummary } from "./evidence";
export { buildDecisionConfidence }      from "./confidence";
export { buildDecisionInfluences }      from "./influences";
export { buildDecisionLimitations }     from "./limitations";
