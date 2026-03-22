-- =============================================================================
-- add_source_copy_columns.sql
-- =============================================================================
-- Adds sourceCopy and sourceCallToAction columns to UploadedCreativeImage.
-- These allow users to attach ad copy alongside uploaded images so both
-- can be used as context for variation generation.
-- Fully idempotent — safe to run multiple times.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'UploadedCreativeImage' AND column_name = 'sourceCopy'
    ) THEN
        ALTER TABLE "UploadedCreativeImage" ADD COLUMN "sourceCopy" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'UploadedCreativeImage' AND column_name = 'sourceCallToAction'
    ) THEN
        ALTER TABLE "UploadedCreativeImage" ADD COLUMN "sourceCallToAction" TEXT;
    END IF;
END
$$;
