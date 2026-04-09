// Agent Framework — Job Executor
//
// Orchestrates agent job lifecycle: create → collect data → analyze →
// generate recommendations → persist. Each agent type provides a handler.

import { prisma } from "../db";
import type {
  AgentType,
  AgentJob,
  AgentJobStatus,
  AgentJobStep,
  AgentRecommendation,
  RiskMode,
} from "./types";

// ── Job creation ────────────────────────────────────────────────────────────

export async function createAgentJob(params: {
  agentType: AgentType;
  trigger: "user_prompt" | "scheduled" | "rule_triggered";
  riskMode: RiskMode;
  prompt?: string;
  parameters?: Record<string, unknown>;
  approvalRequired?: boolean;
}): Promise<string> {
  const job = await prisma.agentJob.create({
    data: {
      agentType: params.agentType,
      status: "pending",
      riskMode: params.riskMode,
      trigger: params.trigger,
      prompt: params.prompt ?? null,
      parametersJson: params.parameters ? JSON.stringify(params.parameters) : null,
      approvalRequired: params.approvalRequired ?? false,
    },
  });
  return job.id;
}

// ── Job status updates ──────────────────────────────────────────────────────

export async function updateJobStatus(
  jobId: string,
  status: AgentJobStatus,
  extra?: {
    recommendationsJson?: string;
    draftJson?: string;
    summary?: string;
    dataSourcesUsed?: string[];
    stepsJson?: string;
    warningsJson?: string;
    errorsJson?: string;
    durationMs?: number;
    approvedAt?: Date;
  }
): Promise<void> {
  await prisma.agentJob.update({
    where: { id: jobId },
    data: {
      status,
      ...(extra?.recommendationsJson !== undefined && { recommendationsJson: extra.recommendationsJson }),
      ...(extra?.draftJson !== undefined && { draftJson: extra.draftJson }),
      ...(extra?.summary !== undefined && { summary: extra.summary }),
      ...(extra?.dataSourcesUsed !== undefined && { dataSourcesUsed: JSON.stringify(extra.dataSourcesUsed) }),
      ...(extra?.stepsJson !== undefined && { stepsJson: extra.stepsJson }),
      ...(extra?.warningsJson !== undefined && { warningsJson: extra.warningsJson }),
      ...(extra?.errorsJson !== undefined && { errorsJson: extra.errorsJson }),
      ...(extra?.durationMs !== undefined && { durationMs: extra.durationMs }),
      ...(extra?.approvedAt !== undefined && { approvedAt: extra.approvedAt }),
      ...(status === "completed" || status === "failed" ? { completedAt: new Date() } : {}),
    },
  });
}

// ── Job completion helper ───────────────────────────────────────────────────

export async function completeJob(
  jobId: string,
  result: {
    status: "completed" | "failed" | "awaiting_review";
    recommendations: AgentRecommendation[];
    draft?: Record<string, unknown>;
    summary: string;
    dataSourcesUsed: string[];
    steps: AgentJobStep[];
    warnings: string[];
    errors: string[];
    durationMs: number;
  }
): Promise<void> {
  await updateJobStatus(jobId, result.status, {
    recommendationsJson: JSON.stringify(result.recommendations),
    draftJson: result.draft ? JSON.stringify(result.draft) : undefined,
    summary: result.summary,
    dataSourcesUsed: result.dataSourcesUsed,
    stepsJson: JSON.stringify(result.steps),
    warningsJson: JSON.stringify(result.warnings),
    errorsJson: JSON.stringify(result.errors),
    durationMs: result.durationMs,
  });
}

// ── Job retrieval ───────────────────────────────────────────────────────────

export async function getAgentJob(jobId: string): Promise<AgentJob | null> {
  const row = await prisma.agentJob.findUnique({ where: { id: jobId } });
  if (!row) return null;
  return deserializeJob(row);
}

export async function getRecentJobs(
  agentType?: AgentType,
  limit = 20
): Promise<AgentJob[]> {
  const rows = await prisma.agentJob.findMany({
    where: agentType ? { agentType } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(deserializeJob);
}

// ── Step tracking helper ────────────────────────────────────────────────────

export function createStep(name: string, description: string): AgentJobStep {
  return {
    name,
    status: "pending",
    description,
    startedAt: null,
    completedAt: null,
  };
}

export function startStep(step: AgentJobStep): AgentJobStep {
  return { ...step, status: "running", startedAt: new Date().toISOString() };
}

export function completeStep(step: AgentJobStep): AgentJobStep {
  return { ...step, status: "completed", completedAt: new Date().toISOString() };
}

export function failStep(step: AgentJobStep): AgentJobStep {
  return { ...step, status: "failed", completedAt: new Date().toISOString() };
}

// ── Serialization ───────────────────────────────────────────────────────────

function deserializeJob(row: {
  id: string;
  agentType: string;
  status: string;
  riskMode: string;
  trigger: string;
  prompt: string | null;
  parametersJson: string | null;
  recommendationsJson: string | null;
  draftJson: string | null;
  summary: string | null;
  dataSourcesUsed: string | null;
  stepsJson: string | null;
  warningsJson: string | null;
  errorsJson: string | null;
  approvalRequired: boolean;
  approvedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  completedAt: Date | null;
}): AgentJob {
  return {
    id: row.id,
    agentType: row.agentType as AgentType,
    status: row.status as AgentJobStatus,
    riskMode: row.riskMode as RiskMode,
    trigger: row.trigger as AgentJob["trigger"],
    prompt: row.prompt,
    parameters: safeJsonParse(row.parametersJson, {}),
    recommendations: safeJsonParse(row.recommendationsJson, []),
    draft: safeJsonParse(row.draftJson, null),
    summary: row.summary,
    dataSourcesUsed: safeJsonParse(row.dataSourcesUsed, []),
    stepsCompleted: safeJsonParse(row.stepsJson, []),
    warnings: safeJsonParse(row.warningsJson, []),
    errors: safeJsonParse(row.errorsJson, []),
    approvalRequired: row.approvalRequired,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function safeJsonParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
