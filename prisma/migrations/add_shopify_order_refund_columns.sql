-- =============================================================================
-- add_shopify_order_refund_columns.sql
-- =============================================================================
-- Adds refund-aware revenue columns to ShopifyOrder and creates
-- the ShopifyRefund table. Required for revenue normalization.
-- Fully idempotent — safe to run multiple times.
-- =============================================================================

-- ─── 1. ShopifyOrder: add refund-aware columns ─────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'financialStatus'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "financialStatus" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'fulfillmentStatus'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "fulfillmentStatus" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'cancelledAt'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "cancelledAt" TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'cancelReason'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "cancelReason" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'refundTotal'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "refundTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'netRevenue'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "netRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;
END
$$;


-- ─── 2. ShopifyRefund table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ShopifyRefund" (
    "id"               TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "shopifyOrderId"   TEXT NOT NULL,
    "externalRefundId" TEXT NOT NULL,
    "refundAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note"             TEXT,
    "refundCreatedAt"  TIMESTAMPTZ NOT NULL,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "ShopifyRefund_shopifyOrderId_fkey"
        FOREIGN KEY ("shopifyOrderId")
        REFERENCES "ShopifyOrder"("id")
        ON DELETE CASCADE
);

-- Unique constraint and index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ShopifyRefund_shopifyOrderId_externalRefundId_key'
    ) THEN
        ALTER TABLE "ShopifyRefund"
            ADD CONSTRAINT "ShopifyRefund_shopifyOrderId_externalRefundId_key"
            UNIQUE ("shopifyOrderId", "externalRefundId");
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "ShopifyRefund_shopifyOrderId_idx"
    ON "ShopifyRefund"("shopifyOrderId");
