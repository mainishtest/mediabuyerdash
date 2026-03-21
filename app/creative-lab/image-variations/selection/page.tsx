export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ImageVariationSelectionView } from "./ImageVariationSelectionView";
import { loadApprovedRequestsAction } from "../actions";

export const metadata: Metadata = {
  title: "Image Variation Selection — Creative Lab",
};

export default async function ImageVariationSelectionPage() {
  const requests = await loadApprovedRequestsAction();

  return <ImageVariationSelectionView initialRequests={requests} />;
}
