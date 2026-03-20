export const dynamic = "force-dynamic";

import { redirect }        from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../lib/auth";
import { buildCommandCenterPayload } from "../../lib/commandCenter/aggregator";
import { CommandCenterView } from "./CommandCenterView";

type PageProps = {
  searchParams: {
    clientId?: string;
    from?: string;
    to?: string;
  };
};

export async function generateMetadata() {
  return { title: "Command Center — Media Buying Dashboard" };
}

export default async function CommandCenterPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const today         = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const payload = await buildCommandCenterPayload({
    clientId: searchParams.clientId,
    dateFrom: searchParams.from ?? thirtyDaysAgo,
    dateTo:   searchParams.to   ?? today,
  }).catch(() => null);

  if (!payload) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500 text-sm">
        Command Center data could not be loaded. Please try refreshing.
      </div>
    );
  }

  return <CommandCenterView payload={payload} />;
}
