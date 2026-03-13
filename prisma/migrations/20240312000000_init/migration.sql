-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dailyBudget" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "roasGoalType" TEXT NOT NULL,
    "roasGoalValue" REAL NOT NULL,
    "cpaGoalType" TEXT NOT NULL,
    "cpaGoalValue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignGoal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targeting" TEXT NOT NULL,
    "dailyBudget" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adSetId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ad_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "accessToken" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MetaAdAccountSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metaConnectionId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "clientAccountId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetaAdAccountSelection_metaConnectionId_fkey" FOREIGN KEY ("metaConnectionId") REFERENCES "MetaConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UTMPerformanceRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adSetId" TEXT,
    "adSetName" TEXT,
    "adId" TEXT,
    "adName" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "spend" REAL NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "revenue" REAL NOT NULL,
    "cpa" REAL NOT NULL,
    "roas" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UTMPerformanceRow_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CRMConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "storeUrl" TEXT,
    "apiEndpoint" TEXT,
    "connectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CRMPerformanceRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "orders" INTEGER NOT NULL,
    "revenue" REAL NOT NULL,
    "averageOrderValue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CRMPerformanceRow_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReconciliationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "metaSpend" REAL,
    "metaConversions" INTEGER,
    "metaRevenue" REAL,
    "metaRoas" REAL,
    "crmOrders" INTEGER,
    "crmRevenue" REAL,
    "crmSource" TEXT,
    "revenueDelta" REAL,
    "revenueDeltaPct" REAL,
    "status" TEXT NOT NULL,
    "statusReason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReconciliationResult_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignGoal_campaignId_key" ON "CampaignGoal"("campaignId");
