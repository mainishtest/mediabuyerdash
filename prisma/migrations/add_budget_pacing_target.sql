-- Migration: add_budget_pacing_target
-- Adds the BudgetPacingTarget table for monthly/daily spend targets.
-- Run in your Neon SQL console ONCE before deploying.
-- Safe to re-run — uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "BudgetPacingTarget" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "clientAccountId" TEXT        NOT NULL REFERENCES "ClientAccount" ("id") ON DELETE CASCADE,
  "campaignId"      TEXT,       -- null = client-level target
  "monthlyBudget"   FLOAT8      NOT NULL,
  "dailyBudget"     FLOAT8,     -- null = implied from monthly / days in month
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "BudgetPacingTarget_clientAccountId_idx"
  ON "BudgetPacingTarget" ("clientAccountId");

CREATE INDEX IF NOT EXISTS "BudgetPacingTarget_clientAccountId_campaignId_idx"
  ON "BudgetPacingTarget" ("clientAccountId", "campaignId");
