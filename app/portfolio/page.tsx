export const dynamic = "force-dynamic";

import { redirect }         from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../lib/auth";
import { buildPortfolioPayload } from "../../lib/portfolio/aggregator";
import { buildPortfolioIntelligenceSummary } from "../../lib/portfolioIntelligence/aggregator";
import { PortfolioView }     from "./PortfolioView";

type PageProps = {
  searchParams: {
    clientId?: string;
    from?:     string;
    to?:       string;
  };
};

export async function generateMetadata() {
  return { title: "Portfolio — Media Buying Dashboard" };
}

export default async function PortfolioPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user?.workspaceId ?? null;
  const today      = new Date().toISOString().slice(0, 10);
  const thirtyDays = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const [payload, intelligence] = await Promise.all([
    buildPortfolioPayload({
      workspaceId,
      clientId:    searchParams.clientId,
      dateFrom:    searchParams.from ?? thirtyDays,
      dateTo:      searchParams.to   ?? today,
    }),
    buildPortfolioIntelligenceSummary({ workspaceId }).catch((err) => {
      console.error("[portfolio] Intelligence aggregation failed:", err);
      return null;
    }),
  ]);

  return <PortfolioView payload={payload} intelligence={intelligence} />;
}
