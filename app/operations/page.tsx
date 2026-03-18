export const dynamic = "force-dynamic";

import { getServerSession }         from "next-auth";
import { authOptions }              from "../../lib/auth";
import { buildOperationsSnapshot }  from "../../lib/operations/aggregator";
import { OperationsView }           from "./OperationsView";

export async function generateMetadata() {
  return { title: "Operations — Media Buying Dashboard" };
}

export default async function OperationsPage() {
  const session    = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const snapshot = await buildOperationsSnapshot(workspaceId);

  return <OperationsView snapshot={snapshot} />;
}
