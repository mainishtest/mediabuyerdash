export const dynamic = "force-dynamic";

import { notFound }                       from "next/navigation";
import { prisma }                          from "../../../../lib/db";
import { getClientGoalDefaults }           from "../../../../lib/clientGoalDefaults/service";
import { buildClientGoalCoverageSummary }  from "../../../../lib/clientGoalDefaults/service";
import { ClientSettingsView }              from "./ClientSettingsView";

type PageProps = {
  params: { clientId: string };
};

export async function generateMetadata({ params }: PageProps) {
  const account = await prisma.clientAccount.findUnique({
    where:  { id: params.clientId },
    select: { name: true },
  });
  return {
    title: account
      ? `Settings — ${account.name} — Media Buying Dashboard`
      : "Client Settings",
  };
}

export default async function ClientSettingsPage({ params }: PageProps) {
  const { clientId } = params;

  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true, name: true, copywritingPrompt: true, productImageUrl: true },
  });
  if (!account) notFound();

  const [defaults, coverage] = await Promise.all([
    getClientGoalDefaults(clientId),
    buildClientGoalCoverageSummary(clientId),
  ]);

  return (
    <ClientSettingsView
      clientId={account.id}
      clientName={account.name}
      defaults={defaults}
      coverage={coverage}
      copywritingPrompt={account.copywritingPrompt}
      initialProductImageUrl={account.productImageUrl}
    />
  );
}
