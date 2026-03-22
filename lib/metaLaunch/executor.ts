// lib/metaLaunch/executor.ts
// Meta launch orchestrator — the central pipeline from approved asset to Meta entity.
//
// Architecture:
//   1. Load PublishPrepRecord (validates approval state)
//   2. Check for duplicate launches
//   3. Resolve Meta credentials (access token + ad account)
//   4. Evaluate policy gate (governance stops + safety policies)
//   5. Create MetaLaunchRecord (status: launching)
//   6. Call attemptMetaLaunch() [existing execution bridge]
//   7. Update MetaLaunchRecord with result
//   8. Optionally wire to ExperimentRecord
//
// Reuses:
//   - lib/publishExecution/metaLaunch.ts for actual Meta API calls
//   - lib/publishPrep/guardrails.ts for publish-prep guardrail checks
//   - GovernanceStop + ActionSafetyPolicy models via policyGate.ts

import { prisma } from "../db";
import { attemptMetaLaunch } from "../publishExecution/metaLaunch";
import { loadPublishPrepItemById } from "../publishPrep/db";
import { canProceedToLaunch, evaluatePublishGuardrails } from "../publishPrep/guardrails";
import { resolveMetaCredentials } from "./credentialResolver";
import { evaluatePolicyGate } from "./policyGate";
import {
  createLaunchRecord,
  updateLaunchStatus,
  hasActiveLaunchForPrepItem,
  loadLaunchRecordById,
} from "./db";
import type {
  MetaLaunchRequest,
  MetaLaunchResult,
  MetaLaunchTarget,
} from "./types";
import type { PublishPayload } from "../../types/publishPrep";

// ---------------------------------------------------------------------------
// executeMetaLaunch — main entry point
// ---------------------------------------------------------------------------

export async function executeMetaLaunch(
  request: MetaLaunchRequest,
): Promise<MetaLaunchResult> {
  const { prepItemId, clientAccountId, executionMode, variantRole } = request;

  // 1. Load and validate the PublishPrepRecord
  const prepItem = await loadPublishPrepItemById(prepItemId);
  if (!prepItem) {
    return errorResult("PREP_NOT_FOUND", `Publish prep item ${prepItemId} not found.`);
  }

  if (!prepItem.approvedForLaunch) {
    return errorResult("NOT_APPROVED", "Publish prep item has not been approved for launch.");
  }

  if (prepItem.status === "published") {
    return errorResult("ALREADY_PUBLISHED", "This prep item has already been published.");
  }

  if (!prepItem.payloadPreview) {
    return errorResult("NO_PAYLOAD", "Prep item has no payload preview. Re-save target mapping.");
  }

  // 2. Check for duplicate launches
  const duplicate = await hasActiveLaunchForPrepItem(prepItemId);
  if (duplicate) {
    return errorResult("DUPLICATE_LAUNCH", "An active launch already exists for this prep item.");
  }

  // 3. Re-evaluate publish-prep guardrails
  const guardrails = evaluatePublishGuardrails(
    {
      status: prepItem.status,
      executionMode: prepItem.executionMode,
      approvedForLaunch: prepItem.approvedForLaunch,
      clientAccountId: prepItem.clientAccountId,
      targetMapping: prepItem.targetMapping,
    },
    prepItem.validation,
  );

  if (!canProceedToLaunch(guardrails)) {
    const blockers = guardrails.filter((g) => g.required && !g.passed).map((g) => g.message);
    return errorResult("GUARDRAIL_BLOCK", `Launch blocked by guardrails: ${blockers.join("; ")}`);
  }

  // 4. Resolve Meta credentials
  const credentials = await resolveMetaCredentials(clientAccountId);
  if ("error" in credentials) {
    return errorResult(credentials.code, credentials.error);
  }

  // 5. Evaluate policy gate
  const target: MetaLaunchTarget = {
    targetCampaignExternalId: prepItem.targetMapping.targetCampaignExternalId,
    targetCampaignName:       prepItem.targetMapping.targetCampaignName,
    targetAdSetExternalId:    prepItem.targetMapping.targetAdSetExternalId,
    targetAdSetName:          prepItem.targetMapping.targetAdSetName,
    externalAdAccountId:      credentials.externalAdAccountId,
  };

  const policyResult = await evaluatePolicyGate({
    clientAccountId,
    workspaceId:              request.workspaceId,
    targetCampaignExternalId: target.targetCampaignExternalId,
    externalAdAccountId:      credentials.externalAdAccountId,
  });

  if (!policyResult.allowed) {
    // Create a blocked launch record for visibility
    const blockedRecord = await createLaunchRecord({
      clientAccountId,
      workspaceId:              request.workspaceId,
      prepItemId,
      briefId:                  request.briefId,
      variantId:                request.variantId,
      experimentId:             request.experimentId,
      launchPlanId:             request.launchPlanId,
      variantRole,
      status:                   "blocked",
      executionMode,
      targetCampaignExternalId: target.targetCampaignExternalId,
      targetCampaignName:       target.targetCampaignName,
      targetAdSetExternalId:    target.targetAdSetExternalId,
      targetAdSetName:          target.targetAdSetName,
      externalAdAccountId:      credentials.externalAdAccountId,
      policyCheckJson:          JSON.stringify(policyResult),
      guardrailJson:            JSON.stringify(guardrails),
    });

    return {
      success:        false,
      launchRecordId: blockedRecord.id,
      status:         "blocked",
      message:        `Launch blocked by policy: ${policyResult.blockers.join("; ")}`,
      errorCode:      "POLICY_BLOCKED",
      errorDetail:    policyResult.blockers.join("; "),
    };
  }

  // 6. Create launch record (status: launching)
  const launchRecord = await createLaunchRecord({
    clientAccountId,
    workspaceId:              request.workspaceId,
    prepItemId,
    briefId:                  request.briefId,
    variantId:                request.variantId,
    experimentId:             request.experimentId,
    launchPlanId:             request.launchPlanId,
    variantRole,
    status:                   "launching",
    executionMode,
    targetCampaignExternalId: target.targetCampaignExternalId,
    targetCampaignName:       target.targetCampaignName,
    targetAdSetExternalId:    target.targetAdSetExternalId,
    targetAdSetName:          target.targetAdSetName,
    externalAdAccountId:      credentials.externalAdAccountId,
    policyCheckJson:          JSON.stringify(policyResult),
    guardrailJson:            JSON.stringify(guardrails),
  });

  // 7. Build PublishPayload and call the execution bridge
  const publishPayload: PublishPayload = {
    prepItemId:      prepItem.id,
    clientAccountId: prepItem.clientAccountId,
    executionMode:   executionMode as "manual_publish" | "guarded_publish",
    payloadPreview:  prepItem.payloadPreview,
    validation:      prepItem.validation!,
    guardrails,
    isLaunchReady:   true,
    assembledAt:     new Date().toISOString(),
  };

  const launchResult = await attemptMetaLaunch({
    payload:     publishPayload,
    accessToken: executionMode === "guarded_publish" ? credentials.accessToken : undefined,
    adAccountId: executionMode === "guarded_publish" ? credentials.externalAdAccountId : undefined,
  });

  // 8. Update launch record with result
  if (launchResult.success) {
    await updateLaunchStatus(launchRecord.id, "launched", {
      metaCreativeId: launchResult.metaCreativeId ?? null,
      metaAdId:       launchResult.metaAdId ?? null,
      launchMessage:  launchResult.message,
      launchedAt:     new Date(),
    });

    // Store payload for audit
    await prisma.metaLaunchRecord.update({
      where: { id: launchRecord.id },
      data: { payloadJson: JSON.stringify(launchResult.payloadSubmitted) },
    });

    // 9. Auto-wire to ExperimentRecord if control info provided
    let experimentId = request.experimentId ?? null;
    if (!experimentId && request.controlAdExternalId && variantRole === "challenger") {
      experimentId = await autoCreateExperiment({
        clientAccountId,
        launchRecordId:            launchRecord.id,
        controlAdExternalId:       request.controlAdExternalId,
        controlAdSetExternalId:    request.controlAdSetExternalId ?? null,
        controlCampaignExternalId: request.controlCampaignExternalId ?? null,
        controlCreativeId:         request.controlCreativeId ?? null,
        controlLabel:              request.controlLabel ?? "Control",
        challengerAdExternalId:    launchResult.metaAdId ?? null,
        challengerAdSetExternalId: target.targetAdSetExternalId,
        challengerCampaignExternalId: target.targetCampaignExternalId,
        challengerLabel:           prepItem.variantTitle,
        prepItemId,
        externalAdAccountId:       credentials.externalAdAccountId,
      });

      if (experimentId) {
        await updateLaunchStatus(launchRecord.id, "launched", { experimentId });
      }
    }

    return {
      success:        true,
      launchRecordId: launchRecord.id,
      status:         "launched",
      message:        launchResult.message,
      metaCreativeId: launchResult.metaCreativeId,
      metaAdId:       launchResult.metaAdId,
      experimentId,
    };
  } else {
    await updateLaunchStatus(launchRecord.id, "failed", {
      launchMessage: launchResult.message,
      errorCode:     launchResult.errorCode,
      errorDetail:   launchResult.errorDetail,
    });

    return {
      success:        false,
      launchRecordId: launchRecord.id,
      status:         "failed",
      message:        launchResult.message,
      errorCode:      launchResult.errorCode,
      errorDetail:    launchResult.errorDetail,
    };
  }
}

// ---------------------------------------------------------------------------
// retryMetaLaunch — retry a failed launch
// ---------------------------------------------------------------------------

export async function retryMetaLaunch(
  launchRecordId: string,
): Promise<MetaLaunchResult> {
  const record = await loadLaunchRecordById(launchRecordId);
  if (!record) {
    return errorResult("LAUNCH_NOT_FOUND", `Launch record ${launchRecordId} not found.`);
  }

  if (record.status !== "failed" && record.status !== "blocked") {
    return errorResult("INVALID_STATUS", `Cannot retry launch in status "${record.status}". Only failed or blocked launches can be retried.`);
  }

  if (!record.prepItemId) {
    return errorResult("NO_PREP_ITEM", "Launch record has no linked prep item. Cannot retry.");
  }

  // Update retry count
  await updateLaunchStatus(launchRecordId, record.status as "failed" | "blocked", {
    retryCount:  record.retryCount + 1,
    lastRetryAt: new Date(),
  });

  // Re-execute through the full pipeline
  return executeMetaLaunch({
    prepItemId:      record.prepItemId,
    clientAccountId: record.clientAccountId,
    workspaceId:     record.workspaceId,
    variantRole:     record.variantRole as "control" | "challenger" | "backup_candidate",
    executionMode:   record.executionMode as "manual_publish" | "guarded_publish",
    experimentId:    record.experimentId,
    launchPlanId:    record.launchPlanId,
    briefId:         record.briefId,
    variantId:       record.variantId,
  });
}

// ---------------------------------------------------------------------------
// Auto-create ExperimentRecord for control vs challenger test
// ---------------------------------------------------------------------------

async function autoCreateExperiment(opts: {
  clientAccountId:              string;
  launchRecordId:               string;
  controlAdExternalId:          string;
  controlAdSetExternalId:       string | null;
  controlCampaignExternalId:    string | null;
  controlCreativeId:            string | null;
  controlLabel:                 string;
  challengerAdExternalId:       string | null;
  challengerAdSetExternalId:    string | null;
  challengerCampaignExternalId: string | null;
  challengerLabel:              string;
  prepItemId:                   string;
  externalAdAccountId:          string;
}): Promise<string | null> {
  try {
    const experiment = await prisma.experimentRecord.create({
      data: {
        clientAccountId:           opts.clientAccountId,
        name:                      `Test: ${opts.challengerLabel} vs ${opts.controlLabel}`,
        status:                    "active",
        comparisonMode:            "simultaneous",
        controlCreativeId:         opts.controlCreativeId,
        controlAdExternalId:       opts.controlAdExternalId,
        controlAdSetExternalId:    opts.controlAdSetExternalId,
        controlCampaignExternalId: opts.controlCampaignExternalId,
        controlLabel:              opts.controlLabel,
        challengerPrepItemId:      opts.prepItemId,
        challengerAdExternalId:    opts.challengerAdExternalId,
        challengerAdSetExternalId: opts.challengerAdSetExternalId,
        challengerCampaignExternalId: opts.challengerCampaignExternalId,
        challengerLabel:           opts.challengerLabel,
        externalAdAccountId:       opts.externalAdAccountId,
        primaryMetric:             "roas_7d",
        successThreshold:          0.10,
        minSpendPerVariant:        50.0,
        evaluationWindowDays:      7,
        startedAt:                 new Date(),
      },
    });
    console.log(`[MetaLaunch] Auto-created experiment ${experiment.id} for launch`);
    return experiment.id;
  } catch (err) {
    console.error("[MetaLaunch] Failed to auto-create experiment:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// summarizeMetaLaunchResult — human-readable summary
// ---------------------------------------------------------------------------

export function summarizeMetaLaunchResult(result: MetaLaunchResult): string {
  if (result.success) {
    const parts = [`Launch successful (${result.launchRecordId})`];
    if (result.metaCreativeId) parts.push(`Creative: ${result.metaCreativeId}`);
    if (result.metaAdId)       parts.push(`Ad: ${result.metaAdId}`);
    if (result.experimentId)   parts.push(`Experiment: ${result.experimentId}`);
    return parts.join(" | ");
  }
  return `Launch failed: ${result.message}${result.errorCode ? ` [${result.errorCode}]` : ""}`;
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function errorResult(code: string, message: string): MetaLaunchResult {
  return {
    success:        false,
    launchRecordId: "",
    status:         "failed",
    message,
    errorCode:      code,
    errorDetail:    message,
  };
}
