export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ImageVariationInsightsView } from "./ImageVariationInsightsView";

export const metadata: Metadata = {
  title: "Image Variation Insights — Creative Lab",
};

export default function ImageVariationInsightsPage() {
  return <ImageVariationInsightsView />;
}
