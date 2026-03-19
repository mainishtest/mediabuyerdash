// app/creative-lab/briefs/page.tsx
// Creative Briefs — server page.
//
// Loads all briefs for the workspace from DB, passes to BriefsView.
// Brief generation happens via the POST /api/creative-lab/briefs route
// (triggered from the Refresh Queue action buttons).

export const dynamic = "force-dynamic";

import { getServerSession }            from "next-auth";
import { authOptions }                 from "../../../lib/auth";
import { prisma }                      from "../../../lib/db";
import { loadCreativeBriefs }          from "../../../lib/creativeBrief/db";
import { BriefsView }                  from "./BriefsView";

export const metadata = {
  title: "Creative Briefs — Creative Lab",
};

type PageProps = {
  searchParams: { clientId?: string; status?: string };
};

export default async function BriefsPage({ searchParams }: PageProps) {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const selectedClientId = searchParams?.clientId ?? null;

  const clients = await prisma.clientAccount
    .findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
      where:   workspaceId ? { workspaceId } : {},
    })
    .catch(() => []);

  const briefs = await loadCreativeBriefs({
    clientAccountId: selectedClientId ?? undefined,
  }).catch(() => []);

  return (
    <BriefsView
      clients={clients}
      initialBriefs={briefs}
      selectedClientId={selectedClientId}
    />
  );
}
