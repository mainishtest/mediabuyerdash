import { mockCreativeDiagnosisInputs } from "../../lib/data/mockCreativeDiagnosisInputs";
import {
  diagnoseCreative,
  generateCopyRecommendation,
  generateImageRecommendation
} from "../../lib/creativeDiagnosisUtils";
import type { CreativeLabEntry } from "../../types/creativeDiagnosis";
import { CreativeLabView } from "./CreativeLabView";

export const metadata = {
  title: "Creative Optimization Lab — Media Buying Dashboard"
};

export default function CreativeLabPage() {
  // Build the full entry set for every sample ad.
  // All logic runs at request time on the server — no DB needed for this step.
  const entries: CreativeLabEntry[] = mockCreativeDiagnosisInputs.map((input) => {
    const diagnosis          = diagnoseCreative(input);
    const copyRecommendation =
      diagnosis.causeType === "copy" || diagnosis.causeType === "mixed"
        ? generateCopyRecommendation(input)
        : null;
    const imageRecommendation =
      diagnosis.causeType === "image" || diagnosis.causeType === "mixed"
        ? generateImageRecommendation(input)
        : null;

    return { input, diagnosis, copyRecommendation, imageRecommendation };
  });

  return <CreativeLabView entries={entries} />;
}
