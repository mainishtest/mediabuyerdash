-- Add client-scoped sync run tracking
-- ClientSyncRun: one record per triggered sync (meta | shopify | full) for a client
-- ClientSyncRunStep: one step per data source within a run

CREATE TABLE "ClientSyncRun" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "clientAccountId" TEXT NOT NULL,
    "syncType"        TEXT NOT NULL,
    "status"          TEXT NOT NULL,
    "startedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"     TIMESTAMP,
    "errorMessage"    TEXT,
    "createdAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP NOT NULL,
    CONSTRAINT "ClientSyncRun_clientAccountId_fkey"
        FOREIGN KEY ("clientAccountId")
        REFERENCES "ClientAccount" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX "ClientSyncRun_clientAccountId_startedAt_idx"
    ON "ClientSyncRun" ("clientAccountId", "startedAt");

CREATE TABLE "ClientSyncRunStep" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "clientSyncRunId" TEXT NOT NULL,
    "stepType"        TEXT NOT NULL,
    "status"          TEXT NOT NULL,
    "summaryJson"     TEXT,
    "errorMessage"    TEXT,
    "startedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"     TIMESTAMP,
    CONSTRAINT "ClientSyncRunStep_clientSyncRunId_fkey"
        FOREIGN KEY ("clientSyncRunId")
        REFERENCES "ClientSyncRun" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
