export const dynamic = "force-dynamic";

// app/accounts/new/page.tsx
// Account onboarding + readiness checks page.
// Lists existing accounts with readiness state and allows creating new ones.

import { redirect }                      from "next/navigation";
import { getServerSession }              from "next-auth";
import { authOptions }                   from "../../../lib/auth";
import { fetchOnboardingAccountList }    from "../../../lib/onboarding/data";
import { OnboardingReadinessView }       from "./OnboardingReadinessView";

export default async function AccountsNewPage() {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId;

  if (!workspaceId) redirect("/login");

  const accounts = await fetchOnboardingAccountList(workspaceId);

  return (
    <OnboardingReadinessView
      accounts={accounts}
      workspaceName={session?.user?.workspaceName ?? "Workspace"}
    />
  );
}
