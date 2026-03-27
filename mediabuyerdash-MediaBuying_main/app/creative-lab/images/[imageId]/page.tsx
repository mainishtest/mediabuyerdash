export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound }           from "next/navigation";
import { getUploadedImageById } from "../../../../lib/creativelab/db";
import { ImageDetailView }    from "./ImageDetailView";

export const metadata: Metadata = {
  title: "Image Detail — Creative Lab",
};

export default async function ImageDetailPage({
  params,
}: {
  params: { imageId: string };
}) {
  const image = await getUploadedImageById(params.imageId).catch(() => null);
  if (!image) notFound();

  const observations: string[] = image.analysis?.directResponseObservationsJson
    ? (JSON.parse(image.analysis.directResponseObservationsJson) as string[])
    : [];

  return (
    <ImageDetailView
      image={{
        id:          image.id,
        fileName:    image.fileName,
        mimeType:    image.mimeType,
        fileSize:    image.fileSize,
        storagePath: image.storagePath,
        uploadedAt:  image.uploadedAt,
      }}
      analysis={
        image.analysis
          ? {
              analysisStatus:              image.analysis.analysisStatus,
              analysisEngine:              image.analysis.analysisEngine,
              detectedStyle:               image.analysis.detectedStyle,
              dominantMessage:             image.analysis.dominantMessage,
              visualTheme:                 image.analysis.visualTheme,
              clarityScore:                image.analysis.clarityScore,
              attentionScore:              image.analysis.attentionScore,
              directResponseObservations:  observations,
            }
          : null
      }
      concepts={image.iterations.map((c) => ({
        id:                  c.id,
        title:               c.title,
        conceptSummary:      c.conceptSummary,
        visualChanges:       c.visualChanges,
        goal:                c.goal,
        directResponseAngle: c.directResponseAngle,
        approvalStatus:      c.approvalStatus,
      }))}
    />
  );
}
