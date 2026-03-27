-- Migration: Add AlertEvent table
-- Run this in the Neon SQL console before deploying.

CREATE TABLE IF NOT EXISTS "AlertEvent" (
  "id"                TEXT          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "workspaceId"       TEXT,
  "clientAccountId"   TEXT          NOT NULL,
  "clientName"        TEXT          NOT NULL,
  "alertType"         TEXT          NOT NULL,
  "severity"          TEXT          NOT NULL,
  "status"            TEXT          NOT NULL DEFAULT 'open',
  "source"            TEXT          NOT NULL,
  "entityType"        TEXT          NOT NULL,
  "entityId"          TEXT          NOT NULL,
  "entityName"        TEXT          NOT NULL,
  "summary"           TEXT          NOT NULL,
  "supportingMetrics" TEXT          NOT NULL DEFAULT '{}',
  "deduplicationKey"  TEXT          NOT NULL,
  "detectedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt"    TIMESTAMP(3),
  "resolvedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlertEvent_clientAccountId_fkey"
    FOREIGN KEY ("clientAccountId")
    REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AlertEvent_clientAccountId_status_idx"
  ON "AlertEvent" ("clientAccountId", "status");

CREATE INDEX IF NOT EXISTS "AlertEvent_status_severity_idx"
  ON "AlertEvent" ("status", "severity");

CREATE INDEX IF NOT EXISTS "AlertEvent_workspaceId_status_idx"
  ON "AlertEvent" ("workspaceId", "status");

CREATE INDEX IF NOT EXISTS "AlertEvent_deduplicationKey_idx"
  ON "AlertEvent" ("deduplicationKey");
