export const dynamic = "force-dynamic";

import { redirect }        from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }     from "../../../lib/auth";
import { buildPortfolioPayload }       from "../../../lib/portfolio/aggregator";
import { summarizePortfolioGovernance } from "../../../lib/portfolioGovernance/aggregator";
import { GovernanceView }  from "./GovernanceView";

type PageProps = {
  searchParams: {
    clientId?: string;
    from?:     string;
    to?:       string;
  };
};

export async function generateMetadata() {
  return { title: "Portfolio Governance — Media Buying Dashboard" };
}

export default async function PortfolioGovernancePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const today      = new Date().toISOString().slice(0, 10);
  const thirtyDays = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  // Fetch portfolio data (reuses existing aggregator — no duplicate queries)
  const portfolioPayload = await buildPortfolioPayload({
    workspaceId: session.user?.workspaceId ?? null,
    clientId:    searchParams.clientId,
    dateFrom:    searchParams.from ?? thirtyDays,
    dateTo:      searchParams.to   ?? today,
  });

  // Build governance layer on top of portfolio data
  const governancePayload = summarizePortfolioGovernance(portfolioPayload);

  return <GovernanceView payload={governancePayload} />;
}
