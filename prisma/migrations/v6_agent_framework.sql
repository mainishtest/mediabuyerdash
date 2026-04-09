-- v6: Agent Framework
-- Adds AgentJob table for multi-agent operator and rollbackStatus to CampaignLaunch.
-- Idempotent — safe to re-run.

-- ── AgentJob ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AgentJob" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "agentType"           TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'pending',
  "riskMode"            TEXT NOT NULL DEFAULT 'balanced',
  "trigger"             TEXT NOT NULL,
  "prompt"              TEXT,
  "parametersJson"      TEXT,
  "recommendationsJson" TEXT,
  "draftJson"           TEXT,
  "summary"             TEXT,
  "dataSourcesUsed"     TEXT,
  "stepsJson"           TEXT,
  "warningsJson"        TEXT,
  "errorsJson"          TEXT,
  "approvalRequired"    BOOLEAN NOT NULL DEFAULT false,
  "approvedAt"          TIMESTAMPTZ,
  "durationMs"          INTEGER,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt"         TIMESTAMPTZ,

  CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentJob_agentType_idx" ON "AgentJob" ("agentType");
CREATE INDEX IF NOT EXISTS "AgentJob_status_idx" ON "AgentJob" ("status");
CREATE INDEX IF NOT EXISTS "AgentJob_createdAt_idx" ON "AgentJob" ("createdAt");

-- ── CampaignLaunch.rollbackStatus ───────────────────────────────────────────

ALTER TABLE "CampaignLaunch" ADD COLUMN IF NOT EXISTS "rollbackStatus" TEXT NOT NULL DEFAULT 'none';
