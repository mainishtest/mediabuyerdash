-- Video Ad Generator V4: Creative + Campaign OS
-- Run this in Neon SQL Editor
-- Adds: CreativeAsset table, AIProvider table, Ad.creativeAssetId column

-- 1. CreativeAsset — standalone, source-agnostic creative assets
CREATE TABLE IF NOT EXISTS "CreativeAsset" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name"            TEXT NOT NULL,
    "type"            TEXT NOT NULL,
    "sourceType"      TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'draft',
    "conceptId"       TEXT,
    "renderRunId"     TEXT,
    "videoAssetId"    TEXT,
    "provider"        TEXT,
    "providerJobId"   TEXT,
    "generationMeta"  TEXT,
    "url"             TEXT,
    "thumbnailUrl"    TEXT,
    "mimeType"        TEXT,
    "fileSizeBytes"   INTEGER,
    "durationMs"      INTEGER,
    "width"           INTEGER,
    "height"          INTEGER,
    "aspectRatio"     TEXT,
    "headline"        TEXT,
    "body"            TEXT,
    "callToAction"    TEXT,
    "tags"            TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreativeAsset_conceptId_idx" ON "CreativeAsset"("conceptId");
CREATE INDEX IF NOT EXISTS "CreativeAsset_type_idx" ON "CreativeAsset"("type");
CREATE INDEX IF NOT EXISTS "CreativeAsset_sourceType_idx" ON "CreativeAsset"("sourceType");
CREATE INDEX IF NOT EXISTS "CreativeAsset_status_idx" ON "CreativeAsset"("status");
CREATE INDEX IF NOT EXISTS "CreativeAsset_createdAt_idx" ON "CreativeAsset"("createdAt");

-- FK: CreativeAsset.conceptId -> VideoAdConcept.id
ALTER TABLE "CreativeAsset" DROP CONSTRAINT IF EXISTS "CreativeAsset_conceptId_fkey";
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_conceptId_fkey"
    FOREIGN KEY ("conceptId") REFERENCES "VideoAdConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. AIProvider — provider registry
CREATE TABLE IF NOT EXISTS "AIProvider" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "provider"      TEXT NOT NULL,
    "displayName"   TEXT NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT false,
    "capabilities"  TEXT NOT NULL,
    "apiKeyEnvVar"  TEXT NOT NULL,
    "defaultModel"  TEXT,
    "config"        TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AIProvider_provider_key" ON "AIProvider"("provider");

-- 3. Ad.creativeAssetId — bridge ads to creative assets
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "creativeAssetId" TEXT;

ALTER TABLE "Ad" DROP CONSTRAINT IF EXISTS "Ad_creativeAssetId_fkey";
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_creativeAssetId_fkey"
    FOREIGN KEY ("creativeAssetId") REFERENCES "CreativeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Seed default providers
INSERT INTO "AIProvider" ("id", "provider", "displayName", "isActive", "capabilities", "apiKeyEnvVar", "defaultModel")
VALUES
    (gen_random_uuid()::text, 'anthropic',  'Anthropic Claude',     false, '["text_generation"]',                          'ANTHROPIC_API_KEY',  'claude-sonnet-4-20250514'),
    (gen_random_uuid()::text, 'openai',     'OpenAI',               false, '["text_generation","image_generation"]',        'OPENAI_API_KEY',     'gpt-4.1'),
    (gen_random_uuid()::text, 'google',     'Google (Veo / Gemini)', false, '["text_generation","video_generation"]',       'GOOGLE_AI_API_KEY',  'veo-3.1'),
    (gen_random_uuid()::text, 'stability',  'Stability AI',         false, '["image_generation"]',                         'STABILITY_API_KEY',  'sd3.5-large'),
    (gen_random_uuid()::text, 'elevenlabs', 'ElevenLabs',           false, '["voice_generation"]',                         'ELEVENLABS_API_KEY', 'eleven_multilingual_v2')
ON CONFLICT ("provider") DO NOTHING;
