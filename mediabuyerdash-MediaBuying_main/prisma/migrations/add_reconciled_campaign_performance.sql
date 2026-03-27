-- Migration: Add ReconciledCampaignPerformance table
-- Run this in the Neon SQL console (or via psql) before deploying.
--
-- This table stores per-campaign CRM-verified performance rollups
-- computed by the reconciliation engine. One row per (client, campaign,
-- date range) — upserted on each reconciliation run.

CREATE TABLE IF NOT EXISTS "ReconciledCampaignPerformance" (
  "id"                    TEXT          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "clientAccountId"       TEXT          NOT NULL,
  "externalCampaignId"    TEXT          NOT NULL,
  "campaignName"          TEXT          NOT NULL,
  "dateFrom"              TEXT          NOT NULL,
  "dateTo"                TEXT          NOT NULL,
  "metaSpend"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attributedRevenue"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attributedOrders"      INTEGER       NOT NULL DEFAULT 0,
  "calculatedRoas"        DOUBLE PRECISION,
  "calculatedCpa"         DOUBLE PRECISION,
  "utmMatchedOrders"      INTEGER       NOT NULL DEFAULT 0,
  "windowMatchedOrders"   INTEGER       NOT NULL DEFAULT 0,
  "attributionWindowDays" INTEGER       NOT NULL DEFAULT 7,
  "createdAt"             TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReconciledCampaignPerformance_clientAccountId_fkey"
    FOREIGN KEY ("clientAccountId")
    REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "ReconciledCampaignPerformance_client_campaign_dates_key"
    UNIQUE ("clientAccountId", "externalCampaignId", "dateFrom", "dateTo")
);

CREATE INDEX IF NOT EXISTS "ReconciledCampaignPerformance_clientAccountId_dateFrom_idx"
  ON "ReconciledCampaignPerformance" ("clientAccountId", "dateFrom");
