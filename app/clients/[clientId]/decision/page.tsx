// app/clients/[clientId]/decision/page.tsx — Client Decision View
export const dynamic = "force-dynamic";

import Link                from "next/link";
import { redirect }        from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../lib/auth";
import { buildClientDecisionSummary } from "../../../../lib/clientDecision/aggregator";
import ClientDecisionView  from "./ClientDecisionView";

type PageProps = {
  params: { clientId: string };
};

export async function generateMetadata({ params }: PageProps) {
  return { title: "Decision View — Media Buying Dashboard" };
}

export default async function ClientDecisionPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const data = await buildClientDecisionSummary(params.clientId);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-slate-300">Client not found.</p>
        <Link href="/" className="mt-4 text-sm text-slate-400 hover:text-slate-200">
          ← Back to Daily Summary
        </Link>
      </div>
    );
  }

  return <ClientDecisionView data={data} />;
}
