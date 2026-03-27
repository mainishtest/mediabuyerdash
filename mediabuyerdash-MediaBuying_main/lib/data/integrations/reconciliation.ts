import type { ReconciliationRecord } from "../../../types/integrations";

// Helper used only for building sample records cleanly.
function rec(
  partial: Omit<ReconciliationRecord, "revenueDelta" | "revenueDeltaPct" | "discrepancyFlag">
): ReconciliationRecord {
  const delta    = partial.crmRevenue - partial.metaRevenue;
  const deltaPct = partial.metaRevenue > 0 ? (delta / partial.metaRevenue) * 100 : 0;
  return {
    ...partial,
    revenueDelta:    Math.round(delta * 100) / 100,
    revenueDeltaPct: Math.round(deltaPct * 10) / 10,
    discrepancyFlag: Math.abs(deltaPct) > 20
  };
}

export const reconciliationRecords: ReconciliationRecord[] = [
  rec({
    id:             "rec_1",
    date:           "2024-03-01",
    campaignId:     "camp_1",
    campaignName:   "Prospecting Q1",
    utmCampaign:    "prospecting-q1",
    metaSpend:      140.20,
    metaConversions: 18,
    metaRevenue:    1_080.00,
    metaRoas:       7.70,
    crmOrders:      15,
    crmRevenue:     900.00,
    crmRoas:        6.42
  }),
  rec({
    id:             "rec_2",
    date:           "2024-03-02",
    campaignId:     "camp_2",
    campaignName:   "Retargeting Q1",
    utmCampaign:    "retargeting-q1",
    metaSpend:       89.50,
    metaConversions: 12,
    metaRevenue:     840.00,
    metaRoas:        9.39,
    crmOrders:       10,
    crmRevenue:      700.00,
    crmRoas:         7.82
  }),
  rec({
    id:             "rec_3",
    date:           "2024-03-03",
    campaignId:     "camp_1",
    campaignName:   "Prospecting Q1",
    utmCampaign:    "prospecting-q1",
    metaSpend:      130.80,
    metaConversions: 16,
    metaRevenue:     960.00,
    metaRoas:        7.34,
    crmOrders:       13,
    crmRevenue:      780.00,
    crmRoas:         5.96
  })
];
