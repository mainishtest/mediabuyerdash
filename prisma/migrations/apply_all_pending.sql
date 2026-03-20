-- =============================================================================
-- apply_all_pending.sql
-- =============================================================================
-- Run this once in your Neon SQL editor (or via psql) to apply every pending
-- schema change in the correct order.  Every statement uses IF NOT EXISTS /
-- DO $$ blocks so it is fully idempotent — safe to run multiple times.
-- =============================================================================


-- ─── 1. ClientAccount: workspaceId + portal columns ──────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ClientAccount' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "ClientAccount" ADD COLUMN "workspaceId" TEXT;
    END IF;

    -- FK for workspaceId (only if Workspace table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Workspace')
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ClientAccount_workspaceId_fkey'
    ) THEN
        ALTER TABLE "ClientAccount"
            ADD CONSTRAINT "ClientAccount_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ClientAccount' AND column_name = 'status'
    ) THEN
        ALTER TABLE "ClientAccount" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ClientAccount' AND column_name = 'brandName'
    ) THEN
        ALTER TABLE "ClientAccount" ADD COLUMN "brandName" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ClientAccount' AND column_name = 'notes'
    ) THEN
        ALTER TABLE "ClientAccount" ADD COLUMN "notes" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ClientAccount' AND column_name = 'clientPortalToken'
    ) THEN
        ALTER TABLE "ClientAccount" ADD COLUMN "clientPortalToken" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ClientAccount' AND column_name = 'clientPortalPasswordHash'
    ) THEN
        ALTER TABLE "ClientAccount" ADD COLUMN "clientPortalPasswordHash" TEXT;
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClientAccount_clientPortalToken_key"
    ON "ClientAccount"("clientPortalToken");


-- ─── 2. ShopifyConnection + ShopifyOrder: workspaceId ────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyConnection' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "ShopifyConnection" ADD COLUMN "workspaceId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "workspaceId" TEXT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "ShopifyConnection_workspaceId_idx"
    ON "ShopifyConnection"("workspaceId");

CREATE INDEX IF NOT EXISTS "ShopifyOrder_workspaceId_orderCreatedAt_idx"
    ON "ShopifyOrder"("workspaceId", "orderCreatedAt");


-- ─── 3. MetaSynced* tables: workspaceId ──────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedCampaign' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedCampaign" ADD COLUMN "workspaceId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedAdSet' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedAdSet" ADD COLUMN "workspaceId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedAd' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedAd" ADD COLUMN "workspaceId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedCreative' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedCreative" ADD COLUMN "workspaceId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedInsight' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedInsight" ADD COLUMN "workspaceId" TEXT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "MetaSyncedCampaign_workspaceId_idx"
    ON "MetaSyncedCampaign"("workspaceId");
CREATE INDEX IF NOT EXISTS "MetaSyncedCampaign_workspaceId_externalAdAccountId_idx"
    ON "MetaSyncedCampaign"("workspaceId", "externalAdAccountId");
CREATE INDEX IF NOT EXISTS "MetaSyncedAdSet_workspaceId_idx"
    ON "MetaSyncedAdSet"("workspaceId");
CREATE INDEX IF NOT EXISTS "MetaSyncedAd_workspaceId_idx"
    ON "MetaSyncedAd"("workspaceId");
CREATE INDEX IF NOT EXISTS "MetaSyncedCreative_workspaceId_idx"
    ON "MetaSyncedCreative"("workspaceId");
CREATE INDEX IF NOT EXISTS "MetaSyncedInsight_workspaceId_dateStart_idx"
    ON "MetaSyncedInsight"("workspaceId", "dateStart");


-- ─── 4. ExperimentRecord: missing columns (if added after initial db push) ───

DO $$
BEGIN
    -- challengerPrepItemId was added in a later phase
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ExperimentRecord' AND column_name = 'challengerPrepItemId'
    ) THEN
        ALTER TABLE "ExperimentRecord" ADD COLUMN "challengerPrepItemId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ExperimentRecord' AND column_name = 'challengerCampaignExternalId'
    ) THEN
        ALTER TABLE "ExperimentRecord" ADD COLUMN "challengerCampaignExternalId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ExperimentRecord' AND column_name = 'controlCampaignExternalId'
    ) THEN
        ALTER TABLE "ExperimentRecord" ADD COLUMN "controlCampaignExternalId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ExperimentRecord' AND column_name = 'externalAdAccountId'
    ) THEN
        ALTER TABLE "ExperimentRecord" ADD COLUMN "externalAdAccountId" TEXT;
    END IF;
END
$$;


-- ─── 5. Phase 8 Part 1: ExperimentLaunchPlanRecord ───────────────────────────

CREATE TABLE IF NOT EXISTS "ExperimentLaunchPlanRecord" (
  "id"                           TEXT NOT NULL PRIMARY KEY,
  "clientAccountId"              TEXT NOT NULL,
  "name"                         TEXT NOT NULL,
  "hypothesis"                   TEXT,
  "objective"                    TEXT,

  "prepItemId"                   TEXT,
  "briefId"                      TEXT,
  "variantId"                    TEXT,
  "recommendationId"             TEXT,

  "readinessState"               TEXT NOT NULL DEFAULT 'draft',

  "controlLabel"                 TEXT NOT NULL DEFAULT 'Control',
  "controlCreativeId"            TEXT,
  "controlCreativeName"          TEXT,
  "controlAdExternalId"          TEXT,
  "controlAdSetExternalId"       TEXT,
  "controlCampaignExternalId"    TEXT,

  "challengerLabel"              TEXT NOT NULL DEFAULT 'Challenger',
  "challengerCreativeName"       TEXT,
  "challengerAdExternalId"       TEXT,
  "challengerAdSetExternalId"    TEXT,
  "challengerCampaignExternalId" TEXT,
  "challengerBriefIntent"        TEXT,
  "challengerBriefDraftType"     TEXT,
  "challengerVariantTitle"       TEXT,
  "challengerVariantType"        TEXT,
  "challengerClientName"         TEXT,
  "challengerCampaignName"       TEXT,

  "targetCampaignId"             TEXT,
  "targetCampaignName"           TEXT,
  "targetCampaignExternalId"     TEXT,
  "targetAdSetId"                TEXT,
  "targetAdSetName"              TEXT,
  "targetAdSetExternalId"        TEXT,
  "externalAdAccountId"          TEXT,
  "comparisonMode"               TEXT NOT NULL DEFAULT 'simultaneous',

  "primaryMetric"                TEXT NOT NULL DEFAULT 'roas_7d',
  "secondaryMetricsJson"         TEXT,
  "guardrailMetricsJson"         TEXT,
  "successThreshold"             REAL NOT NULL DEFAULT 0.10,
  "minSpendPerVariant"           REAL NOT NULL DEFAULT 50.0,
  "minConversionsPerVariant"     INTEGER NOT NULL DEFAULT 5,
  "evaluationWindowDays"         INTEGER NOT NULL DEFAULT 7,

  "launchNotes"                  TEXT,
  "approvedAt"                   TIMESTAMPTZ,
  "approvedBy"                   TEXT,

  "linkedExperimentId"           TEXT,
  "launchedAt"                   TIMESTAMPTZ,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ExperimentLaunchPlanRecord_clientAccountId_idx"
  ON "ExperimentLaunchPlanRecord"("clientAccountId");
CREATE INDEX IF NOT EXISTS "ExperimentLaunchPlanRecord_prepItemId_idx"
  ON "ExperimentLaunchPlanRecord"("prepItemId");
CREATE INDEX IF NOT EXISTS "ExperimentLaunchPlanRecord_readinessState_idx"
  ON "ExperimentLaunchPlanRecord"("readinessState");


-- ─── 6. Phase 8 Part 2: CreativeTestResultRecord + lifecycle link ─────────────

CREATE TABLE IF NOT EXISTS "CreativeTestResultRecord" (
  "id"                        TEXT NOT NULL PRIMARY KEY,
  "clientAccountId"           TEXT NOT NULL,
  "name"                      TEXT NOT NULL,
  "trackingState"             TEXT NOT NULL DEFAULT 'pending_launch',
  "outcome"                   TEXT,

  "launchPlanId"              TEXT,
  "experimentId"              TEXT,
  "prepItemId"                TEXT,
  "briefId"                   TEXT,

  "controlCreativeId"         TEXT,
  "controlCreativeName"       TEXT,
  "controlAdExternalId"       TEXT,
  "challengerVariantTitle"    TEXT,
  "challengerAdExternalId"    TEXT,
  "clientName"                TEXT,
  "campaignName"              TEXT,
  "adSetName"                 TEXT,
  "externalAdAccountId"       TEXT,
  "targetCampaignExternalId"  TEXT,
  "targetAdSetExternalId"     TEXT,

  "primaryMetric"             TEXT NOT NULL DEFAULT 'roas_7d',
  "successThreshold"          REAL NOT NULL DEFAULT 0.10,
  "evaluationWindowDays"      INTEGER NOT NULL DEFAULT 7,
  "minSpendPerVariant"        REAL NOT NULL DEFAULT 50.0,
  "minConversionsPerVariant"  INTEGER NOT NULL DEFAULT 5,

  "controlSnapshotJson"       TEXT,
  "challengerSnapshotJson"    TEXT,

  "primaryMetricDelta"        REAL,
  "primaryMetricLift"         REAL,
  "guardrailBreaches"         TEXT,
  "outcomeReasons"            TEXT,
  "confidence"                REAL,
  "winningVariant"            TEXT,

  "windowStartedAt"           TIMESTAMPTZ,
  "windowEndsAt"              TIMESTAMPTZ,
  "isWindowComplete"          BOOLEAN NOT NULL DEFAULT FALSE,

  "recommendedNextStep"       TEXT,

  "markedForReview"           BOOLEAN NOT NULL DEFAULT FALSE,
  "archivedAt"                TIMESTAMPTZ,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CreativeTestResultRecord_clientAccountId_idx"
  ON "CreativeTestResultRecord"("clientAccountId");
CREATE INDEX IF NOT EXISTS "CreativeTestResultRecord_launchPlanId_idx"
  ON "CreativeTestResultRecord"("launchPlanId");
CREATE INDEX IF NOT EXISTS "CreativeTestResultRecord_experimentId_idx"
  ON "CreativeTestResultRecord"("experimentId");
CREATE INDEX IF NOT EXISTS "CreativeTestResultRecord_trackingState_idx"
  ON "CreativeTestResultRecord"("trackingState");
CREATE INDEX IF NOT EXISTS "CreativeTestResultRecord_outcome_idx"
  ON "CreativeTestResultRecord"("outcome");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CreativeLifecycleResultLinkRecord" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "testResultId"    TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,

  "prepItemId"      TEXT,
  "briefId"         TEXT,
  "variantId"       TEXT,
  "launchPlanId"    TEXT,
  "experimentId"    TEXT,

  "outcome"         TEXT,
  "winningRole"     TEXT,
  "confidence"      REAL,
  "primaryLift"     REAL,

  "attachedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CreativeLifecycleResultLinkRecord_testResultId_fkey"
    FOREIGN KEY ("testResultId")
    REFERENCES "CreativeTestResultRecord"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreativeLifecycleResultLinkRecord_testResultId_idx"
  ON "CreativeLifecycleResultLinkRecord"("testResultId");
CREATE INDEX IF NOT EXISTS "CreativeLifecycleResultLinkRecord_prepItemId_idx"
  ON "CreativeLifecycleResultLinkRecord"("prepItemId");
CREATE INDEX IF NOT EXISTS "CreativeLifecycleResultLinkRecord_clientAccountId_idx"
  ON "CreativeLifecycleResultLinkRecord"("clientAccountId");
