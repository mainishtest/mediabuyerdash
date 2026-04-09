"use server";

// Optimization Agent — Server Actions

import type { RiskMode, AgentRecommendation } from "../../lib/agentFramework/types";
import type { OptimizationAnalysis } from "../../lib/optimizationAgent/types";
import { analyzeActiveAccount } from "../../lib/optimizationAgent/analyzer";
import {
  generateOptimizationRecommendations,
  generateOptimizationSummary,
} from "../../lib/optimizationAgent/recommender";
import {
  createAgentJob,
  updateJobStatus,
  completeJob,
  createStep,
  startStep,
  completeStep,
  failStep,
} from "../../lib/agentFramework/executor";

export interface OptimizationResult {
  ok: boolean;
  jobId: string;
  analysis?: OptimizationAnalysis;
  recommendations?: AgentRecommendation[];
  summary?: string;
  error?: string;
}

export async function runOptimizationScanAction(
  adAccountId: string,
  riskMode: RiskMode = "balanced"
): Promise<OptimizationResult> {
  const startTime = Date.now();
  const steps = [
    createStep("collect_metrics", "Collect active campaign metrics"),
    createStep("run_rules", "Run optimization rule engine"),
    createStep("detect_fatigue", "Detect creative fatigue signals"),
    createStep("generate_recommendations", "Generate recommendations"),
  ];

  const jobId = await createAgentJob({
    agentType: "optimization",
    trigger: "user_prompt",
    riskMode,
    parameters: { adAccountId },
    approvalRequired: false,
  });

  try {
    // Step 1-3: Analyze (runs rules, pacing, fatigue internally)
    steps[0] = startStep(steps[0]);
    await updateJobStatus(jobId, "collecting_data");
    const analysis = await analyzeActiveAccount({ adAccountId, riskMode });
    steps[0] = completeStep(steps[0]);
    steps[1] = startStep(steps[1]);
    steps[1] = completeStep(steps[1]);
    steps[2] = startStep(steps[2]);
    steps[2] = completeStep(steps[2]);

    // Step 4: Generate recommendations
    steps[3] = startStep(steps[3]);
    await updateJobStatus(jobId, "generating_recommendations");
    const recommendations = generateOptimizationRecommendations(analysis);
    const summary = generateOptimizationSummary(analysis, recommendations);
    steps[3] = completeStep(steps[3]);

    const durationMs = Date.now() - startTime;

    await completeJob(jobId, {
      status: "completed",
      recommendations,
      summary,
      dataSourcesUsed: ["MetaSyncedInsight", "MetaSyncedCampaign", "MetaSyncedAd", "ReconciliationResult"],
      steps,
      warnings: [],
      errors: [],
      durationMs,
    });

    return { ok: true, jobId, analysis, recommendations, summary };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await completeJob(jobId, {
      status: "failed",
      recommendations: [],
      summary: `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      dataSourcesUsed: [],
      steps: steps.map((s) => (s.status === "running" ? failStep(s) : s)),
      warnings: [],
      errors: [err instanceof Error ? err.message : "Optimization scan failed"],
      durationMs,
    });
    return { ok: false, jobId, error: err instanceof Error ? err.message : "Optimization scan failed" };
  }
}
