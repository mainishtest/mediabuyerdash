-- AlterTable
ALTER TABLE "ClientAccount" ADD COLUMN IF NOT EXISTS "clientPortalToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClientAccount_clientPortalToken_key" ON "ClientAccount"("clientPortalToken");
