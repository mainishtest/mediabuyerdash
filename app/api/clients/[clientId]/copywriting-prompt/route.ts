import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../../lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;
  const body = await req.json();
  const { copywritingPrompt } = body as { copywritingPrompt: string };

  await prisma.clientAccount.update({
    where: { id: clientId },
    data:  { copywritingPrompt: copywritingPrompt || null },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const client = await prisma.clientAccount.findUnique({
    where:  { id: params.clientId },
    select: { copywritingPrompt: true },
  });

  return NextResponse.json({
    ok: true,
    copywritingPrompt: client?.copywritingPrompt ?? null,
  });
}
