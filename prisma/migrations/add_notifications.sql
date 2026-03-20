-- Migration: add_notifications
-- Adds NotificationPreference and NotificationLog tables.
-- Run in your Neon SQL console ONCE before deploying.
-- Safe to re-run — uses IF NOT EXISTS.

-- Per-user email notification preferences.
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "userId"            TEXT        NOT NULL UNIQUE REFERENCES "User" ("id") ON DELETE CASCADE,
  "emailEnabled"      BOOLEAN     NOT NULL DEFAULT true,
  "immediateAlerts"   BOOLEAN     NOT NULL DEFAULT true,
  "dailyDigest"       BOOLEAN     NOT NULL DEFAULT true,
  "alertHighPriority" BOOLEAN     NOT NULL DEFAULT true,
  "alertSyncFailure"  BOOLEAN     NOT NULL DEFAULT true,
  "alertPacing"       BOOLEAN     NOT NULL DEFAULT true,
  "alertBelowGoal"    BOOLEAN     NOT NULL DEFAULT true,
  "alertMissingGoals" BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log for every notification delivery attempt.
CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "userId"           TEXT        NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE,
  "workspaceId"      TEXT,
  "channel"          TEXT        NOT NULL DEFAULT 'email',
  "eventType"        TEXT        NOT NULL,
  "priority"         TEXT        NOT NULL DEFAULT 'medium',
  "subject"          TEXT        NOT NULL,
  "deduplicationKey" TEXT,
  "status"           TEXT        NOT NULL DEFAULT 'pending',
  "errorMessage"     TEXT,
  "sentAt"           TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "NotificationLog_userId_idx"
  ON "NotificationLog" ("userId");

CREATE INDEX IF NOT EXISTS "NotificationLog_workspaceId_idx"
  ON "NotificationLog" ("workspaceId");

CREATE INDEX IF NOT EXISTS "NotificationLog_deduplicationKey_idx"
  ON "NotificationLog" ("deduplicationKey");
