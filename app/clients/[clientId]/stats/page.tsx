// app/clients/[clientId]/stats/page.tsx
// Server component — fetches client metadata and renders StatsView.

export const dynamic = "force-dynamic";

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

  if (!client) {
    redirect("/dashboard");
  }

  return (
    <StatsView
      clientId={client.id}
      clientName={client.name}
      timezone={client.timezone || "America/New_York"}
    />
  );
}
