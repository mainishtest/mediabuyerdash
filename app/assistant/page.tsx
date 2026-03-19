export const dynamic = "force-dynamic";

import { redirect }        from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }     from "../../lib/auth";
import { AssistantView }   from "./AssistantView";

type PageProps = {
  searchParams: {
    clientId?: string;
    from?: string;
    to?: string;
  };
};

export async function generateMetadata() {
  return { title: "AI Assistant — Media Buying Dashboard" };
}

export default async function AssistantPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const today         = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  return (
    <AssistantView
      clientId={searchParams.clientId}
      dateFrom={searchParams.from ?? thirtyDaysAgo}
      dateTo={searchParams.to   ?? today}
    />
  );
}
