-- v7: Add destinationUrl to MetaSyncedCreative
-- Stores the landing page URL extracted from the creative's object_story_spec.
-- Idempotent — safe to re-run.

ALTER TABLE "MetaSyncedCreative" ADD COLUMN IF NOT EXISTS "destinationUrl" TEXT;
