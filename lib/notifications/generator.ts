// lib/notifications/generator.ts
// Loads system state and returns structured notification content.
// No email sending happens here — this is pure data assembly.
//
// Data sources:
//   AlertEvent table          — open alerts (below-goal, stale-sync, above-goal, etc.)
//   BudgetPacingSnapshot      — over/under pacing this month
//   ProposedAutomationAction  — set_goals actions → missing goals
//
// Attribution window: 7 days (handled by the reconciliation engine upstream).

import { prisma }                       from "../db";
import { loadAlerts }                   from "../alerts/persist";
import { buildAllClientsPacingSummaries } from "../budgetPacing/service";
import type { AlertEventRow }           from "../alerts/types";
import type { NotificationPreferenceRow, DigestContent, DigestSectionItem } from "./types";

// ── Build digest content ──────────────────────────────────────────────────────

export async function buildDigestContent(
  workspaceId: string | null
): Promise<DigestContent> {
  const [openAlerts, pacingSummaries, missingGoalActions] = await Promise.all([
    loadAlerts(workspaceId, { status: ["open"], limit: 200 }),
    buildAllClientsPacingSummaries(workspaceId),
    prisma.proposedAutomationAction.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        actionType: "set_goals",
        status:     "proposed",
      },
      select: { entityName: true, clientName: true },
      take: 10,
    }),
  ]);

  // Campaigns below goal
  const campaignsBelowGoal: DigestSectionItem[] = openAlerts
    .filter((a) => a.alertType === "campaign_below_goal")
    .slice(0, 5)
    .map((a) => ({
      label:  a.entityName,
      detail: a.summary,
      client: a.clientName,
    }));

  // Pacing issues
  const pacingIssues: DigestSectionItem[] = pacingSummaries
    .filter(
      (s) =>
        s.clientSnapshot.pacingStatus === "over_pacing" ||
        s.clientSnapshot.pacingStatus === "under_pacing"
    )
    .slice(0, 5)
    .map((s) => ({
      label:  s.clientName,
      detail: `${s.clientSnapshot.pacingPercent.toFixed(0)}% paced — ${
        s.clientSnapshot.pacingStatus === "over_pacing" ? "over-pacing" : "under-pacing"
      }`,
      client: s.clientName,
    }));

  // Stale syncs
  const staleSyncs: DigestSectionItem[] = openAlerts
    .filter((a) => a.alertType === "stale_sync")
    .slice(0, 5)
    .map((a) => ({
      label:  a.clientName,
      detail: a.summary,
      client: a.clientName,
    }));

  // Top opportunities (campaigns above goal)
  const topOpportunities: DigestSectionItem[] = openAlerts
    .filter((a) => a.alertType === "campaign_above_goal")
    .slice(0, 5)
    .map((a) => ({
      label:  a.entityName,
      detail: a.summary,
      client: a.clientName,
    }));

  // Missing goals
  const missingGoals: DigestSectionItem[] = missingGoalActions.slice(0, 5).map((a) => ({
    label:  a.entityName,
    detail: "No ROAS or CPA goal configured",
    client: a.clientName,
  }));

  const hasContent =
    campaignsBelowGoal.length > 0 ||
    pacingIssues.length > 0 ||
    staleSyncs.length > 0 ||
    topOpportunities.length > 0 ||
    missingGoals.length > 0;

  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    campaignsBelowGoal,
    pacingIssues,
    staleSyncs,
    topOpportunities,
    missingGoals,
    hasContent,
  };
}

// ── Load pending immediate alerts for a user ──────────────────────────────────

/**
 * Returns open alerts that should trigger an immediate notification for this user,
 * filtered by their preferences and excluding already-sent dedup keys.
 */
export async function loadPendingImmediateAlerts(
  userId:      string,
  workspaceId: string | null,
  prefs:       NotificationPreferenceRow
): Promise<AlertEventRow[]> {
  if (!prefs.emailEnabled || !prefs.immediateAlerts) return [];

  // Load all open alerts
  const allOpen = await loadAlerts(workspaceId, {
    status:  ["open"],
    limit:   50,
    orderBy: "lastDetectedAt",
  });

  // Filter to severity the user wants
  const filtered = allOpen.filter((a) => {
    if (a.severity === "high" && prefs.alertHighPriority) return true;
    if (a.alertType === "stale_sync" && prefs.alertSyncFailure) return true;
    if (a.alertType === "campaign_below_goal" && prefs.alertBelowGoal) return true;
    // Pacing alerts come from automation, not alert events — skip here
    return false;
  });

  if (filtered.length === 0) return [];

  // Build dedup keys and check which have already been sent
  const dedupKeys = filtered.map((a) => `immediate_alert:${userId}:${a.id}`);
  const alreadySent = await prisma.notificationLog.findMany({
    where: {
      deduplicationKey: { in: dedupKeys },
      status:           { in: ["sent", "pending"] },
    },
    select: { deduplicationKey: true },
  });
  const sentKeys = new Set(alreadySent.map((l) => l.deduplicationKey));

  return filtered.filter(
    (a) => !sentKeys.has(`immediate_alert:${userId}:${a.id}`)
  );
}
