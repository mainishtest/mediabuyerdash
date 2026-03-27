export const dynamic = "force-dynamic";

import { redirect }         from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../lib/auth";
import { TraceView }        from "./TraceView";

export async function generateMetadata() {
  return { title: "Decision Trace — Media Buying Dashboard" };
}

export default async function TracePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <TraceView />;
}
