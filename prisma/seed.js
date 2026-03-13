"use strict";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // ── Client accounts ─────────────────────────────────────────────────────
  const act1 = await prisma.clientAccount.upsert({
    where: { id: "act_1" },
    update: {},
    create: {
      id: "act_1",
      name: "Main FB Account",
      platform: "facebook",
      currency: "USD",
      timezone: "America/New_York"
    }
  });

  const act2 = await prisma.clientAccount.upsert({
    where: { id: "act_2" },
    update: {},
    create: {
      id: "act_2",
      name: "Secondary Client",
      platform: "facebook",
      currency: "USD",
      timezone: "America/Los_Angeles"
    }
  });

  // ── Campaigns ───────────────────────────────────────────────────────────
  const camp1 = await prisma.campaign.upsert({
    where: { id: "camp_1" },
    update: {},
    create: {
      id: "camp_1",
      accountId: act1.id,
      name: "Prospecting Q1",
      objective: "conversions",
      status: "active",
      dailyBudget: 200
    }
  });

  const camp2 = await prisma.campaign.upsert({
    where: { id: "camp_2" },
    update: {},
    create: {
      id: "camp_2",
      accountId: act1.id,
      name: "Retargeting Q1",
      objective: "traffic",
      status: "paused",
      dailyBudget: 100
    }
  });

  // ── Campaign goals ──────────────────────────────────────────────────────
  await prisma.campaignGoal.upsert({
    where: { campaignId: camp1.id },
    update: {},
    create: {
      campaignId: camp1.id,
      roasGoalType: "high",
      roasGoalValue: 3.5,
      cpaGoalType: "low",
      cpaGoalValue: 20.0
    }
  });

  await prisma.campaignGoal.upsert({
    where: { campaignId: camp2.id },
    update: {},
    create: {
      campaignId: camp2.id,
      roasGoalType: "high",
      roasGoalValue: 2.5,
      cpaGoalType: "low",
      cpaGoalValue: 30.0
    }
  });

  // ── Ad sets ─────────────────────────────────────────────────────────────
  const adset1 = await prisma.adSet.upsert({
    where: { id: "adset_1" },
    update: {},
    create: {
      id: "adset_1",
      campaignId: camp1.id,
      name: "US - Broad",
      targeting: "US, ages 25–54, Broad audience",
      dailyBudget: 100,
      status: "active",
      startDate: "2024-01-01"
    }
  });

  const adset2 = await prisma.adSet.upsert({
    where: { id: "adset_2" },
    update: {},
    create: {
      id: "adset_2",
      campaignId: camp1.id,
      name: "US - Interest Targeting",
      targeting: "US, ages 25–44, Fitness interests",
      dailyBudget: 100,
      status: "active",
      startDate: "2024-01-01"
    }
  });

  // ── Creatives ───────────────────────────────────────────────────────────
  const cr1 = await prisma.creative.upsert({
    where: { id: "creative_1" },
    update: {},
    create: {
      id: "creative_1",
      name: "Spring Collection Video",
      type: "video",
      headline: "Transform Your Results",
      body: "Discover the system top performers use.",
      callToAction: "Learn More"
    }
  });

  const cr2 = await prisma.creative.upsert({
    where: { id: "creative_2" },
    update: {},
    create: {
      id: "creative_2",
      name: "Static Image V1",
      type: "image",
      headline: "Get Results Faster",
      body: "Join thousands who have unlocked better performance.",
      callToAction: "Shop Now"
    }
  });

  // ── Ads ──────────────────────────────────────────────────────────────────
  await prisma.ad.upsert({
    where: { id: "ad_1" },
    update: {},
    create: {
      id: "ad_1",
      adSetId: adset1.id,
      creativeId: cr1.id,
      name: "Video V1 - Broad",
      status: "active"
    }
  });

  await prisma.ad.upsert({
    where: { id: "ad_2" },
    update: {},
    create: {
      id: "ad_2",
      adSetId: adset2.id,
      creativeId: cr2.id,
      name: "Static V1 - Interest",
      status: "active"
    }
  });

  // ── UTM performance rows (2 sample) ──────────────────────────────────────
  await prisma.uTMPerformanceRow.upsert({
    where: { id: "utr_seed_1" },
    update: {},
    create: {
      id: "utr_seed_1",
      clientAccountId: act1.id,
      date: "2024-03-01",
      campaignId: "camp_1",
      campaignName: "Prospecting Q1",
      adSetId: "adset_1",
      adSetName: "US - Broad",
      adId: "ad_1",
      adName: "Video V1 - Broad",
      utmCampaign: "prospecting-q1",
      utmContent: "video-v1-broad",
      utmTerm: "broad",
      utmSource: "facebook",
      utmMedium: "cpc",
      spend: 140.2,
      impressions: 12400,
      clicks: 248,
      conversions: 10,
      revenue: 630,
      cpa: 14.02,
      roas: 4.49
    }
  });

  await prisma.uTMPerformanceRow.upsert({
    where: { id: "utr_seed_2" },
    update: {},
    create: {
      id: "utr_seed_2",
      clientAccountId: act1.id,
      date: "2024-03-01",
      campaignId: "camp_1",
      campaignName: "Prospecting Q1",
      adSetId: "adset_2",
      adSetName: "US - Interest Targeting",
      adId: "ad_2",
      adName: "Static V1 - Interest",
      utmCampaign: "prospecting-q1",
      utmContent: "static-v1-interest",
      utmTerm: "fitness-interest",
      utmSource: "facebook",
      utmMedium: "cpc",
      spend: 92.5,
      impressions: 8100,
      clicks: 152,
      conversions: 5,
      revenue: 287.5,
      cpa: 18.5,
      roas: 3.11
    }
  });

  // ── CRM performance rows (2 sample) ───────────────────────────────────────
  await prisma.cRMPerformanceRow.upsert({
    where: { id: "crm_seed_1" },
    update: {},
    create: {
      id: "crm_seed_1",
      clientAccountId: act1.id,
      date: "2024-03-01",
      sourcePlatform: "shopify",
      utmCampaign: "prospecting-q1",
      utmContent: "video-v1-broad",
      utmTerm: "broad",
      utmSource: "facebook",
      utmMedium: "cpc",
      orders: 8,
      revenue: 504,
      averageOrderValue: 63
    }
  });

  await prisma.cRMPerformanceRow.upsert({
    where: { id: "crm_seed_2" },
    update: {},
    create: {
      id: "crm_seed_2",
      clientAccountId: act1.id,
      date: "2024-03-01",
      sourcePlatform: "shopify",
      utmCampaign: "prospecting-q1",
      utmContent: "static-v1-interest",
      utmTerm: "fitness-interest",
      utmSource: "facebook",
      utmMedium: "cpc",
      orders: 4,
      revenue: 282,
      averageOrderValue: 70.5
    }
  });

  // ── Reconciliation results (2 sample) ────────────────────────────────────
  await prisma.reconciliationResult.upsert({
    where: { id: "rec_seed_1" },
    update: {},
    create: {
      id: "rec_seed_1",
      clientAccountId: act1.id,
      date: "2024-03-01",
      utmCampaign: "prospecting-q1",
      utmContent: "video-v1-broad",
      utmTerm: "broad",
      metaSpend: 140.2,
      metaConversions: 10,
      metaRevenue: 630,
      metaRoas: 4.49,
      crmOrders: 8,
      crmRevenue: 504,
      crmSource: "shopify",
      revenueDelta: -126,
      revenueDeltaPct: -20,
      status: "partial",
      statusReason: "CRM revenue 20% below Meta-reported"
    }
  });

  await prisma.reconciliationResult.upsert({
    where: { id: "rec_seed_2" },
    update: {},
    create: {
      id: "rec_seed_2",
      clientAccountId: act1.id,
      date: "2024-03-01",
      utmCampaign: "prospecting-q1",
      utmContent: "static-v1-interest",
      utmTerm: "fitness-interest",
      metaSpend: 92.5,
      metaConversions: 5,
      metaRevenue: 287.5,
      metaRoas: 3.11,
      crmOrders: 4,
      crmRevenue: 282,
      crmSource: "shopify",
      revenueDelta: -5.5,
      revenueDeltaPct: -1.9,
      status: "matched",
      statusReason: "Revenue within 10% (-1.9%)"
    }
  });

  // ── Meta connection (1 sample) ──────────────────────────────────────────────
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);
  await prisma.metaConnection.upsert({
    where: { id: "meta_conn_1" },
    update: {},
    create: {
      id: "meta_conn_1",
      userId: "fb_user_1",
      userName: "Demo User",
      userEmail: "demo@example.com",
      connectedAt: new Date(),
      expiresAt,
      isActive: true
    }
  });

  // ── CRM connection (1 sample) ──────────────────────────────────────────────
  await prisma.cRMConnection.upsert({
    where: { id: "crm_conn_1" },
    update: {},
    create: {
      id: "crm_conn_1",
      platform: "shopify",
      label: "Main Store",
      status: "connected",
      storeUrl: "https://example.myshopify.com",
      connectedAt: new Date()
    }
  });

  console.log("Seed completed: client accounts, campaigns, ad sets, ads, creatives, UTM rows, CRM rows, reconciliation results.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
