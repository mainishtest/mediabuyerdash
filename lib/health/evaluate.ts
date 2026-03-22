// lib/health/evaluate.ts
// Server-side first-sync data validation and account health evaluation.
// Composes signals from existing integration and sync modules.

import { prisma } from "../db";
import { getMetaSyncSetupState } from "../meta/integrationState";
import {
  getShopifyConnectionState,
  evaluateShopifySyncHealth,
  getShopifyDataHealth,
} from "../shopify/integrationState";
import type {
  AccountHealthCheck,
  AccountHealthIssue,
  AccountHealthSummary,
  HealthRecommendation,
  SpendValidationSummary,
  RevenueValidationSummary,
  DataTrustState,
} from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 14;
const STALE_THRESHOLD_HOURS = 48;
const MIN_SPEND_DAYS = 3;
const MIN_REVENUE_DAYS = 1;

// ── Main entry point ──────────────────────────────────────────────────────────

export async function buildFirstSyncValidationSummary(
  workspaceId: string,
): Promise<AccountHealthSummary> {
  const [spendSummary, revenueSummary, metaSync, shopifyHealth, workspace, clientCount] =
    await Promise.all([
      evaluateMetaSpendCoverage(workspaceId),
      evaluateRevenueCoverage(workspaceId),
      getMetaSyncSetupState(),
      evaluateShopifySyncHealth(),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { timezone: true },
      }),
      prisma.clientAccount.count({ where: { workspaceId } }),
    ]);

  // Sync freshness
  const metaFreshnessHours = metaSync.lastSyncAt
    ? Math.round((Date.now() - new Date(metaSync.lastSyncAt).getTime()) / 3_600_000)
    : null;
  const shopifyFreshnessHours = shopifyHealth.lastSyncAt
    ? Math.round((Date.now() - new Date(shopifyHealth.lastSyncAt).getTime()) / 3_600_000)
    : null;

  // Get shopify data health for attribution check
  const shopifyConn = await getShopifyConnectionState();
  let shopifyDataHealth: Awaited<ReturnType<typeof getShopifyDataHealth>> | null = null;
  if (shopifyConn.status === "connected" && shopifyConn.connectionId) {
    shopifyDataHealth = await getShopifyDataHealth(shopifyConn.connectionId);
  }

  // Client-to-account mapping
  const mappedClients = await prisma.clientAccount.count({
    where: {
      workspaceId,
      metaSelectedAccounts: { some: {} },
    },
  });

  // Build checks
  const checks = buildHealthChecks({
    spendSummary,
    revenueSummary,
    metaSync,
    shopifyHealth,
    metaFreshnessHours,
    shopifyFreshnessHours,
    workspaceTimezone: workspace?.timezone ?? null,
    clientCount,
    mappedClients,
    shopifyDataHealth,
  });

  const issues = detectHealthIssues(checks);
  const trustState = computeDataTrustState(checks);
  const recommendations = buildHealthRecommendations(checks, issues);

  const trustMessage = TRUST_MESSAGES[trustState];

  return {
    trustState,
    trustMessage,
    checks,
    issues,
    recommendations,
    spendSummary,
    revenueSummary,
    syncFreshnessHours: { meta: metaFreshnessHours, shopify: shopifyFreshnessHours },
  };
}

// ── Spend coverage evaluation ─────────────────────────────────────────────────

export async function evaluateMetaSpendCoverage(
  workspaceId: string,
): Promise<SpendValidationSummary> {
  const since = dateDaysAgo(LOOKBACK_DAYS);

  const insights = await prisma.metaSyncedInsight.groupBy({
    by: ["dateStart"],
    where: {
      workspaceId,
      dateStart: { gte: since },
      spend: { gt: 0 },
    },
    _sum: { spend: true },
    orderBy: { dateStart: "asc" },
  });

  if (insights.length === 0) {
    return {
      hasSpend: false,
      totalSpend: 0,
      daysCovered: 0,
      oldestDate: null,
      newestDate: null,
      avgDailySpend: 0,
      gapDates: [],
    };
  }

  const dates = insights.map((r) => r.dateStart);
  const totalSpend = insights.reduce((s, r) => s + (r._sum.spend ?? 0), 0);
  const gapDates = detectDateGaps(dates, since, todayDateStr());

  return {
    hasSpend: true,
    totalSpend: Math.round(totalSpend * 100) / 100,
    daysCovered: dates.length,
    oldestDate: dates[0],
    newestDate: dates[dates.length - 1],
    avgDailySpend: Math.round((totalSpend / dates.length) * 100) / 100,
    gapDates,
  };
}

// ── Revenue coverage evaluation ───────────────────────────────────────────────

export async function evaluateRevenueCoverage(
  workspaceId: string,
): Promise<RevenueValidationSummary> {
  const sinceDate = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const [orderAgg, fbAgg, orderDates] = await Promise.all([
    prisma.shopifyOrder.aggregate({
      where: { workspaceId, orderCreatedAt: { gte: sinceDate } },
      _sum: { totalPrice: true },
      _count: true,
    }),
    prisma.shopifyOrder.aggregate({
      where: {
        workspaceId,
        orderCreatedAt: { gte: sinceDate },
        utmSource: { equals: "facebook", mode: "insensitive" },
      },
      _sum: { totalPrice: true },
    }),
    // Get distinct dates with orders
    prisma.$queryRaw<Array<{ d: string }>>`
      SELECT DISTINCT TO_CHAR("orderCreatedAt", 'YYYY-MM-DD') AS d
      FROM "ShopifyOrder"
      WHERE "workspaceId" = ${workspaceId}
        AND "orderCreatedAt" >= ${sinceDate}
      ORDER BY d ASC
    `,
  ]);

  const totalRevenue = orderAgg._sum.totalPrice ?? 0;
  const orderCount = orderAgg._count ?? 0;
  const fbRevenue = fbAgg._sum.totalPrice ?? 0;
  const dates = orderDates.map((r) => r.d);
  const gapDates = dates.length > 0
    ? detectDateGaps(dates, dateDaysAgo(LOOKBACK_DAYS), todayDateStr())
    : [];

  return {
    hasRevenue: totalRevenue > 0,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    orderCount,
    daysCovered: dates.length,
    oldestDate: dates[0] ?? null,
    newestDate: dates[dates.length - 1] ?? null,
    fbAttributedRevenue: Math.round(fbRevenue * 100) / 100,
    hasFbAttribution: fbRevenue > 0,
    gapDates,
  };
}

// ── Date gap detection ────────────────────────────────────────────────────────

export function detectDateGaps(
  dates: string[],
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const dateSet = new Set(dates);
  const gaps: string[] = [];

  let cur = new Date(rangeStart + "T00:00:00Z");
  const end = new Date(rangeEnd + "T00:00:00Z");

  while (cur <= end) {
    const ds = cur.toISOString().slice(0, 10);
    if (!dateSet.has(ds)) gaps.push(ds);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return gaps;
}

// ── Timezone alignment evaluation ─────────────────────────────────────────────

export function evaluateTimezoneAlignment(
  workspaceTimezone: string | null,
): { aligned: boolean; message: string } {
  if (!workspaceTimezone) {
    return { aligned: false, message: "Workspace timezone is not set." };
  }

  // Basic sanity: timezone string is a valid IANA zone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: workspaceTimezone });
    return {
      aligned: true,
      message: `Timezone set to ${workspaceTimezone.replace(/_/g, " ")}. Ensure this matches your ad account timezone for accurate dayparting.`,
    };
  } catch {
    return { aligned: false, message: `Invalid timezone: ${workspaceTimezone}` };
  }
}

// ── Attribution sanity evaluation ─────────────────────────────────────────────

export function evaluateAttributionSanity(
  revenueSummary: RevenueValidationSummary,
): { sane: boolean; message: string } {
  if (!revenueSummary.hasRevenue) {
    return { sane: false, message: "No revenue data to validate attribution." };
  }

  if (!revenueSummary.hasFbAttribution) {
    return {
      sane: false,
      message: "Orders exist but none are attributed to Facebook. UTM tracking may be misconfigured.",
    };
  }

  const attrPct = revenueSummary.fbAttributedRevenue / revenueSummary.totalRevenue;
  if (attrPct > 0.95) {
    return {
      sane: false,
      message: `${Math.round(attrPct * 100)}% of revenue is Facebook-attributed — unusually high. Verify UTM setup.`,
    };
  }

  return {
    sane: true,
    message: `${Math.round(attrPct * 100)}% of revenue is Facebook-attributed (7-day attribution window). Looks reasonable.`,
  };
}

// ── Build all health checks ───────────────────────────────────────────────────

type CheckInputs = {
  spendSummary: SpendValidationSummary;
  revenueSummary: RevenueValidationSummary;
  metaSync: Awaited<ReturnType<typeof getMetaSyncSetupState>>;
  shopifyHealth: Awaited<ReturnType<typeof evaluateShopifySyncHealth>>;
  metaFreshnessHours: number | null;
  shopifyFreshnessHours: number | null;
  workspaceTimezone: string | null;
  clientCount: number;
  mappedClients: number;
  shopifyDataHealth: Awaited<ReturnType<typeof getShopifyDataHealth>> | null;
};

function buildHealthChecks(inputs: CheckInputs): AccountHealthCheck[] {
  const {
    spendSummary,
    revenueSummary,
    metaSync,
    shopifyHealth,
    metaFreshnessHours,
    shopifyFreshnessHours,
    workspaceTimezone,
    clientCount,
    mappedClients,
    shopifyDataHealth,
  } = inputs;

  const checks: AccountHealthCheck[] = [];

  // ── Meta spend coverage ──────────────────────────────────────────────

  checks.push({
    id: "spend_exists",
    category: "meta_spend_coverage",
    label: "Spend data present",
    description: spendSummary.hasSpend
      ? `$${spendSummary.totalSpend.toLocaleString()} across ${spendSummary.daysCovered} day(s)`
      : "No spend data found in the last 14 days",
    status: spendSummary.hasSpend ? "pass" : "fail",
    required: true,
    actionLabel: spendSummary.hasSpend ? undefined : "Check Meta Integration",
    actionHref: spendSummary.hasSpend ? undefined : "/integrations/meta",
  });

  checks.push({
    id: "spend_coverage",
    category: "meta_spend_coverage",
    label: "Spend date coverage",
    description: spendSummary.daysCovered >= MIN_SPEND_DAYS
      ? `${spendSummary.daysCovered} days of spend data (avg $${spendSummary.avgDailySpend}/day)`
      : `Only ${spendSummary.daysCovered} day(s) of data — need at least ${MIN_SPEND_DAYS}`,
    status: spendSummary.daysCovered >= MIN_SPEND_DAYS ? "pass"
      : spendSummary.daysCovered > 0 ? "warning" : "skipped",
    required: false,
    detail: spendSummary.oldestDate && spendSummary.newestDate
      ? `Range: ${spendSummary.oldestDate} to ${spendSummary.newestDate}`
      : undefined,
  });

  // ── Revenue coverage ─────────────────────────────────────────────────

  checks.push({
    id: "revenue_exists",
    category: "shopify_revenue_coverage",
    label: "Revenue data present",
    description: revenueSummary.hasRevenue
      ? `$${revenueSummary.totalRevenue.toLocaleString()} from ${revenueSummary.orderCount} order(s)`
      : "No revenue data found in the last 14 days",
    status: revenueSummary.hasRevenue ? "pass" : "fail",
    required: true,
    actionLabel: revenueSummary.hasRevenue ? undefined : "Check Shopify Integration",
    actionHref: revenueSummary.hasRevenue ? undefined : "/integrations/shopify",
  });

  checks.push({
    id: "revenue_coverage",
    category: "shopify_revenue_coverage",
    label: "Revenue date coverage",
    description: revenueSummary.daysCovered >= MIN_REVENUE_DAYS
      ? `${revenueSummary.daysCovered} days with orders`
      : "No days with order data yet",
    status: revenueSummary.daysCovered >= MIN_REVENUE_DAYS ? "pass"
      : revenueSummary.daysCovered > 0 ? "warning" : "skipped",
    required: false,
    detail: revenueSummary.oldestDate && revenueSummary.newestDate
      ? `Range: ${revenueSummary.oldestDate} to ${revenueSummary.newestDate}`
      : undefined,
  });

  // ── Sync freshness ───────────────────────────────────────────────────

  const metaFresh = metaFreshnessHours !== null && metaFreshnessHours <= STALE_THRESHOLD_HOURS;
  checks.push({
    id: "meta_sync_fresh",
    category: "sync_freshness",
    label: "Meta sync freshness",
    description: metaFreshnessHours === null
      ? "No Meta sync has completed"
      : metaFresh
      ? `Last sync ${metaFreshnessHours}h ago`
      : `Last sync ${metaFreshnessHours}h ago — data may be stale`,
    status: metaFreshnessHours === null ? "fail" : metaFresh ? "pass" : "warning",
    required: true,
    actionLabel: !metaFresh ? "Retry Sync" : undefined,
    actionHref: !metaFresh ? "/integrations/meta" : undefined,
  });

  const shopifyFresh = shopifyFreshnessHours !== null && shopifyFreshnessHours <= STALE_THRESHOLD_HOURS;
  checks.push({
    id: "shopify_sync_fresh",
    category: "sync_freshness",
    label: "Shopify sync freshness",
    description: shopifyFreshnessHours === null
      ? "No Shopify sync has completed"
      : shopifyFresh
      ? `Last sync ${shopifyFreshnessHours}h ago`
      : `Last sync ${shopifyFreshnessHours}h ago — revenue data may be stale`,
    status: shopifyFreshnessHours === null ? "fail" : shopifyFresh ? "pass" : "warning",
    required: true,
    actionLabel: !shopifyFresh ? "Retry Sync" : undefined,
    actionHref: !shopifyFresh ? "/integrations/shopify" : undefined,
  });

  // ── Timezone alignment ───────────────────────────────────────────────

  const tz = evaluateTimezoneAlignment(workspaceTimezone);
  checks.push({
    id: "timezone_aligned",
    category: "timezone_alignment",
    label: "Timezone configured",
    description: tz.message,
    status: tz.aligned ? "pass" : "warning",
    required: true,
    actionLabel: tz.aligned ? undefined : "Review Timezone",
    actionHref: tz.aligned ? undefined : "/onboarding",
  });

  // ── Attribution sanity ───────────────────────────────────────────────

  const attr = evaluateAttributionSanity(revenueSummary);
  checks.push({
    id: "attribution_sane",
    category: "attribution_sanity",
    label: "Attribution sanity check",
    description: attr.message,
    status: attr.sane ? "pass" : revenueSummary.hasRevenue ? "warning" : "skipped",
    required: false,
    actionLabel: !attr.sane && revenueSummary.hasRevenue ? "Review Attribution" : undefined,
    actionHref: !attr.sane && revenueSummary.hasRevenue ? "/integrations/shopify" : undefined,
  });

  // ── Account mapping ──────────────────────────────────────────────────

  checks.push({
    id: "clients_mapped",
    category: "account_mapping",
    label: "Clients mapped to ad accounts",
    description: clientCount === 0
      ? "No clients created"
      : mappedClients > 0
      ? `${mappedClients}/${clientCount} client(s) mapped to Meta ad accounts`
      : "No clients have ad account mappings",
    status: mappedClients > 0 ? "pass" : clientCount > 0 ? "fail" : "fail",
    required: true,
    actionLabel: mappedClients === 0 ? "Map Clients" : undefined,
    actionHref: mappedClients === 0 ? "/clients" : undefined,
  });

  // ── Date gap detection ───────────────────────────────────────────────

  const spendGaps = spendSummary.gapDates.length;
  const revenueGaps = revenueSummary.gapDates.length;
  const totalGaps = spendGaps + revenueGaps;

  checks.push({
    id: "date_gaps",
    category: "date_gap_detection",
    label: "Date gap analysis",
    description: !spendSummary.hasSpend && !revenueSummary.hasRevenue
      ? "No data to analyze for gaps"
      : totalGaps === 0
      ? "No date gaps detected in spend or revenue data"
      : `${spendGaps} spend gap(s), ${revenueGaps} revenue gap(s) in last 14 days`,
    status: !spendSummary.hasSpend && !revenueSummary.hasRevenue
      ? "skipped"
      : totalGaps === 0 ? "pass"
      : totalGaps <= 3 ? "warning" : "warning",
    required: false,
    detail: totalGaps > 0
      ? `Gaps are common for new accounts and weekends. Major gaps may indicate sync issues.`
      : undefined,
  });

  return checks;
}

// ── Issue detection ───────────────────────────────────────────────────────────

export function detectHealthIssues(
  checks: AccountHealthCheck[],
): AccountHealthIssue[] {
  return checks
    .filter((c) => c.status === "fail" || (c.required && c.status === "warning"))
    .map((c) => ({
      id: c.id,
      category: c.category,
      message: `${c.label}: ${c.description}`,
      severity: c.status === "fail" ? "critical" as const : "warning" as const,
      actionLabel: c.actionLabel ?? "Fix",
      actionHref: c.actionHref ?? "/readiness",
    }));
}

// ── Trust state computation ───────────────────────────────────────────────────

export function computeDataTrustState(
  checks: AccountHealthCheck[],
): DataTrustState {
  const required = checks.filter((c) => c.required);
  const hasData = checks.some((c) => c.status === "pass");
  const hasCriticalFail = required.some((c) => c.status === "fail");
  const hasWarning = required.some((c) => c.status === "warning");

  if (!hasData) return "unverified";
  if (hasCriticalFail) return "blocked";
  if (hasWarning) return "warning";

  // Check optional anomalies
  const optionalFails = checks.filter((c) => !c.required && c.status === "warning");
  if (optionalFails.length > 0) return "suspect";

  return "healthy";
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function buildHealthRecommendations(
  checks: AccountHealthCheck[],
  issues: AccountHealthIssue[],
): HealthRecommendation[] {
  const recs: HealthRecommendation[] = [];

  // Critical issues first
  for (const issue of issues.filter((i) => i.severity === "critical")) {
    recs.push({
      priority: "required",
      label: issue.message.split(":")[0],
      description: issue.message,
      actionLabel: issue.actionLabel,
      actionHref: issue.actionHref,
    });
  }

  // Warnings
  for (const issue of issues.filter((i) => i.severity === "warning")) {
    recs.push({
      priority: "recommended",
      label: issue.message.split(":")[0],
      description: issue.message,
      actionLabel: issue.actionLabel,
      actionHref: issue.actionHref,
    });
  }

  // Optional incomplete
  for (const c of checks.filter((c) => !c.required && c.status === "warning" && c.actionHref)) {
    // Avoid duplicates from issues
    if (recs.some((r) => r.label === c.label)) continue;
    recs.push({
      priority: "optional",
      label: c.label,
      description: c.description,
      actionLabel: c.actionLabel ?? "Review",
      actionHref: c.actionHref!,
    });
  }

  return recs;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const TRUST_MESSAGES: Record<DataTrustState, string> = {
  unverified: "No synced data to validate. Run your first sync to get started.",
  healthy: "Data looks healthy. You can trust the dashboard for operational decisions.",
  warning: "Data is available but some checks need attention. Review warnings before relying on dashboard numbers.",
  suspect: "Data anomalies detected. Investigate before using the dashboard for decisions.",
  blocked: "Critical data issues detected. Fix these before using the dashboard.",
};
