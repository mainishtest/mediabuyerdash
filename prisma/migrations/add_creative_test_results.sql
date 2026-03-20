-- prisma/migrations/add_creative_test_results.sql
-- Adds CreativeTestResultRecord and CreativeLifecycleResultLinkRecord tables.
-- Tracks launched creative tests and wires results back to source creative drafts.

CREATE TABLE IF NOT EXISTS "CreativeTestResultRecord" (
  "id"                        TEXT NOT NULL PRIMARY KEY,
  "clientAccountId"           TEXT NOT NULL,
  "name"                      TEXT NOT NULL,
  "trackingState"             TEXT NOT NULL DEFAULT 'pending_launch',
  "outcome"                   TEXT,

  -- Source links
  "launchPlanId"              TEXT,
  "experimentId"              TEXT,
  "prepItemId"                TEXT,
  "briefId"                   TEXT,

  -- Creative context
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

  -- Success criteria
  "primaryMetric"             TEXT NOT NULL DEFAULT 'roas_7d',
  "successThreshold"          REAL NOT NULL DEFAULT 0.10,
  "evaluationWindowDays"      INTEGER NOT NULL DEFAULT 7,
  "minSpendPerVariant"        REAL NOT NULL DEFAULT 50.0,
  "minConversionsPerVariant"  INTEGER NOT NULL DEFAULT 5,

  -- Ingested snapshots
  "controlSnapshotJson"       TEXT,
  "challengerSnapshotJson"    TEXT,

  -- Evaluation outputs
  "primaryMetricDelta"        REAL,
  "primaryMetricLift"         REAL,
  "guardrailBreaches"         TEXT,
  "outcomeReasons"            TEXT,
  "confidence"                REAL,
  "winningVariant"            TEXT,

  -- Evaluation window
  "windowStartedAt"           TIMESTAMPTZ,
  "windowEndsAt"              TIMESTAMPTZ,
  "isWindowComplete"          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Recommended action
  "recommendedNextStep"       TEXT,

  -- Review state
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

  -- Back-links
  "prepItemId"      TEXT,
  "briefId"         TEXT,
  "variantId"       TEXT,
  "launchPlanId"    TEXT,
  "experimentId"    TEXT,

  -- Outcome snapshot
  "outcome"         TEXT,
  "winningRole"     TEXT,
  "confidence"      REAL,
  "primaryLift"     REAL,

  "attachedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY ("testResultId") REFERENCES "CreativeTestResultRecord"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreativeLifecycleResultLinkRecord_testResultId_idx"
  ON "CreativeLifecycleResultLinkRecord"("testResultId");
CREATE INDEX IF NOT EXISTS "CreativeLifecycleResultLinkRecord_prepItemId_idx"
  ON "CreativeLifecycleResultLinkRecord"("prepItemId");
CREATE INDEX IF NOT EXISTS "CreativeLifecycleResultLinkRecord_clientAccountId_idx"
  ON "CreativeLifecycleResultLinkRecord"("clientAccountId");
