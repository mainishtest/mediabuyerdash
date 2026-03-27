-- Creative Lab: UploadedCreativeImage, UploadedCreativeAnalysis, GeneratedImageIterationConcept
-- PostgreSQL. Safe to re-run (IF NOT EXISTS throughout).

CREATE TABLE IF NOT EXISTS "UploadedCreativeImage" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT,
    "clientAccountId" TEXT,
    "fileName"        TEXT NOT NULL,
    "mimeType"        TEXT NOT NULL,
    "fileSize"        INTEGER NOT NULL,
    "storagePath"     TEXT NOT NULL,
    "uploadedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedCreativeImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UploadedCreativeImage_workspaceId_idx"
    ON "UploadedCreativeImage"("workspaceId");
CREATE INDEX IF NOT EXISTS "UploadedCreativeImage_clientAccountId_idx"
    ON "UploadedCreativeImage"("clientAccountId");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "UploadedCreativeAnalysis" (
    "id"                             TEXT NOT NULL,
    "uploadedCreativeImageId"        TEXT NOT NULL,
    "analysisStatus"                 TEXT NOT NULL DEFAULT 'pending',
    "analysisEngine"                 TEXT NOT NULL DEFAULT 'mock_v1',
    "visualHeadline"                 TEXT,
    "detectedStyle"                  TEXT,
    "dominantMessage"                TEXT,
    "visualTheme"                    TEXT,
    "clarityScore"                   INTEGER,
    "attentionScore"                 INTEGER,
    "directResponseObservationsJson" TEXT,
    "createdAt"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedCreativeAnalysis_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UploadedCreativeAnalysis_uploadedCreativeImageId_fkey"
        FOREIGN KEY ("uploadedCreativeImageId")
        REFERENCES "UploadedCreativeImage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadedCreativeAnalysis_uploadedCreativeImageId_key"
    ON "UploadedCreativeAnalysis"("uploadedCreativeImageId");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GeneratedImageIterationConcept" (
    "id"                      TEXT NOT NULL,
    "uploadedCreativeImageId" TEXT NOT NULL,
    "title"                   TEXT NOT NULL,
    "conceptSummary"          TEXT NOT NULL,
    "visualChanges"           TEXT NOT NULL,
    "goal"                    TEXT NOT NULL,
    "directResponseAngle"     TEXT,
    "approvalStatus"          TEXT NOT NULL DEFAULT 'draft',
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedImageIterationConcept_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GeneratedImageIterationConcept_uploadedCreativeImageId_fkey"
        FOREIGN KEY ("uploadedCreativeImageId")
        REFERENCES "UploadedCreativeImage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GeneratedImageIterationConcept_uploadedCreativeImageId_idx"
    ON "GeneratedImageIterationConcept"("uploadedCreativeImageId");
