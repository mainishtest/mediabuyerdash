// ─── Action History — Outcome Linker ─────────────────────────────────────────
//
// Post-processing step that links action history entries to their downstream
// outcomes (experiment results, scale reviews, creative refreshes).
//
// Design: best-effort linking. Missing entities are handled gracefully.
// Uses CreativeOutcomeRouteRecord as the linking source.

import { prisma } from "../db";
import type {
  ActionHistoryEntry,
  ActionHistoryOutcomeLink,
} from "../../types/actionHistory";

// ── Link entries to outcomes ────────────────────────────────────────────────

/**
 * Attempt to link action history entries to their downstream outcomes.
 * Mutates the entries in place for performance (avoids array copy).
 * Only links entries that don't already have an outcomeLink.
 */
export async function linkActionHistoryToOutcomes(
  entries: ActionHistoryEntry[],
): Promise<ActionHistoryEntry[]> {
  // Collect entity IDs that might have outcomes
  const experimentEntityIds = entries
    .filter((e) => !e.outcomeLink && (
      e.eventType === "test_launched" ||
      e.eventType === "test_created" ||
      e.eventType === "execution_succeeded" ||
      e.eventType === "scale_executed"
    ))
    .map((e) => e.entity.entityId)
    .filter(Boolean);

  if (experimentEntityIds.length === 0) return entries;

  // Load outcome routes for these entities
  const db = prisma as Record<string, any>;
  let outcomeRoutes: any[] = [];
  try {
    outcomeRoutes = await db.creativeOutcomeRouteRecord.findMany({
      where: {
        OR: [
          { testResultId: { in: experimentEntityIds } },
          { id: { in: experimentEntityIds } },
        ],
      },
      select: {
        id:                    true,
        testResultId:          true,
        routeType:             true,
        readinessState:        true,
        challengerVariantTitle: true,
        outcome:               true,
      },
    });
  } catch {
    // Table might not exist
    return entries;
  }

  if (outcomeRoutes.length === 0) return entries;

  // Build lookup by testResultId and id
  const outcomeByEntity = new Map<string, any>();
  for (const route of outcomeRoutes) {
    if (route.testResultId) outcomeByEntity.set(route.testResultId, route);
    outcomeByEntity.set(route.id, route);
  }

  // Link entries
  for (const entry of entries) {
    if (entry.outcomeLink) continue;

    const route = outcomeByEntity.get(entry.entity.entityId);
    if (!route) continue;

    entry.outcomeLink = buildOutcomeLink(route);
  }

  return entries;
}

// ── Build outcome link from route record ────────────────────────────────────

function buildOutcomeLink(route: any): ActionHistoryOutcomeLink {
  const type = mapRouteToOutcomeType(route.routeType);
  return {
    outcomeId:   route.id,
    outcomeType: type,
    label:       buildOutcomeLabel(route),
    href:        "/creative-lab/outcomes",
  };
}

function mapRouteToOutcomeType(routeType: string): ActionHistoryOutcomeLink["outcomeType"] {
  switch (routeType) {
    case "send_winner_to_scale_review": return "scale_opportunity";
    case "keep_winner_running":         return "winner";
    case "send_loser_to_creative_lab":  return "refresh_needed";
    case "send_mixed_result_to_follow_up_test": return "retest_needed";
    case "monitor_until_more_data":     return "monitoring";
    default:                            return "loser";
  }
}

function buildOutcomeLabel(route: any): string {
  const variant = route.challengerVariantTitle ?? "Variant";
  const outcome = route.outcome ?? route.routeType?.replace(/_/g, " ") ?? "Outcome";
  return `${variant}: ${outcome}`;
}
