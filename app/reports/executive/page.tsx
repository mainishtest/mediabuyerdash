export const dynamic = "force-dynamic";

import { redirect }         from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../../lib/auth";
import { buildExecutiveSummary } from "../../../lib/executiveReporting/aggregator";
import { ExecutiveReportView }   from "./ExecutiveReportView";

type PageProps = {
  searchParams: {
    clientId?:   string;
    campaignId?: string;
    from?:       string;
    to?:         string;
    compare?:    string; // "1" to enable comparison
  };
};

export async function generateMetadata() {
  return { title: "Executive Report — Media Buying Dashboard" };
}

export default async function ExecutiveReportPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Use local date parts to avoid UTC offset shifting "today" across the date line
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const ago = new Date(Date.now() - 30 * 864e5);
  const thirtyDaysAgo = `${ago.getFullYear()}-${String(ago.getMonth() + 1).padStart(2, "0")}-${String(ago.getDate()).padStart(2, "0")}`;

  const summary = await buildExecutiveSummary({
    clientId:            searchParams.clientId,
    campaignId:          searchParams.campaignId,
    dateFrom:            searchParams.from    ?? thirtyDaysAgo,
    dateTo:              searchParams.to      ?? today,
    compareWithPrevious: searchParams.compare === "1",
  });

  return <ExecutiveReportView summary={summary} />;
}
