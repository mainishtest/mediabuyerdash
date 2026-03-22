export const dynamic = "force-dynamic";

import { redirect }                from "next/navigation";
import { getServerSession }         from "next-auth";
import { authOptions }              from "../../lib/auth";
import { buildWeeklyStrategyRollup } from "../../lib/weeklyRollup/aggregator";
import { WeeklyView }              from "./WeeklyView";

export async function generateMetadata() {
  return { title: "Weekly Strategy Rollup — Media Buying Dashboard" };
}

export default async function WeeklyPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId ?? null;

  const rollup = await buildWeeklyStrategyRollup({
    workspaceId,
    weekOffset: 1, // last week by default
  });

  return <WeeklyView rollup={rollup} />;
}
