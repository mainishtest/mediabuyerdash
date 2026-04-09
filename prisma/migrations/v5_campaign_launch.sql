-- Campaign Launcher V5: Launch tracking
-- Run this in Neon SQL Editor

CREATE TABLE IF NOT EXISTS "CampaignLaunch" (
    "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "status"                TEXT NOT NULL DEFAULT 'draft',
    "externalAdAccountId"   TEXT,
    "externalCampaignId"    TEXT,
    "externalAdSetId"       TEXT,
    "externalCreativeId"    TEXT,
    "externalAdId"          TEXT,
    "creativeAssetId"       TEXT,
    "conceptId"             TEXT,
    "campaignName"          TEXT NOT NULL,
    "adSetName"             TEXT NOT NULL,
    "adName"                TEXT NOT NULL,
    "objective"             TEXT NOT NULL,
    "dailyBudget"           DOUBLE PRECISION NOT NULL,
    "destinationUrl"        TEXT,
    "primaryText"           TEXT,
    "headline"              TEXT,
    "ctaType"               TEXT,
    "pageId"                TEXT,
    "pixelId"               TEXT,
    "conversionEvent"       TEXT,
    "targetingSnapshot"     TEXT,
    "launchPayload"         TEXT,
    "launchResult"          TEXT,
    "errorMessages"         TEXT,
    "launchedAt"            TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignLaunch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CampaignLaunch_status_idx" ON "CampaignLaunch"("status");
CREATE INDEX IF NOT EXISTS "CampaignLaunch_createdAt_idx" ON "CampaignLaunch"("createdAt");
CREATE INDEX IF NOT EXISTS "CampaignLaunch_externalAdAccountId_idx" ON "CampaignLaunch"("externalAdAccountId");
