// lib/operations/aggregator.ts
// Builds an OperationsSnapshot from existing system state.
//
// Architecture:
//   Phase 1 (parallel): clients, meta accounts, shopify connections, sync
//                       runs, reconciled campaign performance
//   Phase 2 (sequential): campaigns + goals (requires adAccountIds from P1)
//   Phase 3 (in-memory): per-client state assessment + issue/opportunity/
//                        action generation
//
// No UI dependencies. All logic is deterministic — no AI, no ML.
// Designed to be called once per page load; the result is serialised as props.

import { prisma } from "../db";
import type {
  OperationsSnapshot,
  OperationsIssue,
  OperationsOpportunity,
  OperationsAction,
  ClientReadinessRow,
  ClientReadinessStatus,
  OperationsPriority,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALE_SYNC_HOURS    = 48;
const HIGH_STALE_HOURS    = 7 * 24;   // 7 days = high priority
const ABOVE_GOAL_FACTOR   = 1.2;      // ROAS must be >20% above goal to flag
const SCALE_SPEND_MAX     = 1000;     // max spend ($) to flag "ready to scale"
const STRONG_ROAS_FLOOR   = 3.0;      // floor ROAS to flag as strong performer

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(prefix: string, ...parts: string[]): string {
  return `${prefix}-${parts.join("-")}`;
}

function hoursAgo(d: Date): number {
  return (Date.now() - d.getTime()) / 1000 / 3600;
}

function fmtRoas(v: number | null): string {
  return v != null ? `${v.toFixed(2)}x` : "—";
}

function fmtDollar(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Per-client state type (intermediate, not exported)
// ---------------------------------------------------------------------------

type ClientState = {
  id:           string;
  name:         string;
  workspaceId:  string | null;
  hasMetaMapping:    boolean;
  hasShopify:        boolean;
  syncIsStale:       boolean;
  syncFailed:        boolean;
  staleSinceHours:   number;
  lastSyncAt:        string | null;
  hasGoals:          boolean;                // any campaign has a goal
  hasReconciliation: boolean;
  campaignsMissingGoals: { id: string; name: string }[];
  belowGoalCampaigns: {
    id:           string;
    name:         string;
    roas:         number | null;
    goalValue:    number;
    goalType:     string;
    spend:        number;
  }[];
  aboveGoalCampaigns: {
    id:           string;
    name:         string;
    roas:         number | null;
    goalValue:    number;
    spend:        number;
  }[];
  strongCampaigns: {
    id:     string;
    name:   string;
    roas:   number;
    spend:  number;
  }[];
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function buildOperationsSnapshot(
  workspaceId: string | null
): Promise<OperationsSnapshot> {
  const generatedAt = new Date().toISOString();

  // ── Phase 1: parallel queries ────────────────────────────────────────────

  const clientWhere = workspaceId
    ? { workspaceId }
    : {};

  const [
    clients,
    metaAccounts,
    shopifyConnections,
    syncRuns,
    reconciledRows,
  ] = await Promise.all([
    prisma.clientAccount.findMany({
      where:   clientWhere,
      select:  { id: true, name: true, workspaceId: true, status: true },
      orderBy: { name: "asc" },
    }),

    // MetaSelectedAdAccount linked to a client + their ad account external IDs
    prisma.metaSelectedAdAccount.findMany({
      where:  { clientAccountId: { not: null } },
      select: {
        clientAccountId: true,
        accessibleAdAccount: { select: { externalAdAccountId: true } },
      },
    }),

    // Active Shopify connections linked to a client
    prisma.shopifyConnection.findMany({
      where:  { clientAccountId: { not: null }, connectionStatus: "active" },
      select: { clientAccountId: true },
    }),

    // Most recent sync run per client (fetch last 2k, filter in memory)
    prisma.clientSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take:    2000,
      select:  {
        clientAccountId: true,
        status:          true,
        completedAt:     true,
        startedAt:       true,
      },
    }),

    // Latest reconciled campaign rows (all clients, recent)
    prisma.reconciledCampaignPerformance.findMany({
      orderBy: { dateTo: "desc" },
      take:    1000,
      select:  {
        clientAccountId:    true,
        externalCampaignId: true,
        campaignName:       true,
        metaSpend:          true,
        attributedRevenue:  true,
        attributedOrders:   true,
        calculatedRoas:     true,
        calculatedCpa:      true,
        dateTo:             true,
      },
    }),
  ]);

  // ── Phase 2: campaigns + goals (needs adAccountIds from phase 1) ─────────

  const adAccountToClient = new Map<string, string>();
  for (const ma of metaAccounts) {
    if (ma.clientAccountId && ma.accessibleAdAccount?.externalAdAccountId) {
      adAccountToClient.set(
        ma.accessibleAdAccount.externalAdAccountId,
        ma.clientAccountId
      );
    }
  }

  const adAccountIds = Array.from(adAccountToClient.keys());

  const syncedCampaigns = adAccountIds.length > 0
    ? await prisma.metaSyncedCampaign.findMany({
        where:  { externalAdAccountId: { in: adAccountIds } },
        select: {
          externalCampaignId:  true,
          externalAdAccountId: true,
          name:                true,
          goal: {
            select: {
              roasGoalType:  true,
              roasGoalValue: true,
              cpaGoalType:   true,
              cpaGoalValue:  true,
            },
          },
        },
      })
    : [];

  // ── Phase 3: index raw data ───────────────────────────────────────────────

  // Which clients have a Meta mapping?
  const clientsWithMeta = new Set(
    metaAccounts
      .filter((ma) => ma.clientAccountId != null)
      .map((ma) => ma.clientAccountId as string)
  );

  // Which clients have an active Shopify?
  const clientsWithShopify = new Set(
    shopifyConnections
      .filter((c) => c.clientAccountId != null)
      .map((c) => c.clientAccountId as string)
  );

  // Latest sync run per client (first = most recent due to orderBy desc)
  const latestSyncByClient = new Map<string, typeof syncRuns[0]>();
  for (const run of syncRuns) {
    if (!latestSyncByClient.has(run.clientAccountId)) {
      latestSyncByClient.set(run.clientAccountId, run);
    }
  }

  // Campaigns per client (via adAccount map)
  const campaignsByClient = new Map<string, typeof syncedCampaigns>();
  for (const campaign of syncedCampaigns) {
    const clientId = adAccountToClient.get(campaign.externalAdAccountId);
    if (!clientId) continue;
    const existing = campaignsByClient.get(clientId) ?? [];
    existing.push(campaign);
    campaignsByClient.set(clientId, existing);
  }

  // Reconciled rows: keep only rows from the latest dateTo per client
  const latestDateToByClient = new Map<string, string>();
  for (const row of reconciledRows) {
    const cur = latestDateToByClient.get(row.clientAccountId);
    if (!cur || row.dateTo > cur) {
      latestDateToByClient.set(row.clientAccountId, row.dateTo);
    }
  }
  const latestReconciledByClient = new Map<string, typeof reconciledRows>();
  for (const row of reconciledRows) {
    const latestDate = latestDateToByClient.get(row.clientAccountId);
    if (row.dateTo !== latestDate) continue;
    const existing = latestReconciledByClient.get(row.clientAccountId) ?? [];
    existing.push(row);
    latestReconciledByClient.set(row.clientAccountId, existing);
  }

  // ── Phase 4: per-client state assessment ─────────────────────────────────

  const clientStates: ClientState[] = clients.map((client) => {
    // Sync freshness
    const lastRun       = latestSyncByClient.get(client.id);
    const syncFailed    = lastRun?.status === "failed";
    const lastSyncAt    = lastRun?.completedAt?.toISOString() ?? null;
    const staleSinceHours = lastRun?.completedAt
      ? hoursAgo(lastRun.completedAt)
      : Infinity;
    const syncIsStale = staleSinceHours > STALE_SYNC_HOURS;

    // Goals
    const clientCampaigns  = campaignsByClient.get(client.id) ?? [];
    const goalsSet         = clientCampaigns.filter((c) => c.goal != null);
    const campaignsMissingGoals = clientCampaigns
      .filter((c) => c.goal == null)
      .map((c) => ({ id: c.externalCampaignId, name: c.name }));
    const hasGoals = goalsSet.length > 0;

    // Reconciled performance vs goals
    const reconciledCampaigns = latestReconciledByClient.get(client.id) ?? [];
    const hasReconciliation   = reconciledCampaigns.length > 0;

    // Build a map: externalCampaignId → goal (from syncedCampaigns)
    const goalByCampaign = new Map(
      clientCampaigns
        .filter((c) => c.goal != null)
        .map((c) => [c.externalCampaignId, c.goal!])
    );

    const belowGoalCampaigns: ClientState["belowGoalCampaigns"] = [];
    const aboveGoalCampaigns: ClientState["aboveGoalCampaigns"] = [];
    const strongCampaigns:    ClientState["strongCampaigns"]    = [];

    for (const rc of reconciledCampaigns) {
      const goal = goalByCampaign.get(rc.externalCampaignId);
      const roas = rc.calculatedRoas;

      if (goal && roas != null) {
        if (goal.roasGoalType === "high" && roas < goal.roasGoalValue) {
          belowGoalCampaigns.push({
            id:        rc.externalCampaignId,
            name:      rc.campaignName,
            roas,
            goalValue: goal.roasGoalValue,
            goalType:  "roas_high",
            spend:     rc.metaSpend,
          });
        } else if (goal.roasGoalType === "high" && roas > goal.roasGoalValue * ABOVE_GOAL_FACTOR) {
          aboveGoalCampaigns.push({
            id:        rc.externalCampaignId,
            name:      rc.campaignName,
            roas,
            goalValue: goal.roasGoalValue,
            spend:     rc.metaSpend,
          });
        }
      }

      // Strong performer — flagged even without goals
      if (roas != null && roas >= STRONG_ROAS_FLOOR && rc.metaSpend > 0) {
        strongCampaigns.push({
          id:    rc.externalCampaignId,
          name:  rc.campaignName,
          roas,
          spend: rc.metaSpend,
        });
      }
    }

    return {
      id:                   client.id,
      name:                 client.name,
      workspaceId:          client.workspaceId,
      hasMetaMapping:       clientsWithMeta.has(client.id),
      hasShopify:           clientsWithShopify.has(client.id),
      syncIsStale,
      syncFailed,
      staleSinceHours,
      lastSyncAt,
      hasGoals,
      hasReconciliation,
      campaignsMissingGoals,
      belowGoalCampaigns,
      aboveGoalCampaigns,
      strongCampaigns,
    };
  });

  // ── Phase 5: generate issues, opportunities, actions ─────────────────────

  const issues:        OperationsIssue[]       = [];
  const opportunities: OperationsOpportunity[] = [];
  const actions:       OperationsAction[]      = [];

  for (const cs of clientStates) {
    // ---- Issues ----

    if (cs.syncFailed) {
      issues.push({
        id:              uid("issue", cs.id, "sync-failed"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "client",
        entityId:        cs.id,
        entityName:      cs.name,
        issueType:       "sync_failed",
        priority:        "high",
        summary:         `Last sync failed for ${cs.name}. Data may be stale.`,
        supportingMetrics: { lastSyncAt: cs.lastSyncAt ?? "never" },
      });
      actions.push({
        id:              uid("action", cs.id, "fix-sync"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "fix_sync",
        priority:        "high",
        title:           `Fix sync for ${cs.name}`,
        summary:         "The last sync attempt failed. Check the sync status and retry.",
        destinationUrl:  `/clients/${cs.id}`,
      });
    } else if (cs.syncIsStale && cs.hasMetaMapping) {
      const priority: OperationsPriority = cs.staleSinceHours > HIGH_STALE_HOURS ? "high" : "medium";
      const days = Math.round(cs.staleSinceHours / 24);
      issues.push({
        id:              uid("issue", cs.id, "stale-sync"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "client",
        entityId:        cs.id,
        entityName:      cs.name,
        issueType:       "stale_sync",
        priority,
        summary:         `${cs.name} data is ${days}d old. Sync required to keep metrics current.`,
        supportingMetrics: {
          lastSyncAt: cs.lastSyncAt ?? "never",
          staleDays:  days,
        },
      });
      actions.push({
        id:              uid("action", cs.id, "run-sync"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "run_sync",
        priority,
        title:           `Sync ${cs.name}`,
        summary:         `Last synced ${days}d ago. Run a fresh sync to update Meta campaign data.`,
        destinationUrl:  `/clients/${cs.id}`,
      });
    }

    if (!cs.hasMetaMapping) {
      issues.push({
        id:              uid("issue", cs.id, "no-meta"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "client",
        entityId:        cs.id,
        entityName:      cs.name,
        issueType:       "missing_meta_mapping",
        priority:        "high",
        summary:         `${cs.name} has no Meta ad account mapped. No campaign data will sync.`,
        supportingMetrics: {},
      });
      actions.push({
        id:              uid("action", cs.id, "connect-meta"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "connect_meta",
        priority:        "high",
        title:           `Map Meta account for ${cs.name}`,
        summary:         "Connect and map a Meta ad account to enable campaign data syncing.",
        destinationUrl:  `/clients/${cs.id}/setup`,
      });
    }

    if (!cs.hasShopify) {
      issues.push({
        id:              uid("issue", cs.id, "no-shopify"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "client",
        entityId:        cs.id,
        entityName:      cs.name,
        issueType:       "missing_shopify",
        priority:        "medium",
        summary:         `${cs.name} has no Shopify connected. CRM reconciliation is unavailable.`,
        supportingMetrics: {},
      });
      actions.push({
        id:              uid("action", cs.id, "connect-shopify"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "connect_shopify",
        priority:        "medium",
        title:           `Connect Shopify for ${cs.name}`,
        summary:         "Link a Shopify store to enable CRM-verified ROAS and CPA calculations.",
        destinationUrl:  `/clients/${cs.id}/integrations/shopify`,
      });
    }

    // No campaign goals — only flag if they have campaigns
    if (cs.hasMetaMapping && cs.campaignsMissingGoals.length > 0 && !cs.hasGoals) {
      issues.push({
        id:              uid("issue", cs.id, "no-goals"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "client",
        entityId:        cs.id,
        entityName:      cs.name,
        issueType:       "no_campaign_goals",
        priority:        "medium",
        summary:         `${cs.name} has ${cs.campaignsMissingGoals.length} campaign(s) with no ROAS or CPA goals set.`,
        supportingMetrics: { campaignCount: cs.campaignsMissingGoals.length },
      });
      actions.push({
        id:              uid("action", cs.id, "set-goals"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "set_campaign_goals",
        priority:        "medium",
        title:           `Set goals for ${cs.name}`,
        summary:         `${cs.campaignsMissingGoals.length} campaign(s) lack targets. Set ROAS/CPA goals to enable evaluation.`,
        destinationUrl:  `/clients/${cs.id}/campaigns`,
      });
    }

    // Has meta + shopify but no reconciliation yet
    if (cs.hasMetaMapping && cs.hasShopify && !cs.hasReconciliation) {
      issues.push({
        id:              uid("issue", cs.id, "no-reconciliation"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "client",
        entityId:        cs.id,
        entityName:      cs.name,
        issueType:       "no_reconciliation",
        priority:        "medium",
        summary:         `${cs.name} has Meta and Shopify connected but reconciliation has not been run.`,
        supportingMetrics: {},
      });
      actions.push({
        id:              uid("action", cs.id, "run-reconciliation"),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "run_reconciliation",
        priority:        "medium",
        title:           `Run reconciliation for ${cs.name}`,
        summary:         "Compute CRM-verified ROAS and CPA by matching Meta spend to Shopify orders.",
        destinationUrl:  `/reconciliation?clientId=${cs.id}`,
      });
    }

    // Campaigns below goal
    for (const c of cs.belowGoalCampaigns) {
      issues.push({
        id:              uid("issue", cs.id, "below-goal", c.id),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "campaign",
        entityId:        c.id,
        entityName:      c.name,
        issueType:       "campaigns_below_goal",
        priority:        "high",
        summary:         `${c.name} ROAS ${fmtRoas(c.roas)} is below goal of ${c.goalValue.toFixed(2)}x.`,
        supportingMetrics: {
          roas:      fmtRoas(c.roas),
          goalRoas:  `${c.goalValue.toFixed(2)}x`,
          spend:     fmtDollar(c.spend),
        },
      });
      actions.push({
        id:              uid("action", cs.id, "review-campaign", c.id),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "review_campaign",
        priority:        "high",
        title:           `Review ${c.name}`,
        summary:         `ROAS ${fmtRoas(c.roas)} — below ${c.goalValue.toFixed(2)}x goal. Review ad sets and creative.`,
        destinationUrl:  `/clients/${cs.id}/campaigns/${c.id}`,
      });
    }

    // ---- Opportunities ----

    for (const c of cs.aboveGoalCampaigns) {
      const isLowSpend = c.spend < SCALE_SPEND_MAX;
      opportunities.push({
        id:              uid("opp", cs.id, "above-goal", c.id),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "campaign",
        entityId:        c.id,
        entityName:      c.name,
        opportunityType: isLowSpend ? "ready_to_scale" : "above_roas_goal",
        priority:        isLowSpend ? "high" : "medium",
        summary:         isLowSpend
          ? `${c.name} ROAS ${fmtRoas(c.roas)} is ${((c.roas! / c.goalValue - 1) * 100).toFixed(0)}% above goal at low spend (${fmtDollar(c.spend)}). Ready to scale.`
          : `${c.name} ROAS ${fmtRoas(c.roas)} is ${((c.roas! / c.goalValue - 1) * 100).toFixed(0)}% above goal. Consider increasing budget.`,
        supportingMetrics: {
          roas:     fmtRoas(c.roas),
          goalRoas: `${c.goalValue.toFixed(2)}x`,
          spend:    fmtDollar(c.spend),
        },
      });
      actions.push({
        id:              uid("action", cs.id, "scale", c.id),
        clientAccountId: cs.id,
        clientName:      cs.name,
        actionType:      "scale_campaign",
        priority:        isLowSpend ? "high" : "medium",
        title:           `Scale ${c.name}`,
        summary:         `ROAS ${fmtRoas(c.roas)} — above goal. Review budget headroom and scale.`,
        destinationUrl:  `/clients/${cs.id}/campaigns/${c.id}`,
      });
    }

    // Strong performers without a goal
    for (const c of cs.strongCampaigns) {
      // Don't double-flag if already flagged as above-goal
      if (cs.aboveGoalCampaigns.find((a) => a.id === c.id)) continue;
      opportunities.push({
        id:              uid("opp", cs.id, "strong", c.id),
        clientAccountId: cs.id,
        clientName:      cs.name,
        entityType:      "campaign",
        entityId:        c.id,
        entityName:      c.name,
        opportunityType: "strong_performer",
        priority:        "medium",
        summary:         `${c.name} has ROAS ${fmtRoas(c.roas)} with no goal set. Set a goal to unlock evaluation.`,
        supportingMetrics: {
          roas:  fmtRoas(c.roas),
          spend: fmtDollar(c.spend),
        },
      });
    }
  }

  // ── Phase 6: client readiness classification ──────────────────────────────

  const issueCountByClient = new Map<string, number>();
  for (const issue of issues) {
    issueCountByClient.set(
      issue.clientAccountId,
      (issueCountByClient.get(issue.clientAccountId) ?? 0) + 1
    );
  }

  const clientReadiness: ClientReadinessRow[] = clientStates.map((cs) => {
    let status: ClientReadinessStatus;
    const has = cs.hasMetaMapping;
    const shop = cs.hasShopify;

    if (has && shop && !cs.syncIsStale && cs.hasGoals && cs.hasReconciliation) {
      status = "live";
    } else if (!has && !shop) {
      status = cs.lastSyncAt == null ? "needs_setup" : "missing_integrations";
    } else {
      status = "partially_configured";
    }

    return {
      clientAccountId:  cs.id,
      clientName:       cs.name,
      status,
      hasMetaMapping:   cs.hasMetaMapping,
      hasShopify:       cs.hasShopify,
      lastSyncAt:       cs.lastSyncAt,
      syncIsStale:      cs.syncIsStale,
      hasGoals:         cs.hasGoals,
      hasReconciliation: cs.hasReconciliation,
      issueCount:       issueCountByClient.get(cs.id) ?? 0,
    };
  });

  // ── Phase 7: assemble snapshot ────────────────────────────────────────────

  const liveCount        = clientReadiness.filter((r) => r.status === "live").length;
  const staleCount       = clientStates.filter((cs) => cs.syncIsStale).length;
  const needsAttention   = new Set(issues.map((i) => i.clientAccountId)).size;
  const needsSetupCount  = clientReadiness.filter((r) => r.status === "needs_setup").length;

  // Sort by priority (high → medium → low)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortByPriority = <T extends { priority: "low" | "medium" | "high" }>(arr: T[]) =>
    [...arr].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    workspaceId,
    generatedAt,
    totalClientsCount:        clients.length,
    liveClientsCount:         liveCount,
    staleClientsCount:        staleCount,
    clientsNeedingAttention:  needsAttention,
    activeIssuesCount:        issues.length,
    activeOpportunitiesCount: opportunities.length,
    pendingActionsCount:      actions.length,
    needsSetupCount,
    issues:        sortByPriority(issues),
    opportunities: sortByPriority(opportunities),
    actions:       sortByPriority(actions),
    clientReadiness,
  };
}
