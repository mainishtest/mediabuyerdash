-- Migration: add_client_goal_defaults
-- Adds the ClientGoalDefaults table.
-- Run in your Neon SQL console ONCE before deploying.
-- Safe to re-run — uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "ClientGoalDefaults" (
  "id"                   TEXT        NOT NULL PRIMARY KEY,
  "clientAccountId"      TEXT        NOT NULL UNIQUE REFERENCES "ClientAccount" ("id") ON DELETE CASCADE,
  "defaultRoasGoalType"  TEXT        NOT NULL DEFAULT 'high',
  "defaultRoasGoalValue" FLOAT8      NOT NULL,
  "defaultCpaGoalType"   TEXT        NOT NULL DEFAULT 'low',
  "defaultCpaGoalValue"  FLOAT8      NOT NULL,
  "targetRoas"           FLOAT8,
  "targetCpa"            FLOAT8,
  "targetCtr"            FLOAT8,
  "targetCvr"            FLOAT8,
  "maxDailySpend"        FLOAT8,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns if they don't exist (for existing databases)
ALTER TABLE "ClientGoalDefaults" ADD COLUMN IF NOT EXISTS "targetRoas" FLOAT8;
ALTER TABLE "ClientGoalDefaults" ADD COLUMN IF NOT EXISTS "targetCpa" FLOAT8;
ALTER TABLE "ClientGoalDefaults" ADD COLUMN IF NOT EXISTS "targetCtr" FLOAT8;
ALTER TABLE "ClientGoalDefaults" ADD COLUMN IF NOT EXISTS "targetCvr" FLOAT8;
ALTER TABLE "ClientGoalDefaults" ADD COLUMN IF NOT EXISTS "maxDailySpend" FLOAT8;
