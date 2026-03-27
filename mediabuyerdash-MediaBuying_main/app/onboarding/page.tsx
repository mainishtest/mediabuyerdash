export const dynamic = "force-dynamic";

// app/onboarding/page.tsx
// First-login onboarding. If the workspace already has clients, redirect to /dashboard.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { OnboardingView } from "./OnboardingView";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Already has clients — skip onboarding
  if (workspaceId) {
    const count = await prisma.clientAccount.count({ where: { workspaceId } });
    if (count > 0) redirect("/dashboard");
  }

  return (
    <OnboardingView
      workspaceName={session?.user?.workspaceName ?? "Your Workspace"}
    />
  );
}
