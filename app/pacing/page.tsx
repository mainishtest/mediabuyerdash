export const dynamic = "force-dynamic";

import { getServerSession }               from "next-auth";
import { authOptions }                    from "../../lib/auth";
import { buildAllClientsPacingSummaries } from "../../lib/budgetPacing/service";
import { PacingView }                     from "./PacingView";

export async function generateMetadata() {
  return { title: "Budget Pacing — Media Buying Dashboard" };
}

export default async function PacingPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const summaries = await buildAllClientsPacingSummaries(workspaceId);

  return <PacingView summaries={summaries} />;
}
