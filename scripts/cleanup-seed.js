#!/usr/bin/env node
// scripts/cleanup-seed.js
// One-time script to remove all records created by prisma/seed.js.
// Run once in your environment: node scripts/cleanup-seed.js
//
// Deletes in dependency order (leaves first) to avoid FK violations.

"use strict";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Deleting seed data...");

  // Leaf models first
  const ad       = await prisma.ad.deleteMany({ where: { id: { in: ["ad_1", "ad_2"] } } });
  const adSet    = await prisma.adSet.deleteMany({ where: { id: { in: ["adset_1", "adset_2"] } } });
  const goalCamp = await prisma.campaignGoal.deleteMany({ where: { campaignId: { in: ["camp_1", "camp_2"] } } });
  const campaign = await prisma.campaign.deleteMany({ where: { id: { in: ["camp_1", "camp_2"] } } });
  const creative = await prisma.creative.deleteMany({ where: { id: { in: ["creative_1", "creative_2"] } } });

  // Performance rows
  const utm = await prisma.uTMPerformanceRow.deleteMany({
    where: { id: { in: ["utr_seed_1", "utr_seed_2"] } },
  });
  const crm = await prisma.cRMPerformanceRow.deleteMany({
    where: { id: { in: ["crm_seed_1", "crm_seed_2"] } },
  });
  const rec = await prisma.reconciliationResult.deleteMany({
    where: { id: { in: ["rec_seed_1", "rec_seed_2"] } },
  });

  // Client accounts last (parent of the above via clientAccountId)
  const client = await prisma.clientAccount.deleteMany({
    where: { id: { in: ["act_1", "act_2"] } },
  });

  const totals = {
    ads:       ad.count,
    adSets:    adSet.count,
    goalCamps: goalCamp.count,
    campaigns: campaign.count,
    creatives: creative.count,
    utmRows:   utm.count,
    crmRows:   crm.count,
    recRows:   rec.count,
    clients:   client.count,
  };

  console.log("Done:", totals);
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`Total records deleted: ${total}`);
}

main()
  .catch((e) => {
    console.error("Error during cleanup:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
