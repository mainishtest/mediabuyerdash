export const dynamic = "force-dynamic";

// app/readiness/page.tsx
// Account readiness validation and go-live dashboard.
// Evaluates setup completeness across workspace, integrations, sync, and configuration.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { buildAccountReadinessSummary } from "../../lib/readiness/evaluate";
import { ReadinessView } from "./ReadinessView";

export const metadata = {
  title: "Account Readiness — Media Buying Dashboard",
};

export default async function ReadinessPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/login");

  const summary = await buildAccountReadinessSummary(workspaceId);

  return <ReadinessView summary={summary} />;
}
