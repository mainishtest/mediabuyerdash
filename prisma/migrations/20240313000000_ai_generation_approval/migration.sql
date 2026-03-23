-- CreateTable
CREATE TABLE "AIGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP,
    "errorMessage" TEXT,
    "responseSnapshot" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "CreativeApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvedAt" TIMESTAMP,
    "rejectedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "CreativeApproval_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AIGenerationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CreativeApproval_jobId_variationId_key" ON "CreativeApproval"("jobId", "variationId");
