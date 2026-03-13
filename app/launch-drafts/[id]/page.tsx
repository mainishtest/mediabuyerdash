import { notFound } from "next/navigation";
import Link from "next/link";
import { getLaunchDraftWithVariants } from "../../../lib/launchDraftUtils";
import { LaunchDraftDetail } from "./LaunchDraftDetail";

export const dynamic = "force-dynamic";

export default async function LaunchDraftDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const draft = await getLaunchDraftWithVariants(params.id);
  if (!draft) notFound();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/launch-drafts"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ← Launch Drafts
          </Link>
        </div>

        <LaunchDraftDetail draft={draft} />
      </div>
    </main>
  );
}
