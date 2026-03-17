-- Add auth tables: User, Workspace, WorkspaceMembership, PasswordResetToken
-- PostgreSQL syntax. Run this in your Neon SQL editor if tables are missing.

CREATE TABLE IF NOT EXISTS "User" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "name"         TEXT,
    "passwordHash" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Workspace" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "WorkspaceMembership" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role"        TEXT NOT NULL DEFAULT 'owner',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceMembership_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMembership_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMembership_userId_workspaceId_key"
    ON "WorkspaceMembership"("userId", "workspaceId");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordResetToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- ─────────────────────────────────────────────────────────────────────────────
-- ClientAccount.workspaceId FK (add if the column exists but FK is missing)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    -- Add workspaceId column if it doesn't exist yet
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ClientAccount' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "ClientAccount" ADD COLUMN "workspaceId" TEXT;
    END IF;

    -- Add FK if it doesn't exist yet
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ClientAccount_workspaceId_fkey'
    ) THEN
        ALTER TABLE "ClientAccount"
            ADD CONSTRAINT "ClientAccount_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
