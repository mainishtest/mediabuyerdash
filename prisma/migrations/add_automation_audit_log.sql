-- Migration: add_automation_audit_log
-- Adds the AutomationAuditLog table.
-- Bridged entries from AutoExecutionLog and ProposedAutomationAction provide
-- backward coverage. Native entries are written via lib/auditLog/persist.ts.

CREATE TABLE IF NOT EXISTS "AutomationAuditLog" (
  "id"                    TEXT    NOT NULL PRIMARY KEY,
  "workspaceId"           TEXT,
  "clientAccountId"       TEXT,
  "clientName"            TEXT,

  -- Event classification
  "eventType"             TEXT    NOT NULL,
  "actionType"            TEXT    NOT NULL,

  -- Nested objects stored as JSON blobs
  "scopeJson"             TEXT    NOT NULL DEFAULT '{}',
  "actorJson"             TEXT    NOT NULL DEFAULT '{}',
  "approvalJson"          TEXT,
  "executionJson"         TEXT,
  "blockJson"             TEXT,
  "rollbackJson"          TEXT    NOT NULL DEFAULT '{}',

  -- Policy decision (flat fields for fast display)
  "policyDecision"        TEXT,
  "policyReason"          TEXT,

  -- Cross-navigation links
  "relatedActionId"       TEXT,
  "relatedExecutionLogId" TEXT,

  "notes"                 TEXT,
  "occurredAt"            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AutomationAuditLog_workspaceId_idx"
  ON "AutomationAuditLog" ("workspaceId");

CREATE INDEX IF NOT EXISTS "AutomationAuditLog_clientAccountId_occurredAt_idx"
  ON "AutomationAuditLog" ("clientAccountId", "occurredAt");

CREATE INDEX IF NOT EXISTS "AutomationAuditLog_eventType_idx"
  ON "AutomationAuditLog" ("eventType");

CREATE INDEX IF NOT EXISTS "AutomationAuditLog_actionType_idx"
  ON "AutomationAuditLog" ("actionType");

CREATE INDEX IF NOT EXISTS "AutomationAuditLog_relatedActionId_idx"
  ON "AutomationAuditLog" ("relatedActionId");
