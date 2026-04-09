-- Video Ad Generator V2: Two-engine architecture migration
-- Run this in Neon SQL Editor

-- 1. Expand VideoAdConcept with v2 input columns
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "brandName" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "marketSophistication" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "keyClaims" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "ctaGoal" TEXT DEFAULT 'purchase';
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "visualStyle" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "referenceAssetUrls" TEXT;
ALTER TABLE "VideoAdConcept" ADD COLUMN IF NOT EXISTS "engineVersion" TEXT NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS "VideoAdConcept_engineVersion_idx" ON "VideoAdConcept"("engineVersion");

-- 2. StrategyRun — immutable record per GPT generation
CREATE TABLE IF NOT EXISTS "StrategyRun" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "conceptId"            TEXT NOT NULL,
  "version"              INTEGER NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'pending',
  "mode"                 TEXT NOT NULL DEFAULT 'storyboard_only',
  "tier"                 TEXT NOT NULL DEFAULT 'premium',
  "model"                TEXT NOT NULL,
  "inputSnapshot"        TEXT NOT NULL,
  "angleSet"             TEXT,
  "hookSet"              TEXT,
  "scriptSet"            TEXT,
  "shotList"             TEXT,
  "onScreenText"         TEXT,
  "ctaVariants"          TEXT,
  "editorNotes"          TEXT,
  "platformAdjustments"  TEXT,
  "promptSnapshots"      TEXT,
  "errorMessage"         TEXT,
  "durationMs"           INTEGER,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"          TIMESTAMP(3),
  CONSTRAINT "StrategyRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StrategyRun" ADD CONSTRAINT "StrategyRun_conceptId_fkey"
  FOREIGN KEY ("conceptId") REFERENCES "VideoAdConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "StrategyRun_conceptId_version_key" ON "StrategyRun"("conceptId", "version");
CREATE INDEX IF NOT EXISTS "StrategyRun_conceptId_idx" ON "StrategyRun"("conceptId");
CREATE INDEX IF NOT EXISTS "StrategyRun_status_idx" ON "StrategyRun"("status");

-- 3. RenderRun — compiled render brief per strategy run
CREATE TABLE IF NOT EXISTS "RenderRun" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "strategyRunId"   TEXT NOT NULL,
  "version"         INTEGER NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "renderBrief"     TEXT,
  "veoJobs"         TEXT,
  "compilerVersion" TEXT NOT NULL,
  "errorMessage"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"     TIMESTAMP(3),
  CONSTRAINT "RenderRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RenderRun" ADD CONSTRAINT "RenderRun_strategyRunId_fkey"
  FOREIGN KEY ("strategyRunId") REFERENCES "StrategyRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "RenderRun_strategyRunId_version_key" ON "RenderRun"("strategyRunId", "version");
CREATE INDEX IF NOT EXISTS "RenderRun_strategyRunId_idx" ON "RenderRun"("strategyRunId");
CREATE INDEX IF NOT EXISTS "RenderRun_status_idx" ON "RenderRun"("status");

-- 4. VideoAsset — generated video clips per scene
CREATE TABLE IF NOT EXISTS "VideoAsset" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "renderRunId"   TEXT NOT NULL,
  "sceneNumber"   INTEGER NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "veoJobId"      TEXT,
  "veoModel"      TEXT,
  "videoUrl"      TEXT,
  "thumbnailUrl"  TEXT,
  "durationMs"    INTEGER,
  "aspectRatio"   TEXT,
  "errorMessage"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"   TIMESTAMP(3),
  CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_renderRunId_fkey"
  FOREIGN KEY ("renderRunId") REFERENCES "RenderRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "VideoAsset_renderRunId_sceneNumber_key" ON "VideoAsset"("renderRunId", "sceneNumber");
CREATE INDEX IF NOT EXISTS "VideoAsset_renderRunId_idx" ON "VideoAsset"("renderRunId");
CREATE INDEX IF NOT EXISTS "VideoAsset_status_idx" ON "VideoAsset"("status");
