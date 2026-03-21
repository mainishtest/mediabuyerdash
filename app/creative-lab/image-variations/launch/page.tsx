export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ImageVariationLaunchView } from "./ImageVariationLaunchView";
import { loadImageVariationExperimentLaunchPlans } from "../../../../lib/imageVariation/experimentLaunch";

export const metadata: Metadata = {
  title: "Image Variation Experiment Launch — Creative Lab",
};

export default async function ImageVariationLaunchPage() {
  const plans = await loadImageVariationExperimentLaunchPlans({ limit: 50 }).catch(
    () => [],
  );

  return <ImageVariationLaunchView initialPlans={plans} />;
}
