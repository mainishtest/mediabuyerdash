export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession }    from "next-auth";
import { authOptions }         from "../../../lib/auth";
import { getUploadedImages }   from "../../../lib/creativelab/db";
import { prisma }              from "../../../lib/db";
import { ImageUploadView }     from "./ImageUploadView";

export const metadata: Metadata = {
  title: "Image Creative Lab — Media Buying Dashboard",
};

export default async function CreativeLabImagesPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const [images, clients] = await Promise.all([
    getUploadedImages(workspaceId).catch(() => []),
    prisma.clientAccount.findMany({
      where:   workspaceId ? { workspaceId } : undefined,
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  return (
    <ImageUploadView
      images={images.map((img) => ({
        id:             img.id,
        fileName:       img.fileName,
        mimeType:       img.mimeType,
        fileSize:       img.fileSize,
        storagePath:    img.storagePath,
        uploadedAt:     img.uploadedAt,
        iterationCount: img._count.iterations,
        analysisStatus: img.analysis?.analysisStatus ?? null,
        clarityScore:   img.analysis?.clarityScore   ?? null,
        attentionScore: img.analysis?.attentionScore ?? null,
        detectedStyle:  img.analysis?.detectedStyle  ?? null,
      }))}
      clients={clients}
    />
  );
}
