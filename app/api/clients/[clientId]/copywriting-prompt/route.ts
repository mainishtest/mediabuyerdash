import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../../lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;
  const body = await req.json();
  const { copywritingPrompt, productImageUrl } = body as {
    copywritingPrompt?: string;
    productImageUrl?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (copywritingPrompt !== undefined) data.copywritingPrompt = copywritingPrompt || null;
  if (productImageUrl !== undefined)   data.productImageUrl   = productImageUrl || null;

  await prisma.clientAccount.update({
    where: { id: clientId },
    data,
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const client = await prisma.clientAccount.findUnique({
    where:  { id: params.clientId },
    select: { copywritingPrompt: true, productImageUrl: true },
  });

  return NextResponse.json({
    ok: true,
    copywritingPrompt: client?.copywritingPrompt ?? null,
    productImageUrl:   client?.productImageUrl ?? null,
  });
}
