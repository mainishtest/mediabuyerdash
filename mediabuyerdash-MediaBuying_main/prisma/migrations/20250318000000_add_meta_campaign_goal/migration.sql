-- Add MetaCampaignGoal table for storing internal dashboard goals
-- linked directly to imported Meta campaigns via externalCampaignId.
-- Goals are stored in this app only — never written back to Meta Ads Manager.

CREATE TABLE IF NOT EXISTS "MetaCampaignGoal" (
    "id"                 TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "roasGoalType"       TEXT NOT NULL,
    "roasGoalValue"      DOUBLE PRECISION NOT NULL,
    "cpaGoalType"        TEXT NOT NULL,
    "cpaGoalValue"       DOUBLE PRECISION NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaCampaignGoal_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one goal per campaign
CREATE UNIQUE INDEX IF NOT EXISTS "MetaCampaignGoal_externalCampaignId_key"
    ON "MetaCampaignGoal"("externalCampaignId");

-- Index for fast lookups by campaign id
CREATE INDEX IF NOT EXISTS "MetaCampaignGoal_externalCampaignId_idx"
    ON "MetaCampaignGoal"("externalCampaignId");

-- Foreign key linking to MetaSyncedCampaign
ALTER TABLE "MetaCampaignGoal"
    ADD CONSTRAINT "MetaCampaignGoal_externalCampaignId_fkey"
    FOREIGN KEY ("externalCampaignId")
    REFERENCES "MetaSyncedCampaign"("externalCampaignId")
    ON DELETE CASCADE ON UPDATE CASCADE;
