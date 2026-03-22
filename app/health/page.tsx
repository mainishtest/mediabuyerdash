export const dynamic = "force-dynamic";

// app/health/page.tsx
// First-sync data validation and account health check.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { buildFirstSyncValidationSummary } from "../../lib/health/evaluate";
import { HealthView } from "./HealthView";

export const metadata = {
  title: "Account Health — Media Buying Dashboard",
};

export default async function HealthPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/login");

  const summary = await buildFirstSyncValidationSummary(workspaceId);

  return <HealthView summary={summary} />;
}
