// app/api/creative-lab/results/[id]/ingest/route.ts
// POST /api/creative-lab/results/[id]/ingest
// Triggers ingestion for one creative test result:
//   - loads Meta delivery + CRM data
//   - compares control vs challenger
//   - evaluates outcome
//   - syncs back to ExperimentResultRecord
//   - creates lifecycle link

import { NextRequest, NextResponse } from "next/server";
import { ingestCreativeTestResults } from "../../../../../../lib/creativeTestResults";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await ingestCreativeTestResults(id);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed.";
    console.error("[results/[id]/ingest/POST]", err);

    if (message.includes("not found")) {
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
