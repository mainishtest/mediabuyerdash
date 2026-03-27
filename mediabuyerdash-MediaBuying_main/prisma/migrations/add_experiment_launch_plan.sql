-- prisma/migrations/add_experiment_launch_plan.sql
-- Adds the ExperimentLaunchPlanRecord table.
-- Bridges approved creative drafts into structured experiment launch plans.
-- Plain-string references used (no FK) to minimise migration surface.

CREATE TABLE IF NOT EXISTS "ExperimentLaunchPlanRecord" (
  "id"                         TEXT NOT NULL PRIMARY KEY,
  "clientAccountId"            TEXT NOT NULL,
  "name"                       TEXT NOT NULL,
  "hypothesis"                 TEXT,
  "objective"                  TEXT,

  -- Source references
  "prepItemId"                 TEXT,
  "briefId"                    TEXT,
  "variantId"                  TEXT,
  "recommendationId"           TEXT,

  -- Readiness state
  "readinessState"             TEXT NOT NULL DEFAULT 'draft',

  -- Control creative
  "controlLabel"               TEXT NOT NULL DEFAULT 'Control',
  "controlCreativeId"          TEXT,
  "controlCreativeName"        TEXT,
  "controlAdExternalId"        TEXT,
  "controlAdSetExternalId"     TEXT,
  "controlCampaignExternalId"  TEXT,

  -- Challenger (from publish-prep)
  "challengerLabel"            TEXT NOT NULL DEFAULT 'Challenger',
  "challengerCreativeName"     TEXT,
  "challengerAdExternalId"     TEXT,
  "challengerAdSetExternalId"  TEXT,
  "challengerCampaignExternalId" TEXT,
  "challengerBriefIntent"      TEXT,
  "challengerBriefDraftType"   TEXT,
  "challengerVariantTitle"     TEXT,
  "challengerVariantType"      TEXT,
  "challengerClientName"       TEXT,
  "challengerCampaignName"     TEXT,

  -- Target mapping
  "targetCampaignId"           TEXT,
  "targetCampaignName"         TEXT,
  "targetCampaignExternalId"   TEXT,
  "targetAdSetId"              TEXT,
  "targetAdSetName"            TEXT,
  "targetAdSetExternalId"      TEXT,
  "externalAdAccountId"        TEXT,
  "comparisonMode"             TEXT NOT NULL DEFAULT 'simultaneous',

  -- Success criteria
  "primaryMetric"              TEXT NOT NULL DEFAULT 'roas_7d',
  "secondaryMetricsJson"       TEXT,
  "guardrailMetricsJson"       TEXT,
  "successThreshold"           REAL NOT NULL DEFAULT 0.10,
  "minSpendPerVariant"         REAL NOT NULL DEFAULT 50.0,
  "minConversionsPerVariant"   INTEGER NOT NULL DEFAULT 5,
  "evaluationWindowDays"       INTEGER NOT NULL DEFAULT 7,

  -- Notes and approval
  "launchNotes"                TEXT,
  "approvedAt"                 TIMESTAMPTZ,
  "approvedBy"                 TEXT,

  -- Link to ExperimentRecord when launched
  "linkedExperimentId"         TEXT,
  "launchedAt"                 TIMESTAMPTZ,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ExperimentLaunchPlanRecord_clientAccountId_idx"
  ON "ExperimentLaunchPlanRecord"("clientAccountId");

CREATE INDEX IF NOT EXISTS "ExperimentLaunchPlanRecord_prepItemId_idx"
  ON "ExperimentLaunchPlanRecord"("prepItemId");

CREATE INDEX IF NOT EXISTS "ExperimentLaunchPlanRecord_readinessState_idx"
  ON "ExperimentLaunchPlanRecord"("readinessState");
