// lib/publishPrep/validator.ts
// Validation checks for creative drafts entering the publish preparation pipeline.
// All functions are pure — same input always produces same output.
//
// Validation gates what enters the pipeline. Guardrails gate what can launch.
// A draft can be blocked at validation; a valid draft can still be blocked at guardrails.

import type {
  PublishValidationResult,
  PublishValidationCheck,
  PublishPrepError,
  PublishTargetMapping,
}                              from "../../types/publishPrep";
import type {
  CreativeDraftVariant,
  CreativeBrief,
}                              from "../../types/creativeBrief";

// Policy-sensitive patterns — mirror scorer for consistency
const POLICY_RISK_PHRASES: RegExp[] = [
  /\bguaranteed?\b/i,
  /\b100%\s*(free|safe|effective|guaranteed)\b/i,
  /\bcure[sd]?\b/i,
  /\beliminate\s+debt\b/i,
  /\bget\s+rich\b/i,
  /\blose\s+\d+\s+(pounds?|lbs?)\b/i,
];

// Supported draft types for publish prep
const SUPPORTED_DRAFT_TYPES: CreativeBrief["draftType"][] = [
  "copy_variation",
  "headline_variation",
  "angle_variation",
  "image_brief",
  "full_refresh_brief",
];

// ---------------------------------------------------------------------------
// Individual check functions — each returns a PublishValidationCheck
// ---------------------------------------------------------------------------

function checkRequiredFields(variant: CreativeDraftVariant): PublishValidationCheck {
  const key = "required_fields";
  const label = "Required creative fields present";

  if (variant.variantType === "copy") {
    const missing: string[] = [];
    if (!variant.hook?.trim())          missing.push("hook");
    if (!variant.body?.trim())          missing.push("body");
    if (!variant.callToAction?.trim())  missing.push("CTA");
    if (missing.length === 0) {
      return { key, label, passed: true, message: "All required copy fields present (hook, body, CTA)." };
    }
    return { key, label, passed: false, message: `Missing required fields: ${missing.join(", ")}.` };
  }

  // Image brief
  const missing: string[] = [];
  if (!variant.conceptSummary?.trim()) missing.push("concept summary");
  if (!variant.visualChanges?.trim())  missing.push("visual changes");
  if (!variant.goal?.trim())           missing.push("goal");
  if (missing.length === 0) {
    return { key, label, passed: true, message: "All required image brief fields present." };
  }
  return { key, label, passed: false, message: `Missing required fields: ${missing.join(", ")}.` };
}

function checkSupportedDraftType(brief: CreativeBrief): PublishValidationCheck {
  const key   = "supported_draft_type";
  const label = "Supported draft type";
  const supported = SUPPORTED_DRAFT_TYPES.includes(brief.draftType);
  return {
    key,
    label,
    passed:  supported,
    message: supported
      ? `Draft type "${brief.draftType}" is supported for publish preparation.`
      : `Draft type "${brief.draftType}" is not yet supported in the publish prep workflow.`,
  };
}

function checkApprovedReviewState(variant: CreativeDraftVariant): PublishValidationCheck {
  const key   = "approved_review_state";
  const label = "Variant review approved";
  const passed = variant.reviewDecision === "approve";
  return {
    key,
    label,
    passed,
    message: passed
      ? "Variant has been approved by a reviewer."
      : `Variant review state is "${variant.reviewDecision ?? "pending"}" — must be approved before publish prep.`,
  };
}

function checkNoPolicyFlags(variant: CreativeDraftVariant): PublishValidationCheck {
  const key   = "no_policy_flags";
  const label = "No high-risk policy patterns";
  const text  = [
    variant.hook ?? "",
    variant.body ?? "",
    variant.callToAction ?? "",
    variant.conceptSummary ?? "",
  ].join(" ");

  const hits = POLICY_RISK_PHRASES.filter((re) => re.test(text));
  if (hits.length === 0) {
    return { key, label, passed: true, message: "No high-risk policy patterns detected in creative content." };
  }
  return {
    key,
    label,
    passed:  false,
    message: `${hits.length} policy-sensitive pattern${hits.length > 1 ? "s" : ""} detected — review required before launch.`,
  };
}

function checkTargetCampaignPresent(mapping: PublishTargetMapping): PublishValidationCheck {
  const key   = "target_campaign_present";
  const label = "Target campaign mapped";
  const hasMapping = !!(mapping.targetCampaignId || mapping.targetCampaignExternalId);
  return {
    key,
    label,
    passed:  hasMapping,
    message: hasMapping
      ? `Target campaign: ${mapping.targetCampaignName ?? mapping.targetCampaignExternalId ?? "mapped"}.`
      : "No target campaign selected — choose a campaign before proceeding to approval.",
  };
}

function checkTargetAdSetPresent(mapping: PublishTargetMapping): PublishValidationCheck {
  const key   = "target_ad_set_present";
  const label = "Target ad set mapped";
  const hasMapping = !!(mapping.targetAdSetId || mapping.targetAdSetExternalId);
  return {
    key,
    label,
    passed:  hasMapping,
    message: hasMapping
      ? `Target ad set: ${mapping.targetAdSetName ?? mapping.targetAdSetExternalId ?? "mapped"}.`
      : "No target ad set selected — choose an ad set for delivery targeting.",
  };
}

function checkDestinationUrl(mapping: PublishTargetMapping): PublishValidationCheck {
  const key   = "destination_url";
  const label = "Destination URL present";
  if (!mapping.destinationUrl) {
    // Warning only — not all ad types require an explicit URL
    return { key, label, passed: true, message: "No destination URL set — acceptable for awareness formats, but required for conversion ads." };
  }
  const looksValid = /^https?:\/\//.test(mapping.destinationUrl.trim());
  return {
    key,
    label,
    passed:  looksValid,
    message: looksValid
      ? `Destination URL set: ${mapping.destinationUrl}.`
      : "Destination URL does not appear to be a valid https:// URL — verify before launch.",
  };
}

// ---------------------------------------------------------------------------
// Public API: validateCreativeDraftForPublish
// Runs all validation checks and aggregates results.
// ---------------------------------------------------------------------------

export function validateCreativeDraftForPublish(
  variant: CreativeDraftVariant,
  brief:   CreativeBrief,
  mapping: PublishTargetMapping,
): PublishValidationResult {
  const checks: PublishValidationCheck[] = [
    checkRequiredFields(variant),
    checkSupportedDraftType(brief),
    checkApprovedReviewState(variant),
    checkNoPolicyFlags(variant),
    checkTargetCampaignPresent(mapping),
    checkTargetAdSetPresent(mapping),
    checkDestinationUrl(mapping),
  ];

  const blockers: PublishPrepError[] = checks
    .filter((c) => !c.passed && c.key !== "destination_url")
    .map((c) => ({
      code:     c.key,
      message:  c.message,
      severity: "blocking" as const,
    }));

  const warnings: PublishPrepError[] = checks
    .filter((c) => !c.passed && c.key === "destination_url")
    .map((c) => ({
      code:     c.key,
      message:  c.message,
      severity: "warning" as const,
    }));

  return {
    passed:   blockers.length === 0,
    checks,
    blockers,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Public API: validateTargetMapping
// Standalone check — used when mapping is updated without re-running full validation.
// ---------------------------------------------------------------------------

export function validateTargetMapping(mapping: PublishTargetMapping): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!mapping.targetCampaignId && !mapping.targetCampaignExternalId) {
    issues.push("Target campaign not selected.");
  }
  if (!mapping.targetAdSetId && !mapping.targetAdSetExternalId) {
    issues.push("Target ad set not selected.");
  }
  if (mapping.destinationUrl && !/^https?:\/\//.test(mapping.destinationUrl.trim())) {
    issues.push("Destination URL format appears invalid.");
  }
  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Public API: summarizePublishBlockers
// Returns human-readable blocker strings for display.
// ---------------------------------------------------------------------------

export function summarizePublishBlockers(
  validation: PublishValidationResult | null,
  guardrails: { passed: boolean; required: boolean; label: string; message: string }[],
): string[] {
  const out: string[] = [];
  if (validation) {
    for (const b of validation.blockers) out.push(b.message);
  }
  for (const g of guardrails) {
    if (!g.passed && g.required) out.push(`Guardrail: ${g.message}`);
  }
  return out;
}
