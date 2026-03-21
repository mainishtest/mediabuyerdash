// app/page.tsx — Daily Executive Summary (home dashboard)
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { redirect }         from "next/navigation";
import { authOptions }       from "../lib/auth";
import { buildDailyExecutiveSummary } from "../lib/dailySummary/aggregator";
import DailyDashboardView   from "./DailyDashboardView";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const data = await buildDailyExecutiveSummary({
    workspaceId: session.user.workspaceId ?? null,
  });

  return <DailyDashboardView data={data} />;
}
