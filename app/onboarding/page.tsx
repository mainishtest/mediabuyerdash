export const dynamic = "force-dynamic";

// app/onboarding/page.tsx
// Self-serve onboarding flow. Initializes progress state, loads workspace data,
// and renders the multi-step wizard. Resumable — users can leave and return.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import {
  initializeOnboardingState,
  getWorkspaceProfile,
  getIntegrationStatus,
  buildSetupChecklist,
} from "../../lib/onboarding";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/login");

  // Initialize onboarding state (idempotent — creates if missing, returns existing)
  const progress = await initializeOnboardingState(workspaceId);

  // If onboarding was already completed, go to dashboard
  if (progress.completedAt) redirect("/home");

  // Load data for all steps in parallel
  const [workspace, integrations, checklist] = await Promise.all([
    getWorkspaceProfile(workspaceId),
    getIntegrationStatus(workspaceId),
    buildSetupChecklist(workspaceId),
  ]);

  return (
    <OnboardingWizard
      progress={progress}
      workspace={workspace}
      integrations={integrations}
      checklist={checklist}
    />
  );
}
