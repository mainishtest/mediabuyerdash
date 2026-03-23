-- Add Test Launch Workflow tables
-- LaunchDraft: packages approved creative variants into launch-ready test drafts
-- LaunchDraftVariant: individual creative combinations within a draft

CREATE TABLE "LaunchDraft" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "draftName"       TEXT NOT NULL,
    "clientAccountId" TEXT,
    "campaignId"      TEXT NOT NULL,
    "adSetId"         TEXT,
    "baseAdId"        TEXT NOT NULL,
    "baseAdName"      TEXT NOT NULL,
    "objectiveMetric" TEXT,
    "source"          TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'draft',
    "createdAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP NOT NULL
);

CREATE TABLE "LaunchDraftVariant" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "launchDraftId"       TEXT NOT NULL,
    "copyVariationId"     TEXT,
    "imageVariationId"    TEXT,
    "variantName"         TEXT NOT NULL,
    "hook"                TEXT,
    "body"                TEXT,
    "callToAction"        TEXT,
    "imageConceptTitle"   TEXT,
    "imageConceptSummary" TEXT,
    "selectedForLaunch"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaunchDraftVariant_launchDraftId_fkey"
        FOREIGN KEY ("launchDraftId")
        REFERENCES "LaunchDraft" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
