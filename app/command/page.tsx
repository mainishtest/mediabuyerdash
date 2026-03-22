export const dynamic = "force-dynamic";

import { redirect }                from "next/navigation";
import { getServerSession }         from "next-auth";
import { authOptions }              from "../../lib/auth";
import { buildOptimizationAssistantContext } from "../../lib/optimizationAssistant/contextAssembler";
import { CommandView }              from "./CommandView";

export async function generateMetadata() {
  return { title: "AI Command Center — Media Buying Dashboard" };
}

export default async function CommandPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Assemble context to pre-populate status cards
  const ctx = await buildOptimizationAssistantContext({});

  const statusData = {
    totalSpend:       ctx.summary.totalSpend,
    roas:             ctx.summary.overallRoas,
    openAlerts:       ctx.summary.openAlerts,
    pendingApprovals: ctx.summary.pendingApprovals,
    scaleReady:       ctx.outcomeScaleReadyCount,
    winnersCount:     ctx.outcomeWinnersCount,
    losersCount:      ctx.outcomeLosersCount,
    activeExperiments: ctx.summary.activeExperiments,
    blockedActions:   ctx.recentActionsBlockedCount,
  };

  return <CommandView statusData={statusData} />;
}
