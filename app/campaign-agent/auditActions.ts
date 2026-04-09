"use server";

// Audit Agent — Server Actions

import type { AuditResult } from "../../lib/agentFramework/types";
import { runFullAudit } from "../../lib/auditAgent/healthScore";
import {
  createAgentJob,
  updateJobStatus,
  completeJob,
  createStep,
  startStep,
  completeStep,
  failStep,
} from "../../lib/agentFramework/executor";

export interface AuditActionResult {
  ok: boolean;
  jobId: string;
  result?: AuditResult;
  error?: string;
}

export async function runAccountAuditAction(
  adAccountId: string
): Promise<AuditActionResult> {
  const startTime = Date.now();
  const steps = [
    createStep("structure_checks", "Run account structure checks"),
    createStep("spend_checks", "Run spend efficiency checks"),
    createStep("compute_score", "Compute health score"),
  ];

  const jobId = await createAgentJob({
    agentType: "audit",
    trigger: "user_prompt",
    riskMode: "balanced",
    parameters: { adAccountId },
    approvalRequired: false,
  });

  try {
    steps[0] = startStep(steps[0]);
    await updateJobStatus(jobId, "analyzing");

    const result = await runFullAudit(adAccountId);

    steps[0] = completeStep(steps[0]);
    steps[1] = startStep(steps[1]);
    steps[1] = completeStep(steps[1]);
    steps[2] = startStep(steps[2]);
    steps[2] = completeStep(steps[2]);

    const durationMs = Date.now() - startTime;

    // Convert audit checks to agent recommendations format for storage
    const recommendations = result.checks
      .filter((c) => c.status !== "pass")
      .map((c, i) => ({
        id: `audit_${Date.now()}_${i}`,
        agentType: "audit" as const,
        category: c.category as "general",
        title: c.name,
        description: c.message,
        confidence: {
          level: "high" as const,
          reasoning: "Based on current synced account data",
          dataPoints: 1,
          lookbackDays: 7,
        },
        assumptions: [],
        supportingData: c.details,
        suggestedAction: c.status === "fail" ? "Fix immediately" : "Review and address",
        impact: c.severity === "critical" ? "high" as const : "medium" as const,
        requiresApproval: false,
      }));

    await completeJob(jobId, {
      status: "completed",
      recommendations,
      draft: {
        healthScore: result.healthScore,
        checks: result.checks,
      },
      summary: result.summary,
      dataSourcesUsed: ["MetaSyncedCampaign", "MetaSyncedAdSet", "MetaSyncedAd", "MetaSyncedInsight", "CampaignGoal", "ReconciliationResult"],
      steps,
      warnings: result.checks.filter((c) => c.status === "warn").map((c) => c.message),
      errors: [],
      durationMs,
    });

    return { ok: true, jobId, result };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await completeJob(jobId, {
      status: "failed",
      recommendations: [],
      summary: `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      dataSourcesUsed: [],
      steps: steps.map((s) => (s.status === "running" ? failStep(s) : s)),
      warnings: [],
      errors: [err instanceof Error ? err.message : "Audit failed"],
      durationMs,
    });
    return { ok: false, jobId, error: err instanceof Error ? err.message : "Audit failed" };
  }
}
