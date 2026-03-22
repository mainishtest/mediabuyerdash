-- =============================================================================
-- add_workspace_onboarding_columns.sql
-- =============================================================================
-- Adds missing Workspace profile columns and OnboardingState table.
-- These were added to the Prisma schema but never migrated.
-- Without them, login fails because Prisma tries to SELECT all Workspace
-- columns during auth (include: { workspace: true }).
-- Fully idempotent — safe to run multiple times.
-- =============================================================================

-- ─── 1. Workspace: business profile columns ────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Workspace' AND column_name = 'brandName'
    ) THEN
        ALTER TABLE "Workspace" ADD COLUMN "brandName" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Workspace' AND column_name = 'industry'
    ) THEN
        ALTER TABLE "Workspace" ADD COLUMN "industry" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Workspace' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE "Workspace" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/New_York';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Workspace' AND column_name = 'website'
    ) THEN
        ALTER TABLE "Workspace" ADD COLUMN "website" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Workspace' AND column_name = 'monthlyAdSpend'
    ) THEN
        ALTER TABLE "Workspace" ADD COLUMN "monthlyAdSpend" TEXT;
    END IF;
END
$$;


-- ─── 2. OnboardingState table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OnboardingState" (
    "id"                           TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspaceId"                  TEXT NOT NULL,
    "currentStep"                  TEXT NOT NULL DEFAULT 'create_workspace',
    "createWorkspaceDone"          BOOLEAN NOT NULL DEFAULT FALSE,
    "businessDetailsDone"          BOOLEAN NOT NULL DEFAULT FALSE,
    "accountDefaultsDone"          BOOLEAN NOT NULL DEFAULT FALSE,
    "connectMetaPlaceholderDone"   BOOLEAN NOT NULL DEFAULT FALSE,
    "connectShopifyPlaceholderDone" BOOLEAN NOT NULL DEFAULT FALSE,
    "reviewSetupDone"              BOOLEAN NOT NULL DEFAULT FALSE,
    "draftFormData"                TEXT,
    "completedAt"                  TIMESTAMPTZ,
    "lastActiveAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt"                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "OnboardingState_workspaceId_fkey"
        FOREIGN KEY ("workspaceId")
        REFERENCES "Workspace"("id")
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingState_workspaceId_key"
    ON "OnboardingState"("workspaceId");
