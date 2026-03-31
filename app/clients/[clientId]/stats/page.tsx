// Server component — fetches client metadata, renders the Stats view.
// Wrapped in Suspense because StatsView uses useSearchParams().

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "../../../../lib/db";
import { StatsView } from "./StatsView";
import { redirect } from "next/navigation";

export default async function StatsPage({
  params,
}: {
  params: { clientId: string };
}) {
  const { clientId } = params;

  const client = await prisma.clientAccount.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, timezone: true },
  });

  if (!client) redirect("/dashboard");

  return (
    <Suspense>
      <StatsView
        clientId={client.id}
        clientName={client.name}
        timezone={client.timezone || "America/New_York"}
      />
    </Suspense>
  );
}
