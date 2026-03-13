-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientAccountId" TEXT,
    "campaignId" TEXT NOT NULL,
    "adSetId" TEXT,
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "GenerationPromptSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "renderedPrompt" TEXT NOT NULL,
    "contextSnapshotJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationPromptSnapshot_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationProviderRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestPayloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationProviderRequest_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationProviderResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "responsePayloadJson" TEXT NOT NULL,
    "executionStatus" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationProviderResponse_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedCopyVariation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneratedCopyVariation_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedImageVariation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "conceptSummary" TEXT NOT NULL,
    "visualChanges" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneratedImageVariation_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationApprovalDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "variationType" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationApprovalDecision_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SelectedCreativeVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationRunId" TEXT NOT NULL,
    "variationType" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "selectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SelectedCreativeVariant_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPromptSnapshot_generationRunId_key" ON "GenerationPromptSnapshot"("generationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationProviderRequest_generationRunId_key" ON "GenerationProviderRequest"("generationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationProviderResponse_generationRunId_key" ON "GenerationProviderResponse"("generationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "SelectedCreativeVariant_generationRunId_variationType_key" ON "SelectedCreativeVariant"("generationRunId", "variationType");
