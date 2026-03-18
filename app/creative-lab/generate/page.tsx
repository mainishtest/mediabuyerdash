// app/creative-lab/generate/page.tsx
// Creative Lab — AI generation pipeline.
//
// This route hosts the original AI copy and image variation generator,
// moved here to make /creative-lab the workflow queue landing page.
// Access via "AI Generator →" in the Creative Lab header, or directly
// from an item detail panel via "Open in Generator".

export const dynamic = "force-dynamic";

import { mockCreativeDiagnosisInputs } from "../../../lib/data/mockCreativeDiagnosisInputs";
import {
  diagnoseCreative,
  generateCopyRecommendation,
  generateImageRecommendation,
} from "../../../lib/creativeDiagnosisUtils";
import type { CreativeLabEntry }             from "../../../types/creativeDiagnosis";
import type { JobWithVariations, ApprovalMap } from "../../../types/aiProvider";
import { prisma }                             from "../../../lib/db";
import { getProviderConfigStatusAction }      from "../actions";
import { CreativeLabView }                    from "../CreativeLabView";

export const metadata = {
  title: "Creative Generator — Creative Lab",
};

export default async function CreativeLabGeneratePage() {
  const entries: CreativeLabEntry[] = mockCreativeDiagnosisInputs.map((input) => {
    const diagnosis           = diagnoseCreative(input);
    const copyRecommendation  =
      diagnosis.causeType === "copy" || diagnosis.causeType === "mixed"
        ? generateCopyRecommendation(input)
        : null;
    const imageRecommendation =
      diagnosis.causeType === "image" || diagnosis.causeType === "mixed"
        ? generateImageRecommendation(input)
        : null;

    return { input, diagnosis, copyRecommendation, imageRecommendation };
  });

  const [jobs, approvals] = await Promise.all([
    prisma.aIGenerationJob
      .findMany({ orderBy: { createdAt: "desc" }, include: { approvals: true } })
      .catch(() => []),
    prisma.creativeApproval.findMany().catch(() => []),
  ]);

  const jobsByAd: Record<
    string,
    { copyJobs: JobWithVariations[]; imageJobs: JobWithVariations[] }
  > = {};
  for (const entry of entries) {
    jobsByAd[entry.input.adId] = { copyJobs: [], imageJobs: [] };
  }
  for (const job of jobs) {
    const parsed: JobWithVariations = {
      id:          job.id,
      requestType: job.requestType as "copy" | "image",
      provider:    job.provider,
      status:      job.status,
      createdAt:   job.createdAt,
      variations:  job.responseSnapshot ? JSON.parse(job.responseSnapshot) : [],
    };
    const bucket = job.requestType === "copy" ? "copyJobs" : "imageJobs";
    if (jobsByAd[job.entityId]) jobsByAd[job.entityId][bucket].push(parsed);
  }

  const approvalMap: ApprovalMap = {};
  for (const a of approvals) {
    approvalMap[`${a.jobId}_${a.variationId}`] = a.status as "draft" | "approved" | "rejected";
  }

  const allJobs: JobWithVariations[] = jobs.map((job) => ({
    id:          job.id,
    requestType: job.requestType as "copy" | "image",
    provider:    job.provider,
    status:      job.status,
    createdAt:   job.createdAt,
    variations:  job.responseSnapshot ? JSON.parse(job.responseSnapshot) : [],
  }));

  const providerConfig = await getProviderConfigStatusAction();

  return (
    <CreativeLabView
      entries={entries}
      jobsByAd={jobsByAd}
      approvalMap={approvalMap}
      allJobs={allJobs}
      providerConfig={providerConfig}
    />
  );
}
