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
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
