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
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 60);
  await prisma.metaConnection.upsert({
    where: { metaUserId: "demo_meta_user_1" },
    update: {},
    create: {
      id: "meta_conn_1",
      metaUserId: "demo_meta_user_1",
      userDisplayName: "Demo User",
      connectionStatus: "active",
      accessToken: "demo_access_token",
      tokenExpiresAt,
      scopes: "ads_read,ads_management"
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

  // ── Date helper ────────────────────────────────────────────────────────────
  function dateStr(daysAgo) {
    return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  }

  // ── Recent UTM + CRM performance rows (last 7 days, for executive report) ──
  // The executive report queries UTMPerformanceRow + CRMPerformanceRow
  // for the selected date range. Old seed data (2024-03-01) is too stale.

  const utmRecentData = [
    { client: "act_1", campaign: "camp_1", adSet: "adset_1", ad: "ad_1", daysAgo: 1, spend: 280.50, impressions: 24500, clicks: 490, conversions: 16, revenue: 1008 },
    { client: "act_1", campaign: "camp_1", adSet: "adset_2", ad: "ad_2", daysAgo: 1, spend: 145.00, impressions: 11200, clicks: 198, conversions: 6, revenue: 479.25 },
    { client: "act_1", campaign: "camp_1", adSet: "adset_1", ad: "ad_1", daysAgo: 2, spend: 262.00, impressions: 22100, clicks: 465, conversions: 14, revenue: 917.00 },
    { client: "act_1", campaign: "camp_1", adSet: "adset_2", ad: "ad_2", daysAgo: 2, spend: 136.20, impressions: 10500, clicks: 178, conversions: 5, revenue: 437.90 },
    { client: "act_1", campaign: "camp_1", adSet: "adset_1", ad: "ad_1", daysAgo: 3, spend: 270.00, impressions: 23000, clicks: 480, conversions: 15, revenue: 877.50 },
    { client: "act_1", campaign: "camp_1", adSet: "adset_2", ad: "ad_2", daysAgo: 3, spend: 140.00, impressions: 10800, clicks: 185, conversions: 5, revenue: 434.50 },
    { client: "act_2", campaign: "camp_1", adSet: "adset_1", ad: "ad_1", daysAgo: 1, spend: 185.00, impressions: 16200, clicks: 285, conversions: 8, revenue: 462.50 },
    { client: "act_2", campaign: "camp_1", adSet: "adset_1", ad: "ad_1", daysAgo: 2, spend: 172.50, impressions: 14800, clicks: 262, conversions: 7, revenue: 414.00 },
    { client: "act_2", campaign: "camp_1", adSet: "adset_1", ad: "ad_1", daysAgo: 3, spend: 190.00, impressions: 17100, clicks: 298, conversions: 9, revenue: 494.00 },
  ];

  for (const row of utmRecentData) {
    const d = dateStr(row.daysAgo);
    const utmId = `utr_recent_${row.client}_${row.ad}_${d}`;
    await prisma.uTMPerformanceRow.upsert({
      where: { id: utmId },
      update: { spend: row.spend, impressions: row.impressions, clicks: row.clicks, conversions: row.conversions, revenue: row.revenue },
      create: {
        id: utmId,
        clientAccountId: row.client,
        date: d,
        campaignId: row.campaign,
        campaignName: row.campaign === "camp_1" ? "Prospecting Q1" : "Retargeting Q1",
        adSetId: row.adSet,
        adSetName: row.adSet === "adset_1" ? "US - Broad" : "US - Interest Targeting",
        adId: row.ad,
        adName: row.ad === "ad_1" ? "Video V1 - Broad" : "Static V1 - Interest",
        utmCampaign: "prospecting-q1",
        utmContent: row.ad === "ad_1" ? "video-v1-broad" : "static-v1-interest",
        utmTerm: row.ad === "ad_1" ? "broad" : "fitness-interest",
        utmSource: "facebook",
        utmMedium: "cpc",
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: row.conversions,
        revenue: row.revenue,
        cpa: row.conversions > 0 ? row.spend / row.conversions : null,
        roas: row.spend > 0 ? row.revenue / row.spend : null,
      },
    });
  }

  // Recent CRM rows (matching the UTM rows above)
  const crmRecentData = [
    { client: "act_1", daysAgo: 1, utmContent: "video-v1-broad", orders: 13, revenue: 845.00, aov: 65.0 },
    { client: "act_1", daysAgo: 1, utmContent: "static-v1-interest", orders: 5, revenue: 382.50, aov: 76.5 },
    { client: "act_1", daysAgo: 2, utmContent: "video-v1-broad", orders: 11, revenue: 726.00, aov: 66.0 },
    { client: "act_1", daysAgo: 2, utmContent: "static-v1-interest", orders: 4, revenue: 310.00, aov: 77.5 },
    { client: "act_1", daysAgo: 3, utmContent: "video-v1-broad", orders: 12, revenue: 780.00, aov: 65.0 },
    { client: "act_1", daysAgo: 3, utmContent: "static-v1-interest", orders: 4, revenue: 296.00, aov: 74.0 },
    { client: "act_2", daysAgo: 1, utmContent: "video-v1-broad", orders: 6, revenue: 378.00, aov: 63.0 },
    { client: "act_2", daysAgo: 2, utmContent: "video-v1-broad", orders: 5, revenue: 320.00, aov: 64.0 },
    { client: "act_2", daysAgo: 3, utmContent: "video-v1-broad", orders: 7, revenue: 420.00, aov: 60.0 },
  ];

  for (const row of crmRecentData) {
    const d = dateStr(row.daysAgo);
    const crmId = `crm_recent_${row.client}_${row.utmContent}_${d}`;
    await prisma.cRMPerformanceRow.upsert({
      where: { id: crmId },
      update: { orders: row.orders, revenue: row.revenue, averageOrderValue: row.aov },
      create: {
        id: crmId,
        clientAccountId: row.client,
        date: d,
        sourcePlatform: "shopify",
        utmCampaign: "prospecting-q1",
        utmContent: row.utmContent,
        utmTerm: row.utmContent === "video-v1-broad" ? "broad" : "fitness-interest",
        utmSource: "facebook",
        utmMedium: "cpc",
        orders: row.orders,
        revenue: row.revenue,
        averageOrderValue: row.aov,
      },
    });
  }

  // ── Client Goal Defaults (used by daily executive summary) ──────────────
  await prisma.clientGoalDefaults.upsert({
    where: { clientAccountId: "act_1" },
    update: {},
    create: {
      clientAccountId: "act_1",
      defaultRoasGoalType: "high",
      defaultRoasGoalValue: 3.5,
      defaultCpaGoalType: "low",
      defaultCpaGoalValue: 20.0,
      targetRoas: 3.5,
      targetCpa: 20.0,
    },
  });

  await prisma.clientGoalDefaults.upsert({
    where: { clientAccountId: "act_2" },
    update: {},
    create: {
      clientAccountId: "act_2",
      defaultRoasGoalType: "high",
      defaultRoasGoalValue: 2.5,
      defaultCpaGoalType: "low",
      defaultCpaGoalValue: 30.0,
      targetRoas: 2.5,
      targetCpa: 30.0,
    },
  });

  // ── Reconciliation Summaries (rolling recent data for daily executive summary) ──
  // The daily summary queries ReconciliationSummary for yesterday and a 3-day trend.
  // Generate data for the last 7 days so the dashboard always has something to show.

  const recoSeedData = [
    // act_1 — 7 days of performance data
    { client: "act_1", daysAgo: 1, spend: 425.50, revenue: 1487.25, orders: 22 },
    { client: "act_1", daysAgo: 2, spend: 398.20, revenue: 1354.90, orders: 19 },
    { client: "act_1", daysAgo: 3, spend: 410.00, revenue: 1312.00, orders: 20 },
    { client: "act_1", daysAgo: 4, spend: 380.75, revenue: 1219.40, orders: 18 },
    { client: "act_1", daysAgo: 5, spend: 445.00, revenue: 1601.80, orders: 24 },
    { client: "act_1", daysAgo: 6, spend: 390.30, revenue: 1288.00, orders: 17 },
    { client: "act_1", daysAgo: 7, spend: 415.00, revenue: 1411.00, orders: 21 },
    // act_2 — 7 days of performance data
    { client: "act_2", daysAgo: 1, spend: 185.00, revenue: 462.50, orders: 8 },
    { client: "act_2", daysAgo: 2, spend: 172.50, revenue: 414.00, orders: 7 },
    { client: "act_2", daysAgo: 3, spend: 190.00, revenue: 494.00, orders: 9 },
    { client: "act_2", daysAgo: 4, spend: 168.00, revenue: 369.60, orders: 6 },
    { client: "act_2", daysAgo: 5, spend: 195.00, revenue: 507.00, orders: 10 },
    { client: "act_2", daysAgo: 6, spend: 160.00, revenue: 352.00, orders: 5 },
    { client: "act_2", daysAgo: 7, spend: 178.00, revenue: 445.00, orders: 8 },
  ];

  for (const row of recoSeedData) {
    const d = dateStr(row.daysAgo);
    const recoId = `reco_${row.client}_${d}`;
    await prisma.reconciliationSummary.upsert({
      where: { clientAccountId_dateFrom_dateTo: { clientAccountId: row.client, dateFrom: d, dateTo: d } },
      update: {
        totalMetaSpend:  row.spend,
        totalCrmRevenue: row.revenue,
        totalCrmOrders:  row.orders,
        evaluatedRoas:   row.spend > 0 ? row.revenue / row.spend : null,
        evaluatedCpa:    row.orders > 0 ? row.spend / row.orders : null,
        matchedRows:     row.orders,
        unmatchedRows:   0,
      },
      create: {
        id:              recoId,
        clientAccountId: row.client,
        dateFrom:        d,
        dateTo:          d,
        totalMetaSpend:  row.spend,
        totalCrmRevenue: row.revenue,
        totalCrmOrders:  row.orders,
        evaluatedRoas:   row.spend > 0 ? row.revenue / row.spend : null,
        evaluatedCpa:    row.orders > 0 ? row.spend / row.orders : null,
        matchedRows:     row.orders,
        unmatchedRows:   0,
      },
    });
  }

  // ── Client Sync Runs (fresh sync = data is trusted) ───────────────────────
  const recentSync = new Date(Date.now() - 6 * 3600000); // 6 hours ago
  await prisma.clientSyncRun.upsert({
    where: { id: "sync_act_1" },
    update: { completedAt: recentSync },
    create: {
      id: "sync_act_1",
      clientAccountId: "act_1",
      status: "completed",
      startedAt: new Date(recentSync.getTime() - 120000),
      completedAt: recentSync,
      campaignsSynced: 2,
      adSetsSynced: 2,
      adsSynced: 2,
    },
  });

  await prisma.clientSyncRun.upsert({
    where: { id: "sync_act_2" },
    update: { completedAt: recentSync },
    create: {
      id: "sync_act_2",
      clientAccountId: "act_2",
      status: "completed",
      startedAt: new Date(recentSync.getTime() - 90000),
      completedAt: recentSync,
      campaignsSynced: 1,
      adSetsSynced: 1,
      adsSynced: 1,
    },
  });

  console.log("Seed completed: client accounts, campaigns, ad sets, ads, creatives, UTM rows, CRM rows, reconciliation results, reconciliation summaries (7 days), client goal defaults, sync runs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
