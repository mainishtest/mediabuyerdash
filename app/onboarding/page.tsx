export const dynamic = "force-dynamic";

// app/onboarding/page.tsx
// Self-serve onboarding flow. Initializes progress state, loads workspace data,
// and renders the multi-step wizard. Resumable — users can leave and return.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import {
  initializeOnboardingSession,
  getWorkspaceAccount,
  getIntegrationSetupState,
  buildAccountSetupChecklist,
  getOnboardingBlockers,
} from "../../lib/onboarding";
import { buildMetaSetupChecklist } from "../../lib/meta/integrationState";
import { buildShopifySetupChecklist } from "../../lib/shopify/integrationState";
import { isMetaConfigured } from "../../lib/meta/config";
import type { AccountDefaults } from "../../lib/onboarding-types";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId;
  if (!workspaceId) redirect("/login");

  // Initialize onboarding state (idempotent — creates if missing, returns existing)
  const progress = await initializeOnboardingSession(workspaceId);

  // If onboarding was already completed, go to dashboard
  if (progress.completedAt) redirect("/home");

  // Load data for all steps in parallel
  const [workspace, integrations, checklist, blockers, metaChecklist, shopifyChecklist] = await Promise.all([
    getWorkspaceAccount(workspaceId),
    getIntegrationSetupState(workspaceId),
    buildAccountSetupChecklist(workspaceId),
    getOnboardingBlockers(workspaceId),
    buildMetaSetupChecklist().catch(() => []),
    buildShopifySetupChecklist().catch(() => []),
  ]);

  // Compute account defaults from workspace
  const accountDefaults: AccountDefaults = {
    defaultCurrency: "USD",
    defaultTimezone: workspace.timezone,
    reportingWindow: "7d",
  };

  return (
    <OnboardingWizard
      progress={progress}
      workspace={workspace}
      integrations={integrations}
      checklist={checklist}
      blockers={blockers}
      accountDefaults={accountDefaults}
      metaChecklist={metaChecklist}
      metaConfigured={isMetaConfigured()}
      shopifyChecklist={shopifyChecklist}
    />
  );
}
