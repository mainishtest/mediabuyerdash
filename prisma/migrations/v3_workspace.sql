-- Video Ad Generator V3: Creative workspace metadata
-- Run this in Neon SQL Editor

ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "favoriteHookIndex" INTEGER;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "favoriteCtaIndex" INTEGER;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "winningTags" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "editorHandoffNotes" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "creatorHandoffNotes" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "approvedStructure" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "duplicatedFromId" TEXT;
