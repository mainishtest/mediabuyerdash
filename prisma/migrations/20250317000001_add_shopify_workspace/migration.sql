-- Add workspaceId to ShopifyConnection and ShopifyOrder for multi-workspace scoping.
-- Uses IF NOT EXISTS / DO blocks so this is safe to re-run.

DO $$
BEGIN
    -- ShopifyConnection.workspaceId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyConnection' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "ShopifyConnection" ADD COLUMN "workspaceId" TEXT;
    END IF;

    -- ShopifyOrder.workspaceId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShopifyOrder' AND column_name = 'workspaceId'
    ) THEN
        ALTER TABLE "ShopifyOrder" ADD COLUMN "workspaceId" TEXT;
    END IF;
END
$$;

-- Indexes (IF NOT EXISTS requires PG 9.5+; Neon is PG 15+)
CREATE INDEX IF NOT EXISTS "ShopifyConnection_workspaceId_idx"
    ON "ShopifyConnection"("workspaceId");

CREATE INDEX IF NOT EXISTS "ShopifyOrder_workspaceId_orderCreatedAt_idx"
    ON "ShopifyOrder"("workspaceId", "orderCreatedAt");
