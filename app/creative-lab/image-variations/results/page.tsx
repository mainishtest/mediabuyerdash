export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ImageVariationResultsView } from "./ImageVariationResultsView";

export const metadata: Metadata = {
  title: "Image Variation Results — Creative Lab",
};

export default function ImageVariationResultsPage() {
  return <ImageVariationResultsView />;
}
