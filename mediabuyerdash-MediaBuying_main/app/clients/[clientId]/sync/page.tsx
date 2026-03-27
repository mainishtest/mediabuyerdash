export const dynamic = "force-dynamic";

import { notFound }            from "next/navigation";
import { prisma }              from "../../../../lib/db";
import { getClientSyncHistory } from "../../../../lib/clientSync/db";
import { SyncHistoryView }      from "./SyncHistoryView";

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
      ? `Sync History — ${account.name} — Media Buying Dashboard`
      : "Sync History",
  };
}

export default async function ClientSyncHistoryPage({ params }: PageProps) {
  const { clientId } = params;

  const [account, runs] = await Promise.all([
    prisma.clientAccount.findUnique({
      where:  { id: clientId },
      select: { id: true, name: true },
    }),
    getClientSyncHistory(clientId),
  ]);

  if (!account) notFound();

  return (
    <SyncHistoryView
      clientId={account.id}
      clientName={account.name}
      runs={runs}
    />
  );
}
