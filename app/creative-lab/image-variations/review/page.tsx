export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ImageVariationReviewView } from "./ImageVariationReviewView";
import { buildImageVariationReviewQueue } from "../../../../lib/imageVariation/review";

export const metadata: Metadata = {
  title: "Image Variation Review — Creative Lab",
};

export default async function ImageVariationReviewPage() {
  const queue = await buildImageVariationReviewQueue().catch(() => ({
    comparisonSets: [],
    totalCandidates: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    revisionRequested: 0,
  }));

  // Serialize dates for client component
  const serializedSets = queue.comparisonSets.map((set) => ({
    ...set,
    items: set.items.map((item) => ({
      ...item,
      candidate: { ...item.candidate },
    })),
  }));

  return (
    <ImageVariationReviewView
      initialQueue={{
        ...queue,
        comparisonSets: serializedSets,
      }}
    />
  );
}
