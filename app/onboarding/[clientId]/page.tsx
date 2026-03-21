// app/onboarding/[clientId]/page.tsx
// Per-client onboarding readiness page.

import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGoLiveSummary } from "@/lib/onboarding";
import { OnboardingReadinessView } from "./OnboardingReadinessView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { clientId: string };
}) {
  try {
    const summary = await buildGoLiveSummary(params.clientId);
    return { title: `Onboarding — ${summary.clientName}` };
  } catch {
    return { title: "Onboarding" };
  }
}

export default async function OnboardingReadinessPage({
  params,
}: {
  params: { clientId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let summary;
  try {
    summary = await buildGoLiveSummary(params.clientId);
  } catch {
    notFound();
  }

  return <OnboardingReadinessView summary={summary} />;
}
