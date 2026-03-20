export const dynamic = "force-dynamic";

import { redirect }        from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }     from "../../../lib/auth";
import { buildPortfolioControlsPayload } from "../../../lib/portfolioControls/aggregator";
import { ControlsView }    from "./ControlsView";

type PageProps = {
  searchParams: {
    clientId?: string;
  };
};

export async function generateMetadata() {
  return { title: "Portfolio Controls — Media Buying Dashboard" };
}

export default async function PortfolioControlsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const payload = await buildPortfolioControlsPayload({
    workspaceId: session.user?.workspaceId ?? null,
    clientId:    searchParams.clientId,
  });

  return <ControlsView payload={payload} />;
}
