export const dynamic = "force-dynamic";

import { redirect }         from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../lib/auth";
import { buildPortfolioPayload } from "../../lib/portfolio/aggregator";
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

  const today      = new Date().toISOString().slice(0, 10);
  const thirtyDays = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const payload = await buildPortfolioPayload({
    workspaceId: session.user?.workspaceId ?? null,
    clientId:    searchParams.clientId,
    dateFrom:    searchParams.from ?? thirtyDays,
    dateTo:      searchParams.to   ?? today,
  }).catch(() => null);

  if (!payload) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500 text-sm">
        Portfolio data could not be loaded. Please try refreshing.
      </div>
    );
  }

  return <PortfolioView payload={payload} />;
}
