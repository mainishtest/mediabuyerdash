-- =============================================================================
-- add_daily_brief_record.sql
-- =============================================================================
-- Creates the DailyBriefRecord table for storing daily morning briefs.
-- Without this table, brief generation fails with:
--   "The table public.DailyBriefRecord does not exist in the current database."
-- Fully idempotent — safe to run multiple times.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "DailyBriefRecord" (
    "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspaceId"   TEXT,
    "briefDate"     TEXT NOT NULL,
    "timezone"      TEXT NOT NULL DEFAULT 'America/New_York',
    "deliveryState" TEXT NOT NULL DEFAULT 'pending',
    "briefJson"     TEXT NOT NULL,
    "retryCount"    INTEGER NOT NULL DEFAULT 0,
    "lastError"     TEXT,
    "deliveredAt"   TIMESTAMPTZ,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "DailyBriefRecord_workspaceId_briefDate_idx"
    ON "DailyBriefRecord"("workspaceId", "briefDate");

CREATE INDEX IF NOT EXISTS "DailyBriefRecord_deliveryState_idx"
    ON "DailyBriefRecord"("deliveryState");

-- Unique constraint: one brief per workspace per day
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_workspace_briefdate'
    ) THEN
        ALTER TABLE "DailyBriefRecord"
            ADD CONSTRAINT "unique_workspace_briefdate"
            UNIQUE ("workspaceId", "briefDate");
    END IF;
END
$$;
