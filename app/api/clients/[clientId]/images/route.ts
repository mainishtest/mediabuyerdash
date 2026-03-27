import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../../lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const images = await prisma.clientAdImage.findMany({
    where:   { clientAccountId: params.clientId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, images });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const body = await req.json();
  const { label, imageUrl, tags } = body as {
    label: string; imageUrl: string; tags?: string;
  };

  if (!label || !imageUrl) {
    return NextResponse.json({ ok: false, error: "Label and image URL required" }, { status: 400 });
  }

  const image = await prisma.clientAdImage.create({
    data: {
      clientAccountId: params.clientId,
      label,
      imageUrl,
      tags: tags || null,
    },
  });

  return NextResponse.json({ ok: true, image });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { imageId } = (await req.json()) as { imageId: string };
  await prisma.clientAdImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}
