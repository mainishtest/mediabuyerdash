import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { assetId: string } },
) {
  const asset = await prisma.creativeSourceAsset.findUnique({
    where: { id: params.assetId },
  });

  if (!asset) {
    return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, asset });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { assetId: string } },
) {
  const body = await req.json();

  // Only allow updating safe fields
  const allowed = ["label", "status", "hook", "bodyText", "callToAction", "imageHeadline", "notes"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const asset = await prisma.creativeSourceAsset.update({
    where: { id: params.assetId },
    data,
  });

  return NextResponse.json({ ok: true, asset });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { assetId: string } },
) {
  await prisma.creativeSourceAsset.delete({
    where: { id: params.assetId },
  });

  return NextResponse.json({ ok: true });
}
