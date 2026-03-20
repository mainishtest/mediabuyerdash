-- Migration: add_auto_execution
-- Run this in the Neon SQL console or any PostgreSQL client.
-- Adds AutoExecutionSettings and AutoExecutionLog tables for the
-- guarded auto-execution foundation.

-- Per-client opt-in settings (off by default).
CREATE TABLE IF NOT EXISTS "AutoExecutionSettings" (
  "id"                 TEXT        NOT NULL PRIMARY KEY,
  "clientAccountId"    TEXT        NOT NULL UNIQUE,
  "workspaceId"        TEXT,
  "enabled"            BOOLEAN     NOT NULL DEFAULT FALSE,
  "allowRunSync"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "allowPauseCampaign" BOOLEAN     NOT NULL DEFAULT FALSE,
  "maxDailyExecutions" INTEGER     NOT NULL DEFAULT 5,
  "maxSpendThreshold"  DOUBLE PRECISION NOT NULL DEFAULT 500,
  "minRoasThreshold"   DOUBLE PRECISION NOT NULL DEFAULT 0.4,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutoExecutionSettings_clientAccountId_fkey"
    FOREIGN KEY ("clientAccountId")
    REFERENCES "ClientAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AutoExecutionSettings_workspaceId_idx"
  ON "AutoExecutionSettings"("workspaceId");

-- Audit log for every auto-execution attempt.
CREATE TABLE IF NOT EXISTS "AutoExecutionLog" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "workspaceId"     TEXT,
  "clientAccountId" TEXT,
  "actionType"      TEXT         NOT NULL,
  "entityType"      TEXT         NOT NULL,
  "entityId"        TEXT         NOT NULL,
  "entityName"      TEXT         NOT NULL,
  "status"          TEXT         NOT NULL,
  "guardrailJson"   TEXT         NOT NULL DEFAULT '[]',
  "decision"        TEXT         NOT NULL,
  "decisionReason"  TEXT         NOT NULL,
  "durationMs"      INTEGER,
  "errorMessage"    TEXT,
  "executedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AutoExecutionLog_workspaceId_idx"
  ON "AutoExecutionLog"("workspaceId");

CREATE INDEX IF NOT EXISTS "AutoExecutionLog_clientAccountId_executedAt_idx"
  ON "AutoExecutionLog"("clientAccountId", "executedAt");

CREATE INDEX IF NOT EXISTS "AutoExecutionLog_status_idx"
  ON "AutoExecutionLog"("status");
