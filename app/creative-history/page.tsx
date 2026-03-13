import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "../../lib/db";
import { GenerationHistoryView } from "./GenerationHistoryView";

export const metadata = {
  title: "Generation History — Media Buying Dashboard"
};

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function CreativeHistoryPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const clientAccountId = typeof searchParams.clientAccount === "string" ? searchParams.clientAccount : undefined;
  const requestType = typeof searchParams.requestType === "string" ? searchParams.requestType : undefined;
  const provider = typeof searchParams.provider === "string" ? searchParams.provider : undefined;
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;

  const runs = await prisma.generationRun.findMany({
    where: {
      ...(clientAccountId ? { clientAccountId } : {}),
      ...(requestType ? { requestType } : {}),
      ...(provider ? { provider } : {}),
      ...(status ? { status } : {})
    },
    orderBy: { createdAt: "desc" },
    include: {
      promptSnapshot: true,
      providerRequest: true,
      providerResponse: true,
      copyVariations: true,
      imageVariations: true,
      approvalDecisions: true,
      selectedVariants: true
    }
  });

  const clientAccounts = await prisma.clientAccount.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-200 sm:px-6 lg:px-8">
      <header className="mb-10">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
          ← Back to Dashboard
        </Link>
        <Link href="/creative-lab" className="mb-4 ml-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
          Creative Lab →
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">
          Generation History
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Audit trail of AI generation runs, prompts, provider payloads, parsed variations, and approval decisions.
          Supports human review, traceability, and future testing and publishing workflows.
        </p>
      </header>

      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <GenerationHistoryView
          runs={runs}
          clientAccounts={clientAccounts}
          filters={{ clientAccountId, requestType, provider, status }}
        />
      </Suspense>
    </div>
  );
}
