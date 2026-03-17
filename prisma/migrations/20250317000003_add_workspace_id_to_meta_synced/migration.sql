-- Add workspaceId to MetaSynced* tables for multi-workspace scoping.
-- Safe to re-run (IF NOT EXISTS guards).

DO $$
BEGIN
    -- MetaSyncedCampaign.workspaceId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedCampaign' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedCampaign" ADD COLUMN "workspaceId" TEXT;
    END IF;

    -- MetaSyncedAdSet.workspaceId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedAdSet' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedAdSet" ADD COLUMN "workspaceId" TEXT;
    END IF;

    -- MetaSyncedAd.workspaceId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedAd' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedAd" ADD COLUMN "workspaceId" TEXT;
    END IF;

    -- MetaSyncedCreative.workspaceId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedCreative' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedCreative" ADD COLUMN "workspaceId" TEXT;
    END IF;

    -- MetaSyncedInsight.workspaceId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MetaSyncedInsight' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "MetaSyncedInsight" ADD COLUMN "workspaceId" TEXT;
    END IF;
END
$$;

-- Indexes
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
