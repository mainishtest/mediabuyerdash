// lib/publishPrep/guardrails.ts
// Guardrail evaluation for the publish preparation and launch workflow.
// All functions are pure — no API calls, no DB access.
//
// Guardrails are the final gate before a launch action fires.
// Validation checks correctness; guardrails check safety and policy.
// Both must pass for ready_to_publish or guarded_publish to proceed.

import type {
  PublishGuardrailResult,
  PublishPrepItem,
  LaunchExecutionMode,
}                             from "../../types/publishPrep";
import type {
  PublishValidationResult,
}                             from "../../types/publishPrep";

// ---------------------------------------------------------------------------
// Individual guardrail checks
// ---------------------------------------------------------------------------

function guardrailHumanApprovalRequired(
  approvedForLaunch: boolean,
): PublishGuardrailResult {
  return {
    key:      "human_approval_required",
    label:    "Human Approval",
    passed:   approvedForLaunch,
    required: true,
    message:  approvedForLaunch
      ? "Human approval confirmed — launch action is unblocked."
      : "A human reviewer must approve this item before any launch action can proceed.",
  };
}

function guardrailValidationMustPass(
  validation: PublishValidationResult | null,
): PublishGuardrailResult {
  const passed = validation !== null && validation.passed;
  return {
    key:      "validation_must_pass",
    label:    "Validation Passed",
    passed,
    required: true,
    message:  passed
      ? "All required validation checks passed."
      : validation === null
        ? "Validation has not been run yet — run validation before approving."
        : `Validation has ${validation.blockers.length} blocking issue${validation.blockers.length !== 1 ? "s" : ""}.`,
  };
}

function guardrailAllowedExecutionMode(
  mode: LaunchExecutionMode,
): PublishGuardrailResult {
  const allowed: LaunchExecutionMode[] = ["manual_publish", "guarded_publish"];
  const passed = allowed.includes(mode);
  return {
    key:      "allowed_execution_mode",
    label:    "Execution Mode Allowed",
    passed,
    required: true,
    message:  passed
      ? `Execution mode "${mode}" is permitted.`
      : `Execution mode "${mode}" is not recognised — update to manual_publish or guarded_publish.`,
  };
}

function guardrailTargetMapped(
  hasCampaign: boolean,
  hasAdSet:    boolean,
): PublishGuardrailResult {
  const passed = hasCampaign && hasAdSet;
  return {
    key:      "target_entities_mapped",
    label:    "Target Entities Mapped",
    passed,
    required: true,
    message:  passed
      ? "Target campaign and ad set are both mapped."
      : !hasCampaign && !hasAdSet
        ? "Neither a target campaign nor ad set is mapped — cannot proceed."
        : !hasCampaign
          ? "Target campaign not mapped."
          : "Target ad set not mapped.",
  };
}

function guardrailNoActivePublishFailure(
  status: PublishPrepItem["status"],
): PublishGuardrailResult {
  const passed = status !== "publish_failed";
  return {
    key:      "no_active_publish_failure",
    label:    "No Active Publish Failure",
    passed,
    required: false,   // warning — not blocking, but surfaced
    message:  passed
      ? "No previous publish failure on record."
      : "A previous publish attempt failed — investigate the error before retrying.",
  };
}

function guardrailNotAlreadyPublished(
  status: PublishPrepItem["status"],
): PublishGuardrailResult {
  const passed = status !== "published";
  return {
    key:      "not_already_published",
    label:    "Not Already Published",
    passed,
    required: true,
    message:  passed
      ? "This item has not been published yet."
      : "This item has already been published — no further launch action is permitted.",
  };
}

function guardrailClientAccountPresent(
  clientAccountId: string,
): PublishGuardrailResult {
  const passed = !!clientAccountId;
  return {
    key:      "client_account_present",
    label:    "Client Account Identified",
    passed,
    required: true,
    message:  passed
      ? `Client account ID present: ${clientAccountId}.`
      : "No client account ID — cannot safely proceed without a client context.",
  };
}

// ---------------------------------------------------------------------------
// Public API: evaluatePublishGuardrails
// ---------------------------------------------------------------------------

export function evaluatePublishGuardrails(
  item:       Pick<PublishPrepItem, "status" | "executionMode" | "approvedForLaunch" | "clientAccountId" | "targetMapping">,
  validation: PublishValidationResult | null,
): PublishGuardrailResult[] {
  return [
    guardrailHumanApprovalRequired(item.approvedForLaunch),
    guardrailValidationMustPass(validation),
    guardrailAllowedExecutionMode(item.executionMode),
    guardrailTargetMapped(
      !!(item.targetMapping.targetCampaignId || item.targetMapping.targetCampaignExternalId),
      !!(item.targetMapping.targetAdSetId    || item.targetMapping.targetAdSetExternalId),
    ),
    guardrailNoActivePublishFailure(item.status),
    guardrailNotAlreadyPublished(item.status),
    guardrailClientAccountPresent(item.clientAccountId),
  ];
}

// ---------------------------------------------------------------------------
// Public API: canProceedToLaunch
// All required guardrails must pass for a launch action to fire.
// ---------------------------------------------------------------------------

export function canProceedToLaunch(guardrails: PublishGuardrailResult[]): boolean {
  return guardrails.filter((g) => g.required).every((g) => g.passed);
}

// ---------------------------------------------------------------------------
// Public API: deriveStatusFromResults
// Computes the correct PublishPrepStatus given current validation + guardrail state.
// ---------------------------------------------------------------------------

export function deriveStatusFromResults(
  currentStatus:    PublishPrepItem["status"],
  validation:       PublishValidationResult | null,
  guardrails:       PublishGuardrailResult[],
  approvedForLaunch: boolean,
): PublishPrepItem["status"] {
  // Terminal states are preserved
  if (currentStatus === "published" || currentStatus === "publish_failed") return currentStatus;

  if (!validation) return "draft";

  if (!validation.passed) return "blocked";

  const allRequiredGuardrailsPass = guardrails
    .filter((g) => g.required && g.key !== "human_approval_required")
    .every((g) => g.passed);

  if (!allRequiredGuardrailsPass) return "blocked";

  if (!approvedForLaunch) return "ready_for_approval";

  // Approved — check if ready to publish
  const launchReady = canProceedToLaunch(guardrails);
  if (launchReady) return "ready_to_publish";

  return "approved_for_launch";
}
