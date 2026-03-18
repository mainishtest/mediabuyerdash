export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions }      from "../../../lib/auth";
import {
  getCreativePerformance,
  buildCreativePerformanceSummary,
} from "../../../lib/creativePerformance";
import { PerformanceView } from "./PerformanceView";

export async function generateMetadata() {
  return { title: "Creative Performance — Media Buying Dashboard" };
}

// Default to last 30 days for a useful initial view.
function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const now  = new Date();
  const to   = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
  return { dateFrom: from, dateTo: to };
}

export default async function CreativePerformancePage({
  searchParams,
}: {
  searchParams?: Record<string, string>;
}) {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const defaults    = defaultDateRange();
  const dateFrom    = searchParams?.dateFrom    ?? defaults.dateFrom;
  const dateTo      = searchParams?.dateTo      ?? defaults.dateTo;
  const clientId    = searchParams?.clientId    ?? undefined;
  const campaignId  = searchParams?.campaignId  ?? undefined;

  let rows    = await getCreativePerformance({
    workspaceId,
    clientAccountId: clientId,
    campaignId,
    dateFrom,
    dateTo,
    windowDays: 7,
  }).catch(() => []);

  const summary = buildCreativePerformanceSummary(rows);

  return (
    <PerformanceView
      rows={rows}
      summary={summary}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  );
}
