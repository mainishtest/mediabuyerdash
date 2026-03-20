-- prisma/migrations/add_creative_outcome_routing.sql
-- Idempotent. Safe to run multiple times.
-- Run in Neon SQL editor or via psql.

CREATE TABLE IF NOT EXISTS "CreativeOutcomeRouteRecord" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "clientAccountId"  TEXT        NOT NULL,
  "testResultId"     TEXT        NOT NULL,

  "routeType"        TEXT        NOT NULL,
  "readinessState"   TEXT        NOT NULL DEFAULT 'pending_action',

  "outcome"          TEXT,
  "confidenceLevel"  TEXT,
  "confidenceScore"  DOUBLE PRECISION,
  "primaryLift"      DOUBLE PRECISION,
  "winningVariant"   TEXT,

  "challengerVariantTitle" TEXT,
  "controlCreativeName"    TEXT,
  "campaignName"           TEXT,
  "primaryMetric"          TEXT,

  "reasonsJson"  TEXT NOT NULL DEFAULT '[]',
  "evidenceJson" TEXT NOT NULL DEFAULT '{}',
  "learningJson" TEXT,

  "nextActionLabel" TEXT NOT NULL,
  "nextActionHint"  TEXT NOT NULL,
  "linkedWorkflow"  TEXT,
  "learningSummary" TEXT,

  "actionedAt" TIMESTAMPTZ,
  "actionedBy" TEXT,
  "actionNote" TEXT,
  "archivedAt" TIMESTAMPTZ,

  "launchPlanId" TEXT,
  "experimentId" TEXT,
  "briefId"      TEXT,
  "variantId"    TEXT,
  "prepItemId"   TEXT,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on testResultId (1:1 with CreativeTestResultRecord)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CreativeOutcomeRouteRecord_testResultId_key'
  ) THEN
    ALTER TABLE "CreativeOutcomeRouteRecord"
      ADD CONSTRAINT "CreativeOutcomeRouteRecord_testResultId_key"
      UNIQUE ("testResultId");
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "CreativeOutcomeRouteRecord_clientAccountId_idx"
  ON "CreativeOutcomeRouteRecord" ("clientAccountId");

CREATE INDEX IF NOT EXISTS "CreativeOutcomeRouteRecord_readinessState_idx"
  ON "CreativeOutcomeRouteRecord" ("readinessState");

CREATE INDEX IF NOT EXISTS "CreativeOutcomeRouteRecord_routeType_idx"
  ON "CreativeOutcomeRouteRecord" ("routeType");

CREATE INDEX IF NOT EXISTS "CreativeOutcomeRouteRecord_testResultId_idx"
  ON "CreativeOutcomeRouteRecord" ("testResultId");
