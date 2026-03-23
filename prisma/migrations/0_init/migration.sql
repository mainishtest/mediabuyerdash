-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "timezone" TEXT,
    "monthlyAdSpend" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "immediateAlerts" BOOLEAN NOT NULL DEFAULT true,
    "dailyDigest" BOOLEAN NOT NULL DEFAULT true,
    "alertHighPriority" BOOLEAN NOT NULL DEFAULT true,
    "alertSyncFailure" BOOLEAN NOT NULL DEFAULT true,
    "alertPacing" BOOLEAN NOT NULL DEFAULT true,
    "alertBelowGoal" BOOLEAN NOT NULL DEFAULT true,
    "alertMissingGoals" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "eventType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "subject" TEXT NOT NULL,
    "deduplicationKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "clientPortalToken" TEXT,
    "clientPortalPasswordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dailyBudget" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignGoal" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "roasGoalType" TEXT NOT NULL,
    "roasGoalValue" DOUBLE PRECISION NOT NULL,
    "cpaGoalType" TEXT NOT NULL,
    "cpaGoalValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSet" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targeting" TEXT NOT NULL,
    "dailyBudget" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL,
    "metaUserId" TEXT NOT NULL,
    "userDisplayName" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'active',
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAccessibleAdAccount" (
    "id" TEXT NOT NULL,
    "metaConnectionId" TEXT NOT NULL,
    "externalAdAccountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountStatus" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezoneName" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAccessibleAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSelectedAdAccount" (
    "id" TEXT NOT NULL,
    "metaConnectionId" TEXT NOT NULL,
    "accessibleAdAccountId" TEXT NOT NULL,
    "clientAccountId" TEXT,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaSelectedAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UTMPerformanceRow" (
    "id" TEXT NOT NULL,
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
    "spend" DOUBLE PRECISION NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "cpa" DOUBLE PRECISION NOT NULL,
    "roas" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UTMPerformanceRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRMConnection" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "storeUrl" TEXT,
    "apiEndpoint" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CRMConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRMPerformanceRow" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "orders" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "averageOrderValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CRMPerformanceRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationResult" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "metaSpend" DOUBLE PRECISION,
    "metaConversions" INTEGER,
    "metaRevenue" DOUBLE PRECISION,
    "metaRoas" DOUBLE PRECISION,
    "crmOrders" INTEGER,
    "crmRevenue" DOUBLE PRECISION,
    "crmSource" TEXT,
    "revenueDelta" DOUBLE PRECISION,
    "revenueDeltaPct" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "statusReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGenerationJob" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "responseSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeApproval" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT,
    "campaignId" TEXT NOT NULL,
    "adSetId" TEXT,
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationPromptSnapshot" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "renderedPrompt" TEXT NOT NULL,
    "contextSnapshotJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationPromptSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationProviderRequest" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestPayloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationProviderRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationProviderResponse" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "responsePayloadJson" TEXT NOT NULL,
    "executionStatus" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationProviderResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedCopyVariation" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedCopyVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedImageVariation" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "conceptSummary" TEXT NOT NULL,
    "visualChanges" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedImageVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationApprovalDecision" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "variationType" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectedCreativeVariant" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "variationType" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectedCreativeVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchDraft" (
    "id" TEXT NOT NULL,
    "draftName" TEXT NOT NULL,
    "clientAccountId" TEXT,
    "campaignId" TEXT NOT NULL,
    "adSetId" TEXT,
    "baseAdId" TEXT NOT NULL,
    "baseAdName" TEXT NOT NULL,
    "objectiveMetric" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchDraftVariant" (
    "id" TEXT NOT NULL,
    "launchDraftId" TEXT NOT NULL,
    "copyVariationId" TEXT,
    "imageVariationId" TEXT,
    "variantName" TEXT NOT NULL,
    "hook" TEXT,
    "body" TEXT,
    "callToAction" TEXT,
    "imageConceptTitle" TEXT,
    "imageConceptSummary" TEXT,
    "selectedForLaunch" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchDraftVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentRecord" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "comparisonMode" TEXT NOT NULL DEFAULT 'simultaneous',
    "controlCreativeId" TEXT,
    "controlAdExternalId" TEXT,
    "controlAdSetExternalId" TEXT,
    "controlCampaignExternalId" TEXT,
    "controlLabel" TEXT NOT NULL DEFAULT 'Control',
    "challengerPrepItemId" TEXT,
    "challengerAdExternalId" TEXT,
    "challengerAdSetExternalId" TEXT,
    "challengerCampaignExternalId" TEXT,
    "challengerLabel" TEXT NOT NULL DEFAULT 'Challenger',
    "externalAdAccountId" TEXT,
    "primaryMetric" TEXT NOT NULL DEFAULT 'roas_7d',
    "secondaryMetrics" TEXT,
    "successThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "minSpendPerVariant" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "minConversionsPerVariant" INTEGER NOT NULL DEFAULT 5,
    "evaluationWindowDays" INTEGER NOT NULL DEFAULT 7,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluationEndsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentResultRecord" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "winningVariant" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "controlSnapshotJson" TEXT,
    "challengerSnapshotJson" TEXT,
    "primaryMetricDelta" DOUBLE PRECISION,
    "primaryMetricLift" DOUBLE PRECISION,
    "guardrailBreaches" TEXT,
    "outcomeReasons" TEXT,
    "recommendedAction" TEXT,
    "recommendedNote" TEXT,
    "learningSummary" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentResultRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentLearningRecord" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "briefIntent" TEXT,
    "draftType" TEXT,
    "winningPattern" TEXT,
    "outcomeLabel" TEXT NOT NULL,
    "insightText" TEXT NOT NULL,
    "detailJson" TEXT,
    "usableForBriefs" BOOLEAN NOT NULL DEFAULT true,
    "usableForScoring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentLearningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeTestResultRecord" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trackingState" TEXT NOT NULL DEFAULT 'pending_launch',
    "outcome" TEXT,
    "launchPlanId" TEXT,
    "experimentId" TEXT,
    "prepItemId" TEXT,
    "briefId" TEXT,
    "controlCreativeId" TEXT,
    "controlCreativeName" TEXT,
    "controlAdExternalId" TEXT,
    "challengerVariantTitle" TEXT,
    "challengerAdExternalId" TEXT,
    "clientName" TEXT,
    "campaignName" TEXT,
    "adSetName" TEXT,
    "externalAdAccountId" TEXT,
    "targetCampaignExternalId" TEXT,
    "targetAdSetExternalId" TEXT,
    "primaryMetric" TEXT NOT NULL DEFAULT 'roas_7d',
    "successThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "evaluationWindowDays" INTEGER NOT NULL DEFAULT 7,
    "minSpendPerVariant" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "minConversionsPerVariant" INTEGER NOT NULL DEFAULT 5,
    "controlSnapshotJson" TEXT,
    "challengerSnapshotJson" TEXT,
    "primaryMetricDelta" DOUBLE PRECISION,
    "primaryMetricLift" DOUBLE PRECISION,
    "guardrailBreaches" TEXT,
    "outcomeReasons" TEXT,
    "confidence" DOUBLE PRECISION,
    "winningVariant" TEXT,
    "windowStartedAt" TIMESTAMP(3),
    "windowEndsAt" TIMESTAMP(3),
    "isWindowComplete" BOOLEAN NOT NULL DEFAULT false,
    "recommendedNextStep" TEXT,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeTestResultRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeLifecycleResultLinkRecord" (
    "id" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "prepItemId" TEXT,
    "briefId" TEXT,
    "variantId" TEXT,
    "launchPlanId" TEXT,
    "experimentId" TEXT,
    "outcome" TEXT,
    "winningRole" TEXT,
    "confidence" DOUBLE PRECISION,
    "primaryLift" DOUBLE PRECISION,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeLifecycleResultLinkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeOutcomeRouteRecord" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "routeType" TEXT NOT NULL,
    "readinessState" TEXT NOT NULL DEFAULT 'pending_action',
    "outcome" TEXT,
    "confidenceLevel" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "primaryLift" DOUBLE PRECISION,
    "winningVariant" TEXT,
    "challengerVariantTitle" TEXT,
    "controlCreativeName" TEXT,
    "campaignName" TEXT,
    "primaryMetric" TEXT,
    "reasonsJson" TEXT NOT NULL DEFAULT '[]',
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "learningJson" TEXT,
    "nextActionLabel" TEXT NOT NULL,
    "nextActionHint" TEXT NOT NULL,
    "linkedWorkflow" TEXT,
    "learningSummary" TEXT,
    "actionedAt" TIMESTAMP(3),
    "actionedBy" TEXT,
    "actionNote" TEXT,
    "archivedAt" TIMESTAMP(3),
    "launchPlanId" TEXT,
    "experimentId" TEXT,
    "briefId" TEXT,
    "variantId" TEXT,
    "prepItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeOutcomeRouteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentLaunchPlanRecord" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "objective" TEXT,
    "prepItemId" TEXT,
    "briefId" TEXT,
    "variantId" TEXT,
    "recommendationId" TEXT,
    "readinessState" TEXT NOT NULL DEFAULT 'draft',
    "controlLabel" TEXT NOT NULL DEFAULT 'Control',
    "controlCreativeId" TEXT,
    "controlCreativeName" TEXT,
    "controlAdExternalId" TEXT,
    "controlAdSetExternalId" TEXT,
    "controlCampaignExternalId" TEXT,
    "challengerLabel" TEXT NOT NULL DEFAULT 'Challenger',
    "challengerCreativeName" TEXT,
    "challengerAdExternalId" TEXT,
    "challengerAdSetExternalId" TEXT,
    "challengerCampaignExternalId" TEXT,
    "challengerBriefIntent" TEXT,
    "challengerBriefDraftType" TEXT,
    "challengerVariantTitle" TEXT,
    "challengerVariantType" TEXT,
    "challengerClientName" TEXT,
    "challengerCampaignName" TEXT,
    "targetCampaignId" TEXT,
    "targetCampaignName" TEXT,
    "targetCampaignExternalId" TEXT,
    "targetAdSetId" TEXT,
    "targetAdSetName" TEXT,
    "targetAdSetExternalId" TEXT,
    "externalAdAccountId" TEXT,
    "comparisonMode" TEXT NOT NULL DEFAULT 'simultaneous',
    "primaryMetric" TEXT NOT NULL DEFAULT 'roas_7d',
    "secondaryMetricsJson" TEXT,
    "guardrailMetricsJson" TEXT,
    "successThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "minSpendPerVariant" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "minConversionsPerVariant" INTEGER NOT NULL DEFAULT 5,
    "evaluationWindowDays" INTEGER NOT NULL DEFAULT 7,
    "launchNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "linkedExperimentId" TEXT,
    "launchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentLaunchPlanRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishPrepRecord" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "executionMode" TEXT NOT NULL DEFAULT 'manual_publish',
    "variantTitle" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "briefIntent" TEXT NOT NULL,
    "briefDraftType" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "campaignName" TEXT,
    "creativeName" TEXT,
    "targetCampaignId" TEXT,
    "targetCampaignName" TEXT,
    "targetCampaignExternalId" TEXT,
    "targetAdSetId" TEXT,
    "targetAdSetName" TEXT,
    "targetAdSetExternalId" TEXT,
    "destinationUrl" TEXT,
    "ctaType" TEXT,
    "payloadJson" TEXT,
    "validationJson" TEXT,
    "guardrailJson" TEXT,
    "launchNotes" TEXT,
    "approvedForLaunch" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishPrepRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSyncLog" (
    "id" TEXT NOT NULL,
    "metaConnectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "accountsProcessed" INTEGER NOT NULL DEFAULT 0,
    "campaignsSynced" INTEGER NOT NULL DEFAULT 0,
    "adSetsSynced" INTEGER NOT NULL DEFAULT 0,
    "adsSynced" INTEGER NOT NULL DEFAULT 0,
    "creativesSynced" INTEGER NOT NULL DEFAULT 0,
    "insightRowsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorMessages" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSyncedCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "externalAdAccountId" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "objective" TEXT,
    "buyingType" TEXT,
    "metaCreatedAt" TIMESTAMP(3),
    "metaUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaSyncedCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCampaignGoal" (
    "id" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "roasGoalType" TEXT NOT NULL,
    "roasGoalValue" DOUBLE PRECISION NOT NULL,
    "cpaGoalType" TEXT NOT NULL,
    "cpaGoalValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCampaignGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientGoalDefaults" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "defaultRoasGoalType" TEXT NOT NULL DEFAULT 'high',
    "defaultRoasGoalValue" DOUBLE PRECISION NOT NULL,
    "defaultCpaGoalType" TEXT NOT NULL DEFAULT 'low',
    "defaultCpaGoalValue" DOUBLE PRECISION NOT NULL,
    "targetRoas" DOUBLE PRECISION,
    "targetCpa" DOUBLE PRECISION,
    "targetCtr" DOUBLE PRECISION,
    "targetCvr" DOUBLE PRECISION,
    "maxDailySpend" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientGoalDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSyncedAdSet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "externalAdAccountId" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "externalAdSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metaCreatedAt" TIMESTAMP(3),
    "metaUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaSyncedAdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSyncedAd" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "externalAdAccountId" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "externalAdSetId" TEXT NOT NULL,
    "externalAdId" TEXT NOT NULL,
    "externalCreativeId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metaCreatedAt" TIMESTAMP(3),
    "metaUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaSyncedAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSyncedCreative" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "externalCreativeId" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "body" TEXT,
    "callToAction" TEXT,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaSyncedCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSyncedInsight" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "externalAdAccountId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'ad',
    "externalCampaignId" TEXT NOT NULL DEFAULT '',
    "externalAdSetId" TEXT NOT NULL DEFAULT '',
    "externalAdId" TEXT NOT NULL DEFAULT '',
    "dateStart" TEXT NOT NULL,
    "dateStop" TEXT NOT NULL DEFAULT '',
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION,
    "cpm" DOUBLE PRECISION,
    "frequency" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaSyncedInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientAccountId" TEXT,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'active',
    "scopes" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "shopifyConnectionId" TEXT NOT NULL,
    "clientAccountId" TEXT,
    "externalOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderCreatedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "landingPage" TEXT,
    "referringSite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "netRevenue" DOUBLE PRECISION,
    "refundTotal" DOUBLE PRECISION,

    CONSTRAINT "ShopifyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderLineItem" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationMatch" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 7,
    "matchKey" TEXT NOT NULL,
    "metaCampaignId" TEXT,
    "metaAdSetId" TEXT,
    "metaAdId" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "metaSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metaClicks" INTEGER,
    "metaImpressions" INTEGER,
    "crmOrders" INTEGER NOT NULL DEFAULT 0,
    "crmRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evaluatedCpa" DOUBLE PRECISION,
    "evaluatedRoas" DOUBLE PRECISION,
    "matchStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationSummary" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "dateFrom" TEXT NOT NULL,
    "dateTo" TEXT NOT NULL,
    "totalMetaSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCrmRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCrmOrders" INTEGER NOT NULL DEFAULT 0,
    "evaluatedCpa" DOUBLE PRECISION,
    "evaluatedRoas" DOUBLE PRECISION,
    "matchedRows" INTEGER NOT NULL DEFAULT 0,
    "unmatchedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciledCampaignPerformance" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "dateFrom" TEXT NOT NULL,
    "dateTo" TEXT NOT NULL,
    "metaSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attributedRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attributedOrders" INTEGER NOT NULL DEFAULT 0,
    "calculatedRoas" DOUBLE PRECISION,
    "calculatedCpa" DOUBLE PRECISION,
    "utmMatchedOrders" INTEGER NOT NULL DEFAULT 0,
    "windowMatchedOrders" INTEGER NOT NULL DEFAULT 0,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciledCampaignPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientAccountId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "supportingMetrics" TEXT NOT NULL DEFAULT '{}',
    "deduplicationKey" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSyncRun" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSyncRunStep" (
    "id" TEXT NOT NULL,
    "clientSyncRunId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summaryJson" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ClientSyncRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifySyncLog" (
    "id" TEXT NOT NULL,
    "shopifyConnectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ordersSynced" INTEGER NOT NULL DEFAULT 0,
    "lineItemsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorMessages" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopifySyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedCreativeImage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientAccountId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceCallToAction" TEXT,
    "sourceCopy" TEXT,

    CONSTRAINT "UploadedCreativeImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedCreativeAnalysis" (
    "id" TEXT NOT NULL,
    "uploadedCreativeImageId" TEXT NOT NULL,
    "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
    "analysisEngine" TEXT NOT NULL DEFAULT 'mock_v1',
    "visualHeadline" TEXT,
    "detectedStyle" TEXT,
    "dominantMessage" TEXT,
    "visualTheme" TEXT,
    "clarityScore" INTEGER,
    "attentionScore" INTEGER,
    "directResponseObservationsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedCreativeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedImageIterationConcept" (
    "id" TEXT NOT NULL,
    "uploadedCreativeImageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "conceptSummary" TEXT NOT NULL,
    "visualChanges" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "directResponseAngle" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedImageIterationConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "conditions" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposedAutomationAction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientAccountId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "automationRuleId" TEXT,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "supportingData" TEXT NOT NULL DEFAULT '{}',
    "deduplicationKey" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "deferredUntil" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposedAutomationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoExecutionSettings" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowRunSync" BOOLEAN NOT NULL DEFAULT true,
    "allowPauseCampaign" BOOLEAN NOT NULL DEFAULT false,
    "maxDailyExecutions" INTEGER NOT NULL DEFAULT 5,
    "maxSpendThreshold" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "minRoasThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoExecutionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoExecutionLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientAccountId" TEXT,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "guardrailJson" TEXT NOT NULL DEFAULT '[]',
    "decision" TEXT NOT NULL,
    "decisionReason" TEXT NOT NULL,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPacingTarget" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "monthlyBudget" DOUBLE PRECISION NOT NULL,
    "dailyBudget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPacingTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeLabWorkflowItem" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeLabWorkflowItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeLabActivityLog" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeLabActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeBriefRecord" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "creativeId" TEXT,
    "sourceItemId" TEXT,
    "draftType" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "briefJson" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeBriefRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeDraftVariantRecord" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "reviewDecision" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeDraftVariantRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeGenerationJobRecord" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'running',
    "variantCount" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CreativeGenerationJobRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionSafetyPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "autonomyMode" TEXT NOT NULL DEFAULT 'approval_required',
    "allowedActionTypes" TEXT NOT NULL DEFAULT '[]',
    "blockedActionTypes" TEXT NOT NULL DEFAULT '[]',
    "approvalRequired" TEXT NOT NULL DEFAULT '[]',
    "constraints" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionSafetyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientAccountId" TEXT,
    "clientName" TEXT,
    "eventType" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL DEFAULT '{}',
    "actorJson" TEXT NOT NULL DEFAULT '{}',
    "approvalJson" TEXT,
    "executionJson" TEXT,
    "blockJson" TEXT,
    "rollbackJson" TEXT NOT NULL DEFAULT '{}',
    "policyDecision" TEXT,
    "policyReason" TEXT,
    "relatedActionId" TEXT,
    "relatedExecutionLogId" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceStop" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "stoppedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "clearedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationOverride" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "overrideType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "actionId" TEXT,
    "reason" TEXT NOT NULL,
    "appliedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "clearedBy" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyBriefRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "briefDate" TEXT NOT NULL,
    "deliveryState" TEXT NOT NULL DEFAULT 'pending',
    "contentJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyBriefRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL DEFAULT 'create_client',
    "completedSteps" TEXT NOT NULL DEFAULT '[]',
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyRefund" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "externalRefundId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "note" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_userId_workspaceId_key" ON "WorkspaceMembership"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_workspaceId_idx" ON "NotificationLog"("workspaceId");

-- CreateIndex
CREATE INDEX "NotificationLog_deduplicationKey_idx" ON "NotificationLog"("deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccount_clientPortalToken_key" ON "ClientAccount"("clientPortalToken");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignGoal_campaignId_key" ON "CampaignGoal"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_metaUserId_key" ON "MetaConnection"("metaUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAccessibleAdAccount_metaConnectionId_externalAdAccountI_key" ON "MetaAccessibleAdAccount"("metaConnectionId", "externalAdAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaSelectedAdAccount_accessibleAdAccountId_key" ON "MetaSelectedAdAccount"("accessibleAdAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeApproval_jobId_variationId_key" ON "CreativeApproval"("jobId", "variationId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPromptSnapshot_generationRunId_key" ON "GenerationPromptSnapshot"("generationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationProviderRequest_generationRunId_key" ON "GenerationProviderRequest"("generationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationProviderResponse_generationRunId_key" ON "GenerationProviderResponse"("generationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "SelectedCreativeVariant_generationRunId_variationType_key" ON "SelectedCreativeVariant"("generationRunId", "variationType");

-- CreateIndex
CREATE INDEX "ExperimentRecord_clientAccountId_idx" ON "ExperimentRecord"("clientAccountId");

-- CreateIndex
CREATE INDEX "ExperimentRecord_challengerPrepItemId_idx" ON "ExperimentRecord"("challengerPrepItemId");

-- CreateIndex
CREATE INDEX "ExperimentRecord_status_idx" ON "ExperimentRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentResultRecord_experimentId_key" ON "ExperimentResultRecord"("experimentId");

-- CreateIndex
CREATE INDEX "ExperimentResultRecord_experimentId_idx" ON "ExperimentResultRecord"("experimentId");

-- CreateIndex
CREATE INDEX "ExperimentLearningRecord_clientAccountId_idx" ON "ExperimentLearningRecord"("clientAccountId");

-- CreateIndex
CREATE INDEX "ExperimentLearningRecord_briefIntent_idx" ON "ExperimentLearningRecord"("briefIntent");

-- CreateIndex
CREATE INDEX "ExperimentLearningRecord_experimentId_idx" ON "ExperimentLearningRecord"("experimentId");

-- CreateIndex
CREATE INDEX "CreativeTestResultRecord_clientAccountId_idx" ON "CreativeTestResultRecord"("clientAccountId");

-- CreateIndex
CREATE INDEX "CreativeTestResultRecord_launchPlanId_idx" ON "CreativeTestResultRecord"("launchPlanId");

-- CreateIndex
CREATE INDEX "CreativeTestResultRecord_experimentId_idx" ON "CreativeTestResultRecord"("experimentId");

-- CreateIndex
CREATE INDEX "CreativeTestResultRecord_trackingState_idx" ON "CreativeTestResultRecord"("trackingState");

-- CreateIndex
CREATE INDEX "CreativeTestResultRecord_outcome_idx" ON "CreativeTestResultRecord"("outcome");

-- CreateIndex
CREATE INDEX "CreativeLifecycleResultLinkRecord_testResultId_idx" ON "CreativeLifecycleResultLinkRecord"("testResultId");

-- CreateIndex
CREATE INDEX "CreativeLifecycleResultLinkRecord_prepItemId_idx" ON "CreativeLifecycleResultLinkRecord"("prepItemId");

-- CreateIndex
CREATE INDEX "CreativeLifecycleResultLinkRecord_clientAccountId_idx" ON "CreativeLifecycleResultLinkRecord"("clientAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeOutcomeRouteRecord_testResultId_key" ON "CreativeOutcomeRouteRecord"("testResultId");

-- CreateIndex
CREATE INDEX "CreativeOutcomeRouteRecord_clientAccountId_idx" ON "CreativeOutcomeRouteRecord"("clientAccountId");

-- CreateIndex
CREATE INDEX "CreativeOutcomeRouteRecord_readinessState_idx" ON "CreativeOutcomeRouteRecord"("readinessState");

-- CreateIndex
CREATE INDEX "CreativeOutcomeRouteRecord_routeType_idx" ON "CreativeOutcomeRouteRecord"("routeType");

-- CreateIndex
CREATE INDEX "CreativeOutcomeRouteRecord_testResultId_idx" ON "CreativeOutcomeRouteRecord"("testResultId");

-- CreateIndex
CREATE INDEX "ExperimentLaunchPlanRecord_clientAccountId_idx" ON "ExperimentLaunchPlanRecord"("clientAccountId");

-- CreateIndex
CREATE INDEX "ExperimentLaunchPlanRecord_prepItemId_idx" ON "ExperimentLaunchPlanRecord"("prepItemId");

-- CreateIndex
CREATE INDEX "ExperimentLaunchPlanRecord_readinessState_idx" ON "ExperimentLaunchPlanRecord"("readinessState");

-- CreateIndex
CREATE INDEX "PublishPrepRecord_briefId_idx" ON "PublishPrepRecord"("briefId");

-- CreateIndex
CREATE INDEX "PublishPrepRecord_variantId_idx" ON "PublishPrepRecord"("variantId");

-- CreateIndex
CREATE INDEX "PublishPrepRecord_clientAccountId_idx" ON "PublishPrepRecord"("clientAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaSyncedCampaign_externalCampaignId_key" ON "MetaSyncedCampaign"("externalCampaignId");

-- CreateIndex
CREATE INDEX "MetaSyncedCampaign_workspaceId_idx" ON "MetaSyncedCampaign"("workspaceId");

-- CreateIndex
CREATE INDEX "MetaSyncedCampaign_workspaceId_externalAdAccountId_idx" ON "MetaSyncedCampaign"("workspaceId", "externalAdAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaCampaignGoal_externalCampaignId_key" ON "MetaCampaignGoal"("externalCampaignId");

-- CreateIndex
CREATE INDEX "MetaCampaignGoal_externalCampaignId_idx" ON "MetaCampaignGoal"("externalCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientGoalDefaults_clientAccountId_key" ON "ClientGoalDefaults"("clientAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaSyncedAdSet_externalAdSetId_key" ON "MetaSyncedAdSet"("externalAdSetId");

-- CreateIndex
CREATE INDEX "MetaSyncedAdSet_workspaceId_idx" ON "MetaSyncedAdSet"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaSyncedAd_externalAdId_key" ON "MetaSyncedAd"("externalAdId");

-- CreateIndex
CREATE INDEX "MetaSyncedAd_workspaceId_idx" ON "MetaSyncedAd"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaSyncedCreative_externalCreativeId_key" ON "MetaSyncedCreative"("externalCreativeId");

-- CreateIndex
CREATE INDEX "MetaSyncedCreative_workspaceId_idx" ON "MetaSyncedCreative"("workspaceId");

-- CreateIndex
CREATE INDEX "MetaSyncedInsight_externalAdAccountId_dateStart_idx" ON "MetaSyncedInsight"("externalAdAccountId", "dateStart");

-- CreateIndex
CREATE INDEX "MetaSyncedInsight_workspaceId_dateStart_idx" ON "MetaSyncedInsight"("workspaceId", "dateStart");

-- CreateIndex
CREATE UNIQUE INDEX "MetaSyncedInsight_externalAdAccountId_level_externalCampaig_key" ON "MetaSyncedInsight"("externalAdAccountId", "level", "externalCampaignId", "externalAdSetId", "externalAdId", "dateStart");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyConnection_shopDomain_key" ON "ShopifyConnection"("shopDomain");

-- CreateIndex
CREATE INDEX "ShopifyConnection_workspaceId_idx" ON "ShopifyConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "ShopifyOrder_shopifyConnectionId_orderCreatedAt_idx" ON "ShopifyOrder"("shopifyConnectionId", "orderCreatedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrder_clientAccountId_orderCreatedAt_idx" ON "ShopifyOrder"("clientAccountId", "orderCreatedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrder_workspaceId_orderCreatedAt_idx" ON "ShopifyOrder"("workspaceId", "orderCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrder_shopifyConnectionId_externalOrderId_key" ON "ShopifyOrder"("shopifyConnectionId", "externalOrderId");

-- CreateIndex
CREATE INDEX "ReconciliationMatch_clientAccountId_date_idx" ON "ReconciliationMatch"("clientAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationMatch_clientAccountId_matchKey_key" ON "ReconciliationMatch"("clientAccountId", "matchKey");

-- CreateIndex
CREATE INDEX "ReconciliationSummary_clientAccountId_dateFrom_idx" ON "ReconciliationSummary"("clientAccountId", "dateFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationSummary_clientAccountId_dateFrom_dateTo_key" ON "ReconciliationSummary"("clientAccountId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "ReconciledCampaignPerformance_clientAccountId_dateFrom_idx" ON "ReconciledCampaignPerformance"("clientAccountId", "dateFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciledCampaignPerformance_clientAccountId_externalCampa_key" ON "ReconciledCampaignPerformance"("clientAccountId", "externalCampaignId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "AlertEvent_clientAccountId_status_idx" ON "AlertEvent"("clientAccountId", "status");

-- CreateIndex
CREATE INDEX "AlertEvent_status_severity_idx" ON "AlertEvent"("status", "severity");

-- CreateIndex
CREATE INDEX "AlertEvent_workspaceId_status_idx" ON "AlertEvent"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AlertEvent_deduplicationKey_idx" ON "AlertEvent"("deduplicationKey");

-- CreateIndex
CREATE INDEX "ClientSyncRun_clientAccountId_startedAt_idx" ON "ClientSyncRun"("clientAccountId", "startedAt");

-- CreateIndex
CREATE INDEX "UploadedCreativeImage_workspaceId_idx" ON "UploadedCreativeImage"("workspaceId");

-- CreateIndex
CREATE INDEX "UploadedCreativeImage_clientAccountId_idx" ON "UploadedCreativeImage"("clientAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedCreativeAnalysis_uploadedCreativeImageId_key" ON "UploadedCreativeAnalysis"("uploadedCreativeImageId");

-- CreateIndex
CREATE INDEX "GeneratedImageIterationConcept_uploadedCreativeImageId_idx" ON "GeneratedImageIterationConcept"("uploadedCreativeImageId");

-- CreateIndex
CREATE INDEX "AutomationRule_workspaceId_idx" ON "AutomationRule"("workspaceId");

-- CreateIndex
CREATE INDEX "ProposedAutomationAction_workspaceId_idx" ON "ProposedAutomationAction"("workspaceId");

-- CreateIndex
CREATE INDEX "ProposedAutomationAction_clientAccountId_idx" ON "ProposedAutomationAction"("clientAccountId");

-- CreateIndex
CREATE INDEX "ProposedAutomationAction_deduplicationKey_idx" ON "ProposedAutomationAction"("deduplicationKey");

-- CreateIndex
CREATE INDEX "ProposedAutomationAction_status_idx" ON "ProposedAutomationAction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AutoExecutionSettings_clientAccountId_key" ON "AutoExecutionSettings"("clientAccountId");

-- CreateIndex
CREATE INDEX "AutoExecutionSettings_workspaceId_idx" ON "AutoExecutionSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "AutoExecutionLog_workspaceId_idx" ON "AutoExecutionLog"("workspaceId");

-- CreateIndex
CREATE INDEX "AutoExecutionLog_clientAccountId_executedAt_idx" ON "AutoExecutionLog"("clientAccountId", "executedAt");

-- CreateIndex
CREATE INDEX "AutoExecutionLog_status_idx" ON "AutoExecutionLog"("status");

-- CreateIndex
CREATE INDEX "BudgetPacingTarget_clientAccountId_idx" ON "BudgetPacingTarget"("clientAccountId");

-- CreateIndex
CREATE INDEX "BudgetPacingTarget_clientAccountId_campaignId_idx" ON "BudgetPacingTarget"("clientAccountId", "campaignId");

-- CreateIndex
CREATE INDEX "CreativeLabWorkflowItem_clientAccountId_idx" ON "CreativeLabWorkflowItem"("clientAccountId");

-- CreateIndex
CREATE INDEX "CreativeLabWorkflowItem_status_idx" ON "CreativeLabWorkflowItem"("status");

-- CreateIndex
CREATE INDEX "CreativeLabActivityLog_itemId_idx" ON "CreativeLabActivityLog"("itemId");

-- CreateIndex
CREATE INDEX "CreativeBriefRecord_clientAccountId_idx" ON "CreativeBriefRecord"("clientAccountId");

-- CreateIndex
CREATE INDEX "CreativeBriefRecord_status_idx" ON "CreativeBriefRecord"("status");

-- CreateIndex
CREATE INDEX "CreativeBriefRecord_sourceItemId_idx" ON "CreativeBriefRecord"("sourceItemId");

-- CreateIndex
CREATE INDEX "CreativeDraftVariantRecord_briefId_idx" ON "CreativeDraftVariantRecord"("briefId");

-- CreateIndex
CREATE INDEX "CreativeGenerationJobRecord_briefId_idx" ON "CreativeGenerationJobRecord"("briefId");

-- CreateIndex
CREATE INDEX "CreativeGenerationJobRecord_status_idx" ON "CreativeGenerationJobRecord"("status");

-- CreateIndex
CREATE INDEX "ActionSafetyPolicy_workspaceId_idx" ON "ActionSafetyPolicy"("workspaceId");

-- CreateIndex
CREATE INDEX "ActionSafetyPolicy_scope_scopeId_idx" ON "ActionSafetyPolicy"("scope", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionSafetyPolicy_workspaceId_scope_scopeId_key" ON "ActionSafetyPolicy"("workspaceId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "AutomationAuditLog_workspaceId_idx" ON "AutomationAuditLog"("workspaceId");

-- CreateIndex
CREATE INDEX "AutomationAuditLog_clientAccountId_occurredAt_idx" ON "AutomationAuditLog"("clientAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "AutomationAuditLog_eventType_idx" ON "AutomationAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AutomationAuditLog_actionType_idx" ON "AutomationAuditLog"("actionType");

-- CreateIndex
CREATE INDEX "AutomationAuditLog_relatedActionId_idx" ON "AutomationAuditLog"("relatedActionId");

-- CreateIndex
CREATE INDEX "GovernanceStop_workspaceId_isActive_idx" ON "GovernanceStop"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "GovernanceStop_scope_scopeId_isActive_idx" ON "GovernanceStop"("scope", "scopeId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationOverride_workspaceId_isActive_idx" ON "AutomationOverride"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationOverride_scope_scopeId_isActive_idx" ON "AutomationOverride"("scope", "scopeId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationOverride_actionId_idx" ON "AutomationOverride"("actionId");

-- CreateIndex
CREATE INDEX "DailyBriefRecord_deliveryState_idx" ON "DailyBriefRecord"("deliveryState");

-- CreateIndex
CREATE INDEX "DailyBriefRecord_workspaceId_briefDate_idx" ON "DailyBriefRecord"("workspaceId", "briefDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyBriefRecord_workspaceId_briefDate_key" ON "DailyBriefRecord"("workspaceId", "briefDate");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingState_workspaceId_key" ON "OnboardingState"("workspaceId");

-- CreateIndex
CREATE INDEX "ShopifyRefund_shopifyOrderId_idx" ON "ShopifyRefund"("shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyRefund_shopifyOrderId_externalRefundId_key" ON "ShopifyRefund"("shopifyOrderId", "externalRefundId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignGoal" ADD CONSTRAINT "CampaignGoal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAccessibleAdAccount" ADD CONSTRAINT "MetaAccessibleAdAccount_metaConnectionId_fkey" FOREIGN KEY ("metaConnectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaSelectedAdAccount" ADD CONSTRAINT "MetaSelectedAdAccount_metaConnectionId_fkey" FOREIGN KEY ("metaConnectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaSelectedAdAccount" ADD CONSTRAINT "MetaSelectedAdAccount_accessibleAdAccountId_fkey" FOREIGN KEY ("accessibleAdAccountId") REFERENCES "MetaAccessibleAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaSelectedAdAccount" ADD CONSTRAINT "MetaSelectedAdAccount_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UTMPerformanceRow" ADD CONSTRAINT "UTMPerformanceRow_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMPerformanceRow" ADD CONSTRAINT "CRMPerformanceRow_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationResult" ADD CONSTRAINT "ReconciliationResult_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeApproval" ADD CONSTRAINT "CreativeApproval_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AIGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPromptSnapshot" ADD CONSTRAINT "GenerationPromptSnapshot_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationProviderRequest" ADD CONSTRAINT "GenerationProviderRequest_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationProviderResponse" ADD CONSTRAINT "GenerationProviderResponse_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCopyVariation" ADD CONSTRAINT "GeneratedCopyVariation_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImageVariation" ADD CONSTRAINT "GeneratedImageVariation_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationApprovalDecision" ADD CONSTRAINT "GenerationApprovalDecision_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedCreativeVariant" ADD CONSTRAINT "SelectedCreativeVariant_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchDraftVariant" ADD CONSTRAINT "LaunchDraftVariant_launchDraftId_fkey" FOREIGN KEY ("launchDraftId") REFERENCES "LaunchDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResultRecord" ADD CONSTRAINT "ExperimentResultRecord_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "ExperimentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentLearningRecord" ADD CONSTRAINT "ExperimentLearningRecord_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "ExperimentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeLifecycleResultLinkRecord" ADD CONSTRAINT "CreativeLifecycleResultLinkRecord_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "CreativeTestResultRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaSyncLog" ADD CONSTRAINT "MetaSyncLog_metaConnectionId_fkey" FOREIGN KEY ("metaConnectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaCampaignGoal" ADD CONSTRAINT "MetaCampaignGoal_externalCampaignId_fkey" FOREIGN KEY ("externalCampaignId") REFERENCES "MetaSyncedCampaign"("externalCampaignId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoalDefaults" ADD CONSTRAINT "ClientGoalDefaults_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyConnection" ADD CONSTRAINT "ShopifyConnection_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyOrder" ADD CONSTRAINT "ShopifyOrder_shopifyConnectionId_fkey" FOREIGN KEY ("shopifyConnectionId") REFERENCES "ShopifyConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyOrder" ADD CONSTRAINT "ShopifyOrder_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyOrderLineItem" ADD CONSTRAINT "ShopifyOrderLineItem_shopifyOrderId_fkey" FOREIGN KEY ("shopifyOrderId") REFERENCES "ShopifyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationSummary" ADD CONSTRAINT "ReconciliationSummary_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciledCampaignPerformance" ADD CONSTRAINT "ReconciledCampaignPerformance_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSyncRun" ADD CONSTRAINT "ClientSyncRun_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSyncRunStep" ADD CONSTRAINT "ClientSyncRunStep_clientSyncRunId_fkey" FOREIGN KEY ("clientSyncRunId") REFERENCES "ClientSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifySyncLog" ADD CONSTRAINT "ShopifySyncLog_shopifyConnectionId_fkey" FOREIGN KEY ("shopifyConnectionId") REFERENCES "ShopifyConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedCreativeAnalysis" ADD CONSTRAINT "UploadedCreativeAnalysis_uploadedCreativeImageId_fkey" FOREIGN KEY ("uploadedCreativeImageId") REFERENCES "UploadedCreativeImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImageIterationConcept" ADD CONSTRAINT "GeneratedImageIterationConcept_uploadedCreativeImageId_fkey" FOREIGN KEY ("uploadedCreativeImageId") REFERENCES "UploadedCreativeImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedAutomationAction" ADD CONSTRAINT "ProposedAutomationAction_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedAutomationAction" ADD CONSTRAINT "ProposedAutomationAction_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoExecutionSettings" ADD CONSTRAINT "AutoExecutionSettings_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPacingTarget" ADD CONSTRAINT "BudgetPacingTarget_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeLabActivityLog" ADD CONSTRAINT "CreativeLabActivityLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CreativeLabWorkflowItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeDraftVariantRecord" ADD CONSTRAINT "CreativeDraftVariantRecord_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "CreativeBriefRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionSafetyPolicy" ADD CONSTRAINT "ActionSafetyPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceStop" ADD CONSTRAINT "GovernanceStop_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationOverride" ADD CONSTRAINT "AutomationOverride_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBriefRecord" ADD CONSTRAINT "DailyBriefRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyRefund" ADD CONSTRAINT "ShopifyRefund_shopifyOrderId_fkey" FOREIGN KEY ("shopifyOrderId") REFERENCES "ShopifyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

