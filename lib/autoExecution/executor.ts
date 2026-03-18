// lib/autoExecution/executor.ts
// Core execution engine for guarded auto-execution.
//
// v1 scope:
//   run_sync      — triggers a Meta data sync for the client's mapped ad accounts.
//   pause_campaign — pauses a single Meta campaign via the Graph API.
//
// Execution flow:
//   1. Load all approved proposed actions for the workspace.
//   2. Load auto-execution settings for each client.
//   3. Evaluate guardrails for each action.
//   4. Execute eligible actions, logging every outcome.
//   5. Return a summary.

import { prisma }                            from "../db";
import { runMetaSyncForAccounts }            from "../meta/sync";
import { pauseMetaCampaign }                 from "../meta/write";
import { evaluateAutoExecutionEligibility }  from "./eligibility";
import {
  getOrCreateAutoExecutionSettings,
  logAutoExecutionRun,
  loadAutoExecutionHistory,
}                                            from "./persist";
import type {
  AutoExecutionRunSummary,
  AutoExecutionLogRow,
  AutoExecutionLogInput,
  AutoExecutionStatus,
}                                            from "./types";

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Loads all approved automation actions for the workspace, evaluates guardrails,
 * and executes eligible actions. Returns a full summary with per-action logs.
 */
export async function runEligibleAutoExecutions(
  workspaceId: string | null
): Promise<AutoExecutionRunSummary> {
  type ActionRow = {
    id:              string;
    workspaceId:     string | null;
    clientAccountId: string;
    actionType:      string;
    status:          string;
    entityType:      string;
    entityId:        string;
    entityName:      string;
  };

  // 1. Load all approved proposed actions
  const approvedActions = await prisma.proposedAutomationAction.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status:     "approved",
      actionType: { in: ["run_sync", "pause_campaign"] },
    },
    orderBy: [{ priority: "desc" }, { proposedAt: "asc" }],
    select: {
      id:              true,
      workspaceId:     true,
      clientAccountId: true,
      actionType:      true,
      status:          true,
      entityType:      true,
      entityId:        true,
      entityName:      true,
    },
  }) as ActionRow[];

  const summary: AutoExecutionRunSummary = {
    candidatesEvaluated: approvedActions.length,
    guardrailsBlocked:   0,
    skipped:             0,
    executed:            0,
    failed:              0,
    logs:                [],
  };

  for (const action of approvedActions) {
    // 2. Load settings for this client (creates defaults if missing)
    const settings = await getOrCreateAutoExecutionSettings(
      action.clientAccountId,
      workspaceId
    );

    // 3. Evaluate guardrails
    const eligibility = await evaluateAutoExecutionEligibility(action, settings);

    if (!eligibility.eligible) {
      const status: AutoExecutionStatus =
        eligibility.decision === "block" ? "guardrail_blocked" : "skipped";

      const log = await logAutoExecutionRun({
        workspaceId,
        clientAccountId: action.clientAccountId,
        actionType:      action.actionType,
        entityType:      action.entityType,
        entityId:        action.entityId,
        entityName:      action.entityName,
        status,
        guardrailResults: eligibility.guardrails,
        decision:        eligibility.decision,
        decisionReason:  eligibility.decisionReason,
        durationMs:      null,
        errorMessage:    null,
      });

      summary.logs.push(log);
      if (status === "guardrail_blocked") summary.guardrailsBlocked++;
      else summary.skipped++;
      continue;
    }

    // 4. Execute
    const logInput: AutoExecutionLogInput = {
      workspaceId,
      clientAccountId: action.clientAccountId,
      actionType:      action.actionType,
      entityType:      action.entityType,
      entityId:        action.entityId,
      entityName:      action.entityName,
      status:          "pending",
      guardrailResults: eligibility.guardrails,
      decision:        "execute",
      decisionReason:  eligibility.decisionReason,
      durationMs:      null,
      errorMessage:    null,
    };

    const startMs = Date.now();

    if (action.actionType === "run_sync") {
      const result = await executeRunSync(action, workspaceId);
      logInput.status    = result.status;
      logInput.errorMessage = result.errorMessage ?? null;
    } else if (action.actionType === "pause_campaign") {
      const result = await executePauseCampaign(action);
      logInput.status    = result.status;
      logInput.errorMessage = result.errorMessage ?? null;
    }

    logInput.durationMs = Date.now() - startMs;

    // Mark the proposed action as executed if successful
    if (logInput.status === "success") {
      await prisma.proposedAutomationAction.update({
        where: { id: action.id },
        data:  { status: "executed" },
      });
    }

    const log = await logAutoExecutionRun(logInput);
    summary.logs.push(log);

    if (logInput.status === "success") summary.executed++;
    else summary.failed++;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

async function executeRunSync(
  action:      ActionRow,
  workspaceId: string | null
): Promise<{ status: AutoExecutionStatus; errorMessage?: string }> {
  // Find the client's mapped Meta ad accounts
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: action.clientAccountId },
    include: {
      accessibleAdAccount: true,
      connection:          true,
    },
  });

  if (selectedAccounts.length === 0) {
    return {
      status:       "failed",
      errorMessage: "No Meta ad accounts mapped to this client.",
    };
  }

  const firstConnection = selectedAccounts[0].connection;

  const adAccounts = selectedAccounts.map((s) => ({
    externalAdAccountId: s.accessibleAdAccount.externalAdAccountId,
    accessToken:         firstConnection.accessToken,
  }));

  try {
    const syncResult = await runMetaSyncForAccounts(
      adAccounts,
      firstConnection.id,
      workspaceId
    );

    if (syncResult.status === "failed") {
      return {
        status:       "failed",
        errorMessage: syncResult.errors.join("; "),
      };
    }

    return { status: "success" };
  } catch (err) {
    return {
      status:       "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

async function executePauseCampaign(
  action: ActionRow
): Promise<{ status: AutoExecutionStatus; errorMessage?: string }> {
  // Look up the access token for this campaign's ad account
  const campaign = await prisma.metaSyncedCampaign.findUnique({
    where: { externalCampaignId: action.entityId },
  });

  if (!campaign) {
    return {
      status:       "failed",
      errorMessage: `No synced campaign found with externalCampaignId "${action.entityId}".`,
    };
  }

  // Find the connection that manages this ad account
  const selectedAccount = await prisma.metaSelectedAdAccount.findFirst({
    where: {
      accessibleAdAccount: {
        externalAdAccountId: campaign.externalAdAccountId,
      },
    },
    include: { connection: true },
  });

  if (!selectedAccount) {
    return {
      status:       "failed",
      errorMessage: `No Meta connection found for ad account "${campaign.externalAdAccountId}".`,
    };
  }

  const result = await pauseMetaCampaign(
    action.entityId,
    selectedAccount.connection.accessToken
  );

  if (!result.success) {
    return {
      status:       "failed",
      errorMessage: result.message,
    };
  }

  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------

export { loadAutoExecutionHistory };
