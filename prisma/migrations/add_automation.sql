-- Migration: add_automation
-- Run this in the Neon console (or any PostgreSQL client) to create the
-- AutomationRule and ProposedAutomationAction tables.

CREATE TABLE IF NOT EXISTS "AutomationRule" (
  "id"          TEXT        NOT NULL PRIMARY KEY,
  "workspaceId" TEXT,
  "name"        TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "ruleType"    TEXT        NOT NULL,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "priority"    TEXT        NOT NULL DEFAULT 'medium',
  "conditions"  TEXT        NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AutomationRule_workspaceId_idx"
  ON "AutomationRule" ("workspaceId");

CREATE TABLE IF NOT EXISTS "ProposedAutomationAction" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "workspaceId"      TEXT,
  "clientAccountId"  TEXT        NOT NULL
    REFERENCES "ClientAccount" ("id") ON DELETE CASCADE,
  "clientName"       TEXT        NOT NULL,
  "automationRuleId" TEXT
    REFERENCES "AutomationRule" ("id"),
  "actionType"       TEXT        NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'proposed',
  "priority"         TEXT        NOT NULL DEFAULT 'medium',
  "entityType"       TEXT        NOT NULL,
  "entityId"         TEXT        NOT NULL,
  "entityName"       TEXT        NOT NULL,
  "rationale"        TEXT        NOT NULL,
  "supportingData"   TEXT        NOT NULL DEFAULT '{}',
  "deduplicationKey" TEXT        NOT NULL,
  "proposedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt"        TIMESTAMPTZ,
  "approvedAt"       TIMESTAMPTZ,
  "rejectedAt"       TIMESTAMPTZ,
  "rejectionReason"  TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ProposedAutomationAction_workspaceId_idx"
  ON "ProposedAutomationAction" ("workspaceId");

CREATE INDEX IF NOT EXISTS "ProposedAutomationAction_clientAccountId_idx"
  ON "ProposedAutomationAction" ("clientAccountId");

CREATE INDEX IF NOT EXISTS "ProposedAutomationAction_deduplicationKey_idx"
  ON "ProposedAutomationAction" ("deduplicationKey");

CREATE INDEX IF NOT EXISTS "ProposedAutomationAction_status_idx"
  ON "ProposedAutomationAction" ("status");
