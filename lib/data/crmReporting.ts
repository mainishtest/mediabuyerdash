import type { CRMOrderRecord } from "../../types/crm";

// ── Sample CRM order records ─────────────────────────────────────────────────
//
// 7 groups of orders designed to produce the following reconciliation outcomes
// when matched against the utmPerformanceRows in lib/data/utmReporting.ts:
//
//  Group A → matched to utr_1  (2024-03-01, prospecting-q1, video-v1-broad)   → partial  (–20 %)
//  Group B → matched to utr_2  (2024-03-01, static-v1-interest)                → matched  (–2 %)
//  Group C → matched to utr_4  (2024-03-02, video-v1-broad)                   → partial  (–12 %)
//  Group D → matched to utr_5  (2024-03-02, carousel-v1-retargeting)           → mismatch (–53 %)
//  Group E → matched to utr_7  (2024-03-03, static-v1-interest)                → matched  (–1 %)
//  Group F → matched to utr_9  (2024-03-05, video-v1-broad)                   → matched  (–3 %)
//  Group G → NO Meta match (missing_meta)
//
//  utr_3, utr_6, utr_8, utr_10 have no CRM rows → missing_crm

export const sampleCRMOrders: CRMOrderRecord[] = [

  // ── Group A: 2024-03-01 / prospecting-q1 / video-v1-broad / broad ─────────
  // 4 orders → $504.00  (Meta: $630 → –20 % → partial)
  { id: "crm_01", orderId: "O-0001", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 128.50 },
  { id: "crm_02", orderId: "O-0002", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 124.00 },
  { id: "crm_03", orderId: "O-0003", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 127.50 },
  { id: "crm_04", orderId: "O-0004", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 124.00 },

  // ── Group B: 2024-03-01 / prospecting-q1 / static-v1-interest / fitness-interest ──
  // 4 orders → $282.00  (Meta: $287.50 → –2 % → matched)
  { id: "crm_05", orderId: "O-0005", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "static-v1-interest",
    utm_term: "fitness-interest", utm_source: "facebook", utm_medium: "cpc", revenue: 71.00 },
  { id: "crm_06", orderId: "O-0006", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "static-v1-interest",
    utm_term: "fitness-interest", utm_source: "facebook", utm_medium: "cpc", revenue: 70.00 },
  { id: "crm_07", orderId: "O-0007", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "static-v1-interest",
    utm_term: "fitness-interest", utm_source: "facebook", utm_medium: "cpc", revenue: 70.50 },
  { id: "crm_08", orderId: "O-0008", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-01", utm_campaign: "prospecting-q1", utm_content: "static-v1-interest",
    utm_term: "fitness-interest", utm_source: "facebook", utm_medium: "cpc", revenue: 70.50 },

  // ── Group C: 2024-03-02 / prospecting-q1 / video-v1-broad / broad ─────────
  // 4 orders → $608.00  (Meta: $693 → –12 % → partial)
  { id: "crm_09", orderId: "O-0009", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-02", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 153.00 },
  { id: "crm_10", orderId: "O-0010", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-02", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 151.00 },
  { id: "crm_11", orderId: "O-0011", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-02", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 152.00 },
  { id: "crm_12", orderId: "O-0012", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-02", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 152.00 },

  // ── Group D: 2024-03-02 / retargeting-q1 / carousel-v1-retargeting / retargeting-core ──
  // 2 orders → $196.00  (Meta: $420 → –53 % → mismatch)
  { id: "crm_13", orderId: "O-0013", sourcePlatform: "konnective", clientAccountId: "act_1",
    date: "2024-03-02", utm_campaign: "retargeting-q1", utm_content: "carousel-v1-retargeting",
    utm_term: "retargeting-core", utm_source: "facebook", utm_medium: "cpc", revenue: 99.00 },
  { id: "crm_14", orderId: "O-0014", sourcePlatform: "konnective", clientAccountId: "act_1",
    date: "2024-03-02", utm_campaign: "retargeting-q1", utm_content: "carousel-v1-retargeting",
    utm_term: "retargeting-core", utm_source: "facebook", utm_medium: "cpc", revenue: 97.00 },

  // ── Group E: 2024-03-03 / prospecting-q1 / static-v1-interest / fitness-interest ──
  // 2 orders → $218.00  (Meta: $220 → –1 % → matched)
  { id: "crm_15", orderId: "O-0015", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-03", utm_campaign: "prospecting-q1", utm_content: "static-v1-interest",
    utm_term: "fitness-interest", utm_source: "facebook", utm_medium: "cpc", revenue: 110.00 },
  { id: "crm_16", orderId: "O-0016", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-03", utm_campaign: "prospecting-q1", utm_content: "static-v1-interest",
    utm_term: "fitness-interest", utm_source: "facebook", utm_medium: "cpc", revenue: 108.00 },

  // ── Group F: 2024-03-05 / prospecting-q1 / video-v1-broad / broad ─────────
  // 3 orders → $735.00  (Meta: $756 → –3 % → matched)
  { id: "crm_17", orderId: "O-0017", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-05", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 246.00 },
  { id: "crm_18", orderId: "O-0018", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-05", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 244.00 },
  { id: "crm_19", orderId: "O-0019", sourcePlatform: "shopify", clientAccountId: "act_1",
    date: "2024-03-05", utm_campaign: "prospecting-q1", utm_content: "video-v1-broad",
    utm_term: "broad", utm_source: "facebook", utm_medium: "cpc", revenue: 245.00 },

  // ── Group G: 2024-03-04 / email-newsletter (no matching Meta UTM row) ─────
  // 2 orders → $215.00  → missing_meta
  { id: "crm_20", orderId: "O-0020", sourcePlatform: "konnective", clientAccountId: "act_1",
    date: "2024-03-04", utm_campaign: "email-newsletter", utm_content: "email-v1-summer",
    utm_term: "email-promo", utm_source: "email", utm_medium: "email", revenue: 108.00,
    funnelName: "Summer Sale Funnel" },
  { id: "crm_21", orderId: "O-0021", sourcePlatform: "konnective", clientAccountId: "act_1",
    date: "2024-03-04", utm_campaign: "email-newsletter", utm_content: "email-v1-summer",
    utm_term: "email-promo", utm_source: "email", utm_medium: "email", revenue: 107.00,
    funnelName: "Summer Sale Funnel" }
];
