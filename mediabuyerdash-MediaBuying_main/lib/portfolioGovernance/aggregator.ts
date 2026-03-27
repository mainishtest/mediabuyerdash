// ─── Portfolio Governance — Main Aggregator ───────────────────────────────────
//
// Orchestrates all governance builders and returns PortfolioGovernancePayload.
// Accepts PortfolioPayload as input — no direct DB calls.
// This is the single entry point for the governance layer.
//
// IMPORTANT: This layer provides decision support and governance guidance only.
// It does NOT perform automated capital reallocation or budget movement.

import type { PortfolioPayload } from "../portfolio/types";
import type {
  PortfolioGovernancePayload,
  PortfolioGovernanceSummary,
} from "./types";
import { buildPortfolioOpportunities } from "./opportunities";
import { buildPortfolioRisks }         from "./risks";
import { buildPortfolioBudgetGovernanceItems } from "./budgetGovernance";

// ── Main function ─────────────────────────────────────────────────────────────

export function summarizePortfolioGovernance(
  portfolioPayload: PortfolioPayload
): PortfolioGovernancePayload {
  const opportunities    = buildPortfolioOpportunities(portfolioPayload);
  const risks            = buildPortfolioRisks(portfolioPayload);
  const budgetGovernance = buildPortfolioBudgetGovernanceItems(portfolioPayload);

  const criticalOpportunities = opportunities.filter(
    (o) => o.priorityScore.tier === "critical"
  ).length;

  const criticalRisks = risks.filter(
    (r) => r.priorityScore.tier === "critical"
  ).length;

  const readyOpportunities = opportunities.filter(
    (o) => o.readiness === "ready"
  ).length;

  const blockedItems =
    opportunities.filter((o) => o.readiness === "blocked").length +
    risks.filter((r) => r.readiness === "blocked" || r.readiness === "needs_review").length;

  const accountsWithBlockers = new Set([
    ...risks.filter((r) => r.blockers.length > 0).map((r) => r.clientId),
    ...opportunities.filter((o) => o.blockers.length > 0).map((o) => o.clientId),
  ]).size;

  const summary: PortfolioGovernanceSummary = {
    generatedAt:           new Date().toISOString(),
    dateRange:             portfolioPayload.summary.dateRange,
    totalOpportunities:    opportunities.length,
    criticalOpportunities,
    totalRisks:            risks.length,
    criticalRisks,
    readyOpportunities,
    blockedItems,
    budgetGovernanceItems: budgetGovernance.length,
    totalClients:          portfolioPayload.summary.totalClients,
    accountsWithBlockers,
  };

  return {
    summary,
    opportunities,
    risks,
    budgetGovernance,
    clients: portfolioPayload.clients,
  };
}
